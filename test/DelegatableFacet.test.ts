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

const {
  getSelectors,
  FacetCutAction,
  removeSelectors,
  findAddressPositionInFacets,
} = require("../scripts/diamond.js");

describe("DelegatableFacet", () => {
  const CONTACT_NAME = "MyDiamond";
  let CONTRACT_INFO: any;
  let delegatableUtils: any;
  let signer0: SignerWithAddress;
  let wallet0: Wallet;
  let wallet1: Wallet;
  let pk0: string;
  let pk1: string;
  let chainId: number;

  let DiamondCutFacet: Contract;
  let DiamondCutFacetFactory: ContractFactory;
  let Diamond: Contract;
  let DiamondFactory: ContractFactory;
  let PurposeFacet: Contract;
  let PurposeFacetFactory: ContractFactory;
  let DelegatableFacet: Contract;
  let DelegatableFacetFactory: ContractFactory;

  before(async () => {
    [signer0] = await getSigners();
    [wallet0, wallet1] = getPrivateKeys(
      signer0.provider as unknown as Provider
    );

    DiamondCutFacetFactory = await ethers.getContractFactory("DiamondCutFacet");
    DiamondFactory = await ethers.getContractFactory("Diamond");
    PurposeFacetFactory = await ethers.getContractFactory("MockPurposeFacet");
    DelegatableFacetFactory = await ethers.getContractFactory(
      "DelegatableFacet"
    );

    pk0 = wallet0._signingKey().privateKey;
    pk1 = wallet1._signingKey().privateKey;
  });

  beforeEach(async () => {
    DiamondCutFacet = await DiamondCutFacetFactory.deploy();
    chainId = DiamondCutFacet.deployTransaction.chainId;
    const BareDiamond = await DiamondFactory.connect(wallet0).deploy(
      wallet0.address,
      DiamondCutFacet.address
    );
    PurposeFacet = await PurposeFacetFactory.connect(wallet0).deploy();
    DelegatableFacet = await DelegatableFacetFactory.connect(wallet0).deploy();

    // Create proxy for ethers.js diamond interface so diamond exposes all facet methods:
    Diamond = createDiamondProxy(BareDiamond, [
      DiamondCutFacet,
      PurposeFacet,
      DelegatableFacet,
    ]);

    // Add purpose facet to the Diamond
    const setPurposeTx = await PurposeFacet.populateTransaction.setPurpose(
      "What is my purpose?"
    );
    await Diamond.diamondCut(
      [
        {
          facetAddress: PurposeFacet.address,
          action: FacetCutAction.Add,
          functionSelectors: getSelectors(PurposeFacet),
        },
      ],
      PurposeFacet.address,
      setPurposeTx.data
    );

    // Generate delegatable init code to generate domain typehash
    const populatedTx =
      await DelegatableFacet.populateTransaction.setDomainHash(CONTACT_NAME);
    const initTypehashBytes = populatedTx.data;
    // Add delegatable facet to the diamond
    await Diamond.diamondCut(
      [
        {
          facetAddress: DelegatableFacet.address,
          action: FacetCutAction.Add,
          functionSelectors: getSelectors(DelegatableFacet),
          //   - run delegatable init code to generate domain typehash
        },
      ],
      DelegatableFacet.address,
      initTypehashBytes
    );

    CONTRACT_INFO = {
      chainId,
      verifyingContract: Diamond.address,
      version: "1",
      name: CONTACT_NAME,
    };
    delegatableUtils = generateUtil(CONTRACT_INFO);
  });

  describe("contractInvoke(Invocation[] calldata batch)", () => {
    it("should SUCCEED to EXECUTE batched Invocations", async () => {
      const purpose = await Diamond.purpose();
      expect(purpose).to.eq("What is my purpose?");

      const _delegation = generateDelegation(
        CONTACT_NAME,
        Diamond,
        pk0,
        wallet1.address
      );

      await Diamond.contractInvoke([
        {
          authority: [_delegation],
          transaction: {
            to: Diamond.address,
            gasLimit: "21000000000000",
            data: (
              await Diamond.populateTransaction.setPurpose("To delegate!")
            ).data,
          },
        },
      ]);

      const updatedPurpose = await Diamond.purpose();
      expect(updatedPurpose).to.eq("To delegate!");
    });
  });

  describe("invoke(SignedInvocation[] calldata signedInvocations)", () => {
    it("should SUCCEED to EXECUTE a single Invocation from an unsigned authority", async () => {
      const INVOCATION_MESSAGE = {
        replayProtection: {
          nonce: "0x01",
          queue: "0x00",
        },
        batch: [
          {
            authority: [],
            transaction: {
              to: Diamond.address,
              gasLimit: "21000000000000",
              data: (
                await Diamond.populateTransaction.setPurpose("To delegate!")
              ).data,
            },
          },
        ],
      };
      const invocation = delegatableUtils.signInvocations(
        INVOCATION_MESSAGE,
        pk0
      );
      await Diamond.invoke([invocation]);
      expect(await Diamond.purpose()).to.eq("To delegate!");
    });

    it("should SUCCEED to EXECUTE batched SignedInvocations", async () => {
      const _delegation = generateDelegation(
        CONTACT_NAME,
        Diamond,
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
              to: Diamond.address,
              gasLimit: "21000000000000",
              data: (
                await Diamond.populateTransaction.setPurpose("To delegate!")
              ).data,
            },
          },
        ],
      };
      const invocation = delegatableUtils.signInvocations(
        INVOCATION_MESSAGE,
        pk0
      );
      await Diamond.invoke([
        {
          signature: invocation.signature,
          invocations: invocation.invocations,
        },
      ]);
      expect(await Diamond.purpose()).to.eq("To delegate!");
    });
  });
});

/* @notice Merges multiple ethers.js contract instances' interfaces into the first one.
 */
function createDiamondProxy(diamond: Contract, facets: Contract[]) {
  const mergedInterfaces = facets.reduce((acc, facet) => {
    return acc.concat(...facet.interface.fragments.map(fragmentToJSON));
  }, diamond.interface.fragments.map(fragmentToJSON));

  type InterfaceFragment = {
    format: (type: string) => string;
  };

  function fragmentToJSON(fragment: InterfaceFragment) {
    return JSON.parse(fragment.format(ethers.utils.FormatTypes.json));
  }

  const instance = new ethers.Contract(
    diamond.address,
    mergedInterfaces,
    diamond.signer
  );

  const proxyInstance = new Proxy(instance, {
    getOwnPropertyDescriptor(target, prop) {
      if (prop in instance) {
        return {
          writable: true,
          configurable: true,
          enumerable: true,
          value: Reflect.get(instance, prop),
        };
      }
      return {
        writable: true,
        configurable: true,
        enumerable: true,
        value: Reflect.get(target, prop),
      };
    },
    get: (target, prop) => {
      if (prop in instance) {
        return Reflect.get(instance, prop);
      }
      return Reflect.get(target, prop);
    },
  });

  return proxyInstance;
}
