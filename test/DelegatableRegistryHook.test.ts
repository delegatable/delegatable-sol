import { ethers } from "hardhat";
import { expect } from "chai";
import { Provider } from "@ethersproject/providers";
import { BigNumber, Contract, ContractFactory, Wallet } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
// @ts-ignore
import { generateUtil } from "eth-delegatable-utils";
import { getPrivateKeys } from "../utils/getPrivateKeys";
import { generateDelegation } from "./utils";
import { string } from "hardhat/internal/core/params/argumentTypes";

const { getSigners } = ethers;

describe("DelegatableAfterInvoke", () => {
  const CONTACT_NAME = "RegistryVerifierDelegatable";
  let CONTRACT_INFO: any;
  let delegatableUtils: any;
  let signer0: SignerWithAddress;
  let deployer: Wallet;
  let trustController: Wallet;
  let wallet: Wallet;
  let pk0: string;
  let pk1: string;
  let pk2: string;

  // Smart Contracts
  let AllowedMethodsEnforcer: Contract;
  let AllowedMethodsEnforcerFactory: ContractFactory;
  let verifier: Contract;
  let verifierFactory: ContractFactory;
  let registry: Contract;
  let registryFactory: ContractFactory;

  before(async () => {
    [signer0] = await getSigners();
    [deployer, trustController, wallet] = getPrivateKeys(
      signer0.provider as unknown as Provider
    );
    verifierFactory = await ethers.getContractFactory(
      "RegistryVerifierDelegatable"
    );
    AllowedMethodsEnforcerFactory = await ethers.getContractFactory(
      "AllowedMethodsEnforcer"
    );
    registryFactory = await ethers.getContractFactory("Registry");
    pk0 = deployer._signingKey().privateKey;
    pk1 = trustController._signingKey().privateKey;
    pk2 = wallet._signingKey().privateKey;
  });

  beforeEach(async () => {
    registry = await registryFactory
      .connect(deployer)
      .deploy(trustController.address, trustController.address);

    verifier = await verifierFactory
      .connect(deployer)
      .deploy(CONTACT_NAME, registry.address);
    AllowedMethodsEnforcer = await AllowedMethodsEnforcerFactory.connect(
      deployer
    ).deploy();

    CONTRACT_INFO = {
      chainId: verifier.deployTransaction.chainId,
      verifyingContract: verifier.address,
      name: CONTACT_NAME,
    };
    delegatableUtils = generateUtil(CONTRACT_INFO);
  });

  it("should SUCCEED to INVOKE if delegationSigner is trust anchor", async () => {
    await registry.connect(trustController).addTrustAnchor(deployer.address);

    const _delegation = generateDelegation(
      CONTACT_NAME,
      verifier,
      pk0,
      trustController.address,
      [
        {
          enforcer: AllowedMethodsEnforcer.address,
          terms: "0xeb68757f",
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
            to: verifier.address,
            gasLimit: "210000000000000000",
            data: (
              await verifier.populateTransaction.setPurpose("my new purpose")
            ).data,
          },
        },
      ],
    };
    const invocation = delegatableUtils.signInvocation(INVOCATION_MESSAGE, pk1);
    await verifier.invoke([
      {
        signature: invocation.signature,
        invocations: invocation.invocations,
      },
    ]);
    expect(await verifier.connect(wallet).purpose()).to.be.eq("my new purpose");
  });

  it("should FAIL to INVOKE if delegationSigner is not trust anchor", async () => {
    const _delegation = generateDelegation(
      CONTACT_NAME,
      verifier,
      pk0,
      trustController.address,
      [
        {
          enforcer: AllowedMethodsEnforcer.address,
          terms: "0xeb68757f",
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
            to: verifier.address,
            gasLimit: "210000000000000000",
            data: (
              await verifier.populateTransaction.setPurpose("my new purpose")
            ).data,
          },
        },
      ],
    };
    const invocation = delegatableUtils.signInvocation(INVOCATION_MESSAGE, pk1);
    await expect(
      verifier.invoke([
        {
          signature: invocation.signature,
          invocations: invocation.invocations,
        },
      ])
    ).to.be.revertedWith("verifier:not-registered");
  });
});
