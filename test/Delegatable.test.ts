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

describe("Delegatable", () => {
  const CONTACT_NAME = "Delegatable";
  let CONTRACT_INFO: any;
  let delegatableUtils: any;
  let signer0: SignerWithAddress;
  let wallet0: Wallet;
  let wallet1: Wallet;
  let pk0: string;
  let pk1: string;

  let AllowedMethodsEnforcer: Contract;
  let AllowedMethodsEnforcerFactory: ContractFactory;
  let Delegatable: Contract;
  let DelegatableFactory: ContractFactory;

  before(async () => {
    [signer0] = await getSigners();
    [wallet0, wallet1] = getPrivateKeys(
      signer0.provider as unknown as Provider
    );
    DelegatableFactory = await ethers.getContractFactory("MockDelegatable");
    AllowedMethodsEnforcerFactory = await ethers.getContractFactory(
      "AllowedMethodsEnforcer"
    );
    pk0 = wallet0._signingKey().privateKey;
    pk1 = wallet1._signingKey().privateKey;
  });

  beforeEach(async () => {
    Delegatable = await DelegatableFactory.connect(wallet0).deploy(
      CONTACT_NAME
    );
    AllowedMethodsEnforcer = await AllowedMethodsEnforcerFactory.connect(
      wallet0
    ).deploy();

    CONTRACT_INFO = {
      chainId: Delegatable.deployTransaction.chainId,
      verifyingContract: Delegatable.address,
      name: CONTACT_NAME,
    };
    delegatableUtils = generateUtil(CONTRACT_INFO);
  });

  it("READ getDelegationTypedDataHash(Delegation memory delegation)", async () => {
    const DELEGATION = {
      delegate: wallet0.address,
      authority:
        "0x0000000000000000000000000000000000000000000000000000000000000000",
      caveats: [],
    };
    expect(await Delegatable.getDelegationTypedDataHash(DELEGATION)).to.eq(
      "0x5352e474c0624192d7bdd9ace20cca8e397aa705676ef4f494218dcd291aac36"
    );
  });
  it("READ getInvocationsTypedDataHash(Invocations memory invocations)", async () => {
    const _delegation = generateDelegation(
      CONTACT_NAME,
      Delegatable,
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
            to: Delegatable.address,
            gasLimit: "21000000000000",
            data: (
              await Delegatable.populateTransaction.setPurpose("To delegate!")
            ).data,
          },
        },
      ],
    };
    expect(
      await Delegatable.getInvocationsTypedDataHash(INVOCATION_MESSAGE)
    ).to.eq(
      "0x02ab888ac2e660572a8a35c97df49446801e50cf549a7d0546ac881c2aec28d6"
    );
  });
  it("READ getEIP712DomainHash(string,string,uint256,address)", async () => {});
  it("READ verifyDelegationSignature(SignedDelegation memory signedDelegation)`", async () => {
    const _delegation = generateDelegation(
      CONTACT_NAME,
      Delegatable,
      pk0,
      wallet1.address
    );
    expect(await Delegatable.verifyDelegationSignature(_delegation)).to.eq(
      wallet0.address
    );
  });
  it("READ verifyInvocationSignature(SignedInvocation memory signedInvocation)", async () => {
    const _delegation = generateDelegation(
      CONTACT_NAME,
      Delegatable,
      pk0,
      wallet1.address
    );
    const INVOCATION_MESSAGE = {
      authority: [_delegation],
      transaction: {
        to: Delegatable.address,
        gasLimit: "21000000000000",
        data: (await Delegatable.populateTransaction.setPurpose("To delegate!"))
          .data,
      },
    };
    console.log("ATTEMPTING TO SIGN INVOCATION");
    console.log(INVOCATION_MESSAGE);
    const invocation = delegatableUtils.signInvocation(INVOCATION_MESSAGE, pk0);
    expect(await Delegatable.verifyInvocationSignature(invocation)).to.eq(
      wallet0.address
    );
  });

  describe("contractInvoke(Invocation[] calldata batch)", () => {
    it("should SUCCEED to EXECUTE batched Invocations", async () => {
      expect(await Delegatable.purpose()).to.eq("What is my purpose?");
      const _delegation = generateDelegation(
        CONTACT_NAME,
        Delegatable,
        pk0,
        wallet1.address
      );
      await Delegatable.contractInvoke([
        {
          authority: [_delegation],
          transaction: {
            to: Delegatable.address,
            gasLimit: "21000000000000",
            data: (
              await Delegatable.populateTransaction.setPurpose("To delegate!")
            ).data,
          },
        },
      ]);
      expect(await Delegatable.purpose()).to.eq("To delegate!");
    });
  });

  describe("invoke(SignedInvocation[] calldata signedInvocations)", () => {
    it("should SUCCEED to EXECUTE a single Invocation from an unsigned authority", async () => {
      expect(await Delegatable.purpose()).to.eq("What is my purpose?");
      const INVOCATION_MESSAGE = {
        replayProtection: {
          nonce: "0x01",
          queue: "0x00",
        },
        batch: [
          {
            authority: [],
            transaction: {
              to: Delegatable.address,
              gasLimit: "21000000000000",
              data: (
                await Delegatable.populateTransaction.setPurpose("To delegate!")
              ).data,
            },
          },
        ],
      };
      const invocation = delegatableUtils.signInvocations(
        INVOCATION_MESSAGE,
        pk0
      );
      await Delegatable.invoke([
        {
          signature: invocation.signature,
          invocations: invocation.invocations,
        },
      ]);
      expect(await Delegatable.purpose()).to.eq("To delegate!");
    });

    it("should SUCCEED to EXECUTE batched SignedInvocations", async () => {
      expect(await Delegatable.purpose()).to.eq("What is my purpose?");
      const _delegation = generateDelegation(
        CONTACT_NAME,
        Delegatable,
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
              to: Delegatable.address,
              gasLimit: "21000000000000",
              data: (
                await Delegatable.populateTransaction.setPurpose("To delegate!")
              ).data,
            },
          },
        ],
      };
      const invocation = delegatableUtils.signInvocations(
        INVOCATION_MESSAGE,
        pk0
      );
      await Delegatable.invoke([
        {
          signature: invocation.signature,
          invocations: invocation.invocations,
        },
      ]);
      expect(await Delegatable.purpose()).to.eq("To delegate!");
    });
  });
});
