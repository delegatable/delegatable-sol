import { ethers } from "hardhat";
import { expect } from "chai";
import { Provider } from "@ethersproject/providers";
import { Contract, ContractFactory, utils, Wallet } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
// @ts-ignore
import { generateUtil } from "eth-delegatable-utils";
import { getPrivateKeys } from "../../utils/getPrivateKeys";
import { generateDelegation, prepend0x } from "../utils";

const { getSigners } = ethers;

describe("ERC20AllowanceEnforcer", () => {
  const CONTACT_NAME = "ERC20Delegatable";
  let PK0: string;
  let PK1: string;
  let PK2: string;
  let CONTRACT_INFO: any;
  let delegatableUtils: any;
  let signer0: SignerWithAddress;
  let wallet0: Wallet;
  let wallet1: Wallet;
  let wallet2: Wallet;
  let ERC20AllowanceEnforcer: Contract;
  let ERC20AllowanceEnforcerFactory: ContractFactory;
  let ERC20Delegatable: Contract;
  let ERC20DelegatableFactory: ContractFactory;

  before(async () => {
    [signer0] = await getSigners();
    [wallet0, wallet1, wallet2] = getPrivateKeys(
      signer0.provider as unknown as Provider
    );
    ERC20DelegatableFactory = await ethers.getContractFactory(
      "ERC20Delegatable"
    );
    ERC20AllowanceEnforcerFactory = await ethers.getContractFactory(
      "ERC20AllowanceEnforcer"
    );
    PK0 = wallet0._signingKey().privateKey;
    PK1 = wallet1._signingKey().privateKey;
    PK2 = wallet1._signingKey().privateKey;
  });

  beforeEach(async () => {
    ERC20Delegatable = await ERC20DelegatableFactory.connect(wallet0).deploy(
      CONTACT_NAME,
      "TRUST",
      ethers.utils.parseEther("1")
    );
    ERC20AllowanceEnforcer = await ERC20AllowanceEnforcerFactory.connect(
      wallet0
    ).deploy();

    CONTRACT_INFO = {
      chainId: ERC20Delegatable.deployTransaction.chainId,
      verifyingContract: ERC20Delegatable.address,
      name: CONTACT_NAME,
    };
    delegatableUtils = generateUtil(CONTRACT_INFO);
  });

  it("should SUCCEED to INVOKE transfer BELOW enforcer allowance", async () => {
    const PK = wallet0._signingKey().privateKey.substring(2);
    expect(await ERC20Delegatable.balanceOf(wallet0.address)).to.eq(
      ethers.utils.parseEther("1")
    );
    const _delegation = generateDelegation(
      CONTACT_NAME,
      ERC20Delegatable,
      PK,
      wallet1.address,
      [
        {
          enforcer: ERC20AllowanceEnforcer.address,
          terms: ethers.utils.hexZeroPad(
            utils.parseEther("0.5").toHexString(),
            32
          ),
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
                ethers.utils.parseEther("0.4")
              )
            ).data,
          },
        },
      ],
    };
    const invocation = delegatableUtils.signInvocation(INVOCATION_MESSAGE, PK1);
    await ERC20Delegatable.invoke([
      {
        signature: invocation.signature,
        invocations: invocation.invocations,
      },
    ]);
    expect(await ERC20Delegatable.balanceOf(wallet0.address)).to.eq(
      ethers.utils.parseEther("0.6")
    );
  });

  it("should FAIL to INVOKE transfer ABOVE enforcer allowance", async () => {
    const PK = wallet0._signingKey().privateKey.substring(2);
    expect(await ERC20Delegatable.balanceOf(wallet0.address)).to.eq(
      ethers.utils.parseEther("1")
    );
    const _delegation = generateDelegation(
      CONTACT_NAME,
      ERC20Delegatable,
      PK,
      wallet1.address,
      [
        {
          enforcer: ERC20AllowanceEnforcer.address,
          terms: ethers.utils.hexZeroPad(
            utils.parseEther("0.1").toHexString(),
            32
          ),
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
                ethers.utils.parseEther("0.4")
              )
            ).data,
          },
        },
      ],
    };
    const invocation = delegatableUtils.signInvocation(INVOCATION_MESSAGE, PK1);
    await expect(
      ERC20Delegatable.invoke([
        {
          signature: invocation.signature,
          invocations: invocation.invocations,
        },
      ])
    ).to.be.revertedWith("ERC20AllowanceEnforcer:allowance-exceeded");
  });

  it("should FAIL to transfer more than initial delegation permits", async () => {
    expect(await ERC20Delegatable.balanceOf(wallet0.address)).to.eq(
      ethers.utils.parseEther("1")
    );

    // root delegation (signer will be set to the message sender and therefore tokens will transfer from signer's account)
    // root delegation provides allowance for 0.1
    const _delegation0 = generateDelegation(
      CONTACT_NAME,
      ERC20Delegatable,
      PK0,
      wallet1.address,
      [
        {
          enforcer: ERC20AllowanceEnforcer.address,
          terms: ethers.utils.hexZeroPad(
            utils.parseEther("0.1").toHexString(),
            32
          ),
        },
      ]
    );

    const _delegationHash0 =
      delegatableUtils.createSignedDelegationHash(_delegation0);
    const _delegationHash0Hex = prepend0x(_delegationHash0.toString("hex"));

    // this delegation says allowance is 0.2
    const _delegation1 = generateDelegation(
      CONTACT_NAME,
      ERC20Delegatable,
      PK1,
      wallet2.address,
      [
        {
          enforcer: ERC20AllowanceEnforcer.address,
          terms: ethers.utils.hexZeroPad(
            utils.parseEther("0.2").toHexString(),
            32
          ),
        },
      ],
      _delegationHash0Hex
    );

    // invocation will try to transfer 0.2
    const INVOCATION_MESSAGE = {
      replayProtection: {
        nonce: "0x01",
        queue: "0x00",
      },
      batch: [
        {
          authority: [_delegation0, _delegation1],
          transaction: {
            to: ERC20Delegatable.address,
            gasLimit: "210000000000000000",
            data: (
              await ERC20Delegatable.populateTransaction.transfer(
                wallet1.address,
                ethers.utils.parseEther("0.2")
              )
            ).data,
          },
        },
      ],
    };
    const invocation = delegatableUtils.signInvocation(INVOCATION_MESSAGE, PK2);

    await expect(
      ERC20Delegatable.invoke([
        {
          signature: invocation.signature,
          invocations: invocation.invocations,
        },
      ])
    ).to.be.revertedWith("ERC20AllowanceEnforcer:allowance-exceeded");

    expect(await ERC20Delegatable.balanceOf(wallet0.address)).to.eq(
      ethers.utils.parseEther("1")
    );
  });

  it("should FAIL to INVOKE invalid method", async () => {
    const PK = wallet0._signingKey().privateKey.substring(2);
    expect(await ERC20Delegatable.balanceOf(wallet0.address)).to.eq(
      ethers.utils.parseEther("1")
    );
    const _delegation = generateDelegation(
      CONTACT_NAME,
      ERC20Delegatable,
      PK,
      wallet1.address,
      [
        {
          enforcer: ERC20AllowanceEnforcer.address,
          terms: ethers.utils.hexZeroPad(
            utils.parseEther("0.1").toHexString(),
            32
          ),
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
              await ERC20Delegatable.populateTransaction.approve(
                wallet1.address,
                ethers.utils.parseEther("0.4")
              )
            ).data,
          },
        },
      ],
    };
    const invocation = delegatableUtils.signInvocation(INVOCATION_MESSAGE, PK1);
    await expect(
      ERC20Delegatable.invoke([
        {
          signature: invocation.signature,
          invocations: invocation.invocations,
        },
      ])
    ).to.be.revertedWith("ERC20AllowanceEnforcer:invalid-method");
  });
});
