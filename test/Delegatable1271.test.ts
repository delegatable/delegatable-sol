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
  let ContractAccount: Contract;
  let ContractAccountFactory: ContractFactory;

  before(async () => {
    [signer0] = await getSigners();
    [wallet0, wallet1] = getPrivateKeys(
      signer0.provider as unknown as Provider
    );
    DelegatableFactory = await ethers.getContractFactory("MockDelegatable");
    ContractAccountFactory = await ethers.getContractFactory("EIP1271");
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
    ContractAccount = await ContractAccountFactory.connect(wallet1).deploy();

    CONTRACT_INFO = {
      chainId: Delegatable.deployTransaction.chainId,
      verifyingContract: Delegatable.address,
      name: CONTACT_NAME,
    };
    delegatableUtils = generateUtil(CONTRACT_INFO);
  });

  describe("contract accounts", () => {
    it("should be able to delegate its own powers", async () => {
      await Delegatable.transferOwnership(ContractAccount.address);
      expect(await Delegatable.owner()).to.equal(ContractAccount.address);
      expect(await Delegatable.owner()).to.equal(ContractAccount.address);

      const _delegation: SignedDelegation = generateDelegation(
        CONTACT_NAME,
        Delegatable,
        pk1,
        wallet0.address
      );

      _delegation.signerIsContract = true;
      _delegation.signature = `${
        ContractAccount.address
      }${_delegation.signature.substring(2)}`;

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

    it("should be able to use powers they have been delegated by an EOA", async () => {
      const _delegation: SignedDelegation = generateDelegation(
        CONTACT_NAME,
        Delegatable,
        pk0,
        ContractAccount.address
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
        pk1
      );

      invocation.signerIsContract = true;
      invocation.signature = `${
        ContractAccount.address
      }${invocation.signature.substring(2)}`;
      await Delegatable.invoke([invocation]);
      expect(await Delegatable.purpose()).to.eq("To delegate!");
    });
  });
});
