import { ethers } from "hardhat";
import { expect } from "chai";
import { Provider } from "@ethersproject/providers";
import { BigNumber, Contract, ContractFactory, Wallet } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
// @ts-ignore
import { generateUtil } from "eth-delegatable-utils";
import { getPrivateKeys } from "../../utils/getPrivateKeys";
import { generateDelegation } from "../utils";

const { getSigners } = ethers;

describe("RevocationEnforcer", () => {
  const CONTRACT_NAME = "ERC20Delegatable";
  let CONTRACT_INFO: any;
  let delegatableUtils: any;
  let signer0: SignerWithAddress;
  let wallet0: Wallet;
  let wallet1: Wallet;
  let pk0: string;
  let pk1: string;

  // Smart Contracts
  let RevocationEnforcer: Contract;
  let RevocationEnforcerFactory: ContractFactory;
  let ERC20Delegatable: Contract;
  let ERC20DelegatableFactory: ContractFactory;

  before(async () => {
    [signer0] = await getSigners();
    [wallet0, wallet1] = getPrivateKeys(
      signer0.provider as unknown as Provider
    );
    ERC20DelegatableFactory = await ethers.getContractFactory(
      "ERC20Delegatable"
    );
    RevocationEnforcerFactory = await ethers.getContractFactory(
      "RevocationEnforcer"
    );
    pk0 = wallet0._signingKey().privateKey;
    pk1 = wallet1._signingKey().privateKey;
  });

  beforeEach(async () => {
    ERC20Delegatable = await ERC20DelegatableFactory.connect(wallet0).deploy(
      CONTRACT_NAME,
      "TRUST",
      ethers.utils.parseEther("1")
    );
    RevocationEnforcer = await RevocationEnforcerFactory.connect(
      wallet0
    ).deploy();

    CONTRACT_INFO = {
      chainId: ERC20Delegatable.deployTransaction.chainId,
      verifyingContract: ERC20Delegatable.address,
      name: CONTRACT_NAME,
    };
    delegatableUtils = generateUtil(CONTRACT_INFO);
  });

  it("should SUCCEED to INVOKE method APPROVED for execution", async () => {
    expect(await ERC20Delegatable.balanceOf(wallet0.address)).to.eq(
      ethers.utils.parseEther("1")
    );
    const _delegation = generateDelegation(
      CONTRACT_NAME,
      ERC20Delegatable,
      pk0,
      wallet1.address,
      [
        {
          enforcer: RevocationEnforcer.address,
          terms: "0x00",
        },
      ]
    );
    const INVOCATION_MESSAGE = {
      replayProtection: {
        nonce: "0x01",
        queue: "0x00",
      },
      batch: [
        {
          authority: [_delegation],
          transaction: {
            to: ERC20Delegatable.address,
            gasLimit: "210000000000000000",
            data: (
              await ERC20Delegatable.populateTransaction.transfer(
                wallet1.address,
                ethers.utils.parseEther("0.5")
              )
            ).data,
          },
        },
      ],
    };
    const invocation = delegatableUtils.signInvocations(
      INVOCATION_MESSAGE,
      pk1
    );
    await ERC20Delegatable.invoke([
      {
        signature: invocation.signature,
        invocations: invocation.invocations,
      },
    ]);
    expect(await ERC20Delegatable.balanceOf(wallet0.address)).to.eq(
      ethers.utils.parseEther("0.5")
    );
  });

  it("should FAIL to INVOKE method AFTER REVOCATION", async () => {
    expect(await ERC20Delegatable.balanceOf(wallet0.address)).to.eq(
      ethers.utils.parseEther("1")
    );
    const _delegation = generateDelegation(
      CONTRACT_NAME,
      ERC20Delegatable,
      pk0,
      wallet1.address,
      [
        {
          enforcer: RevocationEnforcer.address,
          terms: "0x00",
        },
      ]
    );

    const domainHash = await RevocationEnforcer.getEIP712DomainHash(
      CONTRACT_NAME,
      "1",
      CONTRACT_INFO.chainId,
      ERC20Delegatable.address
    );

    await RevocationEnforcer.connect(wallet0).revokeDelegation(
      _delegation,
      domainHash
    );

    const INVOCATION_MESSAGE = {
      replayProtection: {
        nonce: "0x01",
        queue: "0x00",
      },
      batch: [
        {
          authority: [_delegation],
          transaction: {
            to: ERC20Delegatable.address,
            gasLimit: "210000000000000000",
            data: (
              await ERC20Delegatable.populateTransaction.transfer(
                wallet1.address,
                ethers.utils.parseEther("0.5")
              )
            ).data,
          },
        },
      ],
    };
    const invocation = delegatableUtils.signInvocations(
      INVOCATION_MESSAGE,
      pk1
    );
    await expect(
      ERC20Delegatable.invoke([
        {
          signature: invocation.signature,
          invocations: invocation.invocations,
        },
      ])
    ).to.be.revertedWith("RevocationEnforcer:revoked");
  });
});
