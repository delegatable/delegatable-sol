import { ethers } from "hardhat";
import { Contract, ContractFactory, utils, Wallet } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
// @ts-ignore
import { generateUtil } from "eth-delegatable-utils";
import { getPrivateKeys } from "../utils/getPrivateKeys";
import { expect } from "chai";
import { Provider } from "@ethersproject/providers";
import { generateDelegation } from "./utils";
const { getSigners } = ethers;

describe("DelegatableRelay", () => {
  const CONTACT_NAME = "DelegatableRelay";
  let CONTRACT_INFO: any;
  let delegatableUtils: any;
  let signer0: SignerWithAddress;
  let wallet0: Wallet;
  let wallet1: Wallet;
  let pk0: string;
  let pk1: string;

  let DelegatableRelay: Contract;
  let DelegatableRelayFactory: ContractFactory;
  let AllowedMethodsEnforcer: Contract;
  let AllowedMethodsEnforcerFactory: ContractFactory;
  let Mock: Contract;
  let MockFactory: ContractFactory;

  before(async () => {
    [signer0] = await getSigners();
    [wallet0, wallet1] = getPrivateKeys(
      signer0.provider as unknown as Provider
    );

    DelegatableRelayFactory = await ethers.getContractFactory(CONTACT_NAME);
    DelegatableRelay = await DelegatableRelayFactory.deploy();

    MockFactory = await ethers.getContractFactory("MockRelayedDelegatable");
    AllowedMethodsEnforcerFactory = await ethers.getContractFactory(
      "AllowedMethodsEnforcer"
    );
    pk0 = wallet0._signingKey().privateKey;
    pk1 = wallet1._signingKey().privateKey;
  });

  beforeEach(async () => {
    Mock = await MockFactory.connect(wallet0).deploy(DelegatableRelay.address);
    AllowedMethodsEnforcer = await AllowedMethodsEnforcerFactory.connect(
      wallet0
    ).deploy();

    CONTRACT_INFO = {
      chainId: DelegatableRelay.deployTransaction.chainId,
      verifyingContract: DelegatableRelay.address,
      name: CONTACT_NAME,
    };
    delegatableUtils = generateUtil(CONTRACT_INFO);
  });

  it("READ verifyDelegationSignature(SignedDelegation memory signedDelegation)`", async () => {
    const _delegation = generateDelegation(
      CONTACT_NAME,
      DelegatableRelay,
      pk0,
      wallet1.address
    );
    expect(await DelegatableRelay.verifyDelegationSignature(_delegation)).to.eq(
      wallet0.address
    );
  });

  it("READ verifyInvocationSignature(SignedInvocation memory signedInvocation)", async () => {
    const _delegation = generateDelegation(
      CONTACT_NAME,
      DelegatableRelay,
      pk0,
      wallet1.address
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
            to: Mock.address,
            gasLimit: "21000000000000",
            data: (await Mock.populateTransaction.setPurpose("To delegate!"))
              .data,
          },
        },
      ],
    };
    const invocation = delegatableUtils.signInvocations(
      INVOCATION_MESSAGE,
      pk0
    );
    expect(await DelegatableRelay.verifyInvocationSignature(invocation)).to.eq(
      wallet0.address
    );
  });

  describe("contractInvoke(Invocation[] calldata batch)", () => {
    it("should SUCCEED to EXECUTE batched Invocations", async () => {
      expect(await Mock.purpose()).to.eq("What is my purpose?");
      const _delegation = generateDelegation(
        CONTACT_NAME,
        DelegatableRelay,
        pk0,
        wallet1.address
      );
      await DelegatableRelay.contractInvoke([
        {
          authority: [_delegation],
          transaction: {
            to: Mock.address,
            gasLimit: "21000000000000",
            data: (
              await Mock.populateTransaction.setPurpose("To delegate!")
            ).data,
          },
        },
      ]);
      expect(await Mock.purpose()).to.eq("To delegate!");
    });
  });

  describe("invoke(SignedInvocation[] calldata signedInvocations)", () => {
    it("should SUCCEED to EXECUTE a single Invocation from an unsigned authority", async () => {
      expect(await Mock.purpose()).to.eq("What is my purpose?");
      const INVOCATION_MESSAGE = {
        replayProtection: {
          nonce: "0x01",
          queue: "0x00",
        },
        batch: [
          {
            authority: [],
            transaction: {
              to: Mock.address,
              gasLimit: "21000000000000",
              data: (await Mock.populateTransaction.setPurpose("To delegate!"))
                .data,
            },
          },
        ],
      };
      const invocation = delegatableUtils.signInvocations(
        INVOCATION_MESSAGE,
        pk0
      );
      await DelegatableRelay.invoke([
        {
          signature: invocation.signature,
          invocations: invocation.invocations,
        },
      ]);
      expect(await Mock.purpose()).to.eq("To delegate!");
    });

    it("should SUCCEED to EXECUTE batched SignedInvocations", async () => {
      expect(await Mock.purpose()).to.eq("What is my purpose?");
      const _delegation = generateDelegation(
        CONTACT_NAME,
        DelegatableRelay,
        pk0,
        wallet1.address
      );
      const INVOCATION_MESSAGE = {
        replayProtection: {
          nonce: "0x02",
          queue: "0x00",
        },
        batch: [
          {
            authority: [_delegation],
            transaction: {
              to: Mock.address,
              gasLimit: "21000000000000",
              data: (await Mock.populateTransaction.setPurpose("To delegate!"))
                .data,
            },
          },
        ],
      };
      const invocation = delegatableUtils.signInvocations(
        INVOCATION_MESSAGE,
        pk0
      );
      await DelegatableRelay.invoke([
        {
          signature: invocation.signature,
          invocations: invocation.invocations,
        },
      ]);
      expect(await Mock.purpose()).to.eq("To delegate!");
    });
  });
});
