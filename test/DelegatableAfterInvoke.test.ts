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
  const CONTACT_NAME = "ERC20DelegatableAfterInvoke";
  let CONTRACT_INFO: any;
  let delegatableUtils: any;
  let signer0: SignerWithAddress;
  let wallet0: Wallet;
  let wallet1: Wallet;
  let wallet2: Wallet;
  let pk0: string;
  let pk1: string;
  let pk2: string;

  // Smart Contracts
  let AllowedMethodsEnforcer: Contract;
  let AllowedMethodsEnforcerFactory: ContractFactory;
  let ERC20DelegatableAfterInvoke: Contract;
  let ERC20DelegatableAfterInvokeFactory: ContractFactory;

  before(async () => {
    [signer0] = await getSigners();
    [wallet0, wallet1, wallet2] = getPrivateKeys(
      signer0.provider as unknown as Provider
    );
    ERC20DelegatableAfterInvokeFactory = await ethers.getContractFactory(
      "ERC20DelegatableAfterInvoke"
    );
    AllowedMethodsEnforcerFactory = await ethers.getContractFactory(
      "AllowedMethodsEnforcer"
    );
    pk0 = wallet0._signingKey().privateKey;
    pk1 = wallet1._signingKey().privateKey;
    pk2 = wallet2._signingKey().privateKey;
  });

  beforeEach(async () => {
    ERC20DelegatableAfterInvoke =
      await ERC20DelegatableAfterInvokeFactory.connect(wallet0).deploy(
        wallet0.address,
        CONTACT_NAME,
        "TRUST",
        ethers.utils.parseEther("1")
      );
    AllowedMethodsEnforcer = await AllowedMethodsEnforcerFactory.connect(
      wallet0
    ).deploy();

    CONTRACT_INFO = {
      chainId: ERC20DelegatableAfterInvoke.deployTransaction.chainId,
      verifyingContract: ERC20DelegatableAfterInvoke.address,
      name: CONTACT_NAME,
    };
    delegatableUtils = generateUtil(CONTRACT_INFO);
  });

  it("should SUCCEED to INVOKE if first delegator is owner - single invocation", async () => {
    expect(await ERC20DelegatableAfterInvoke.balanceOf(wallet0.address)).to.eq(
      ethers.utils.parseEther("1")
    );
    const _delegation = generateDelegation(
      CONTACT_NAME,
      ERC20DelegatableAfterInvoke,
      pk0,
      wallet1.address,
      [
        {
          enforcer: AllowedMethodsEnforcer.address,
          terms: "0xa9059cbb",
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
            to: ERC20DelegatableAfterInvoke.address,
            gasLimit: "210000000000000000",
            data: (
              await ERC20DelegatableAfterInvoke.populateTransaction.transfer(
                wallet1.address,
                ethers.utils.parseEther("0.5")
              )
            ).data,
          },
        },
      ],
    };
    const invocation = delegatableUtils.signInvocation(INVOCATION_MESSAGE, pk1);
    await ERC20DelegatableAfterInvoke.invoke([
      {
        signature: invocation.signature,
        invocations: invocation.invocations,
      },
    ]);
    expect(await ERC20DelegatableAfterInvoke.balanceOf(wallet0.address)).to.eq(
      ethers.utils.parseEther("0.5")
    );
  });

  it("should FAIL to INVOKE if first delegator is not owner - single invocation", async () => {
    expect(await ERC20DelegatableAfterInvoke.balanceOf(wallet0.address)).to.eq(
      ethers.utils.parseEther("1")
    );
    let transferAmount = 10;
    let tx = await ERC20DelegatableAfterInvoke.connect(wallet0).transfer(
      wallet1.address,
      transferAmount
    );
    await tx.wait();
    expect(await ERC20DelegatableAfterInvoke.balanceOf(wallet1.address)).to.eq(
      transferAmount
    );
    const _delegation = generateDelegation(
      CONTACT_NAME,
      ERC20DelegatableAfterInvoke,
      pk1,
      wallet2.address,
      [
        {
          enforcer: AllowedMethodsEnforcer.address,
          terms: "0xa9059cbb",
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
            to: ERC20DelegatableAfterInvoke.address,
            gasLimit: "210000000000000000",
            data: (
              await ERC20DelegatableAfterInvoke.populateTransaction.transfer(
                wallet1.address,
                transferAmount
              )
            ).data,
          },
        },
      ],
    };
    const invocation = delegatableUtils.signInvocation(INVOCATION_MESSAGE, pk0); ////////
    await expect(
      ERC20DelegatableAfterInvoke.invoke([
        {
          signature: invocation.signature,
          invocations: invocation.invocations,
        },
      ])
    ).to.be.revertedWith(
      "ERC20DelegatableAfterInvoke:no first delegator is owner"
    );
  });

  it("should SUCCEED to INVOKE if owner is one of the first delegators of any invocation - multiple invocations", async () => {
    expect(await ERC20DelegatableAfterInvoke.balanceOf(wallet0.address)).to.eq(
      ethers.utils.parseEther("1")
    );

    let transferAmount = 10;
    let tx1 = await ERC20DelegatableAfterInvoke.connect(wallet0).transfer(
      wallet1.address,
      transferAmount
    );
    await tx1.wait();

    expect(await ERC20DelegatableAfterInvoke.balanceOf(wallet1.address)).to.eq(
      transferAmount
    );

    const _delegation = generateDelegation(
      CONTACT_NAME,
      ERC20DelegatableAfterInvoke,
      pk0,
      wallet1.address,
      [
        {
          enforcer: AllowedMethodsEnforcer.address,
          terms: "0xa9059cbb",
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
            to: ERC20DelegatableAfterInvoke.address,
            gasLimit: "210000000000000000",
            data: (
              await ERC20DelegatableAfterInvoke.populateTransaction.transfer(
                wallet1.address,
                ethers.utils.parseEther("0.5")
              )
            ).data,
          },
        },
      ],
    };
    const invocation = delegatableUtils.signInvocation(INVOCATION_MESSAGE, pk1);

    const _delegation1 = generateDelegation(
      CONTACT_NAME,
      ERC20DelegatableAfterInvoke,
      pk1,
      wallet2.address,
      [
        {
          enforcer: AllowedMethodsEnforcer.address,
          terms: "0xa9059cbb",
        },
      ]
    );
    const INVOCATION_MESSAGE_1 = {
      replayProtection: {
        nonce: "0x01",
        queue: "0x00",
      },
      batch: [
        {
          authority: [_delegation1],
          transaction: {
            to: ERC20DelegatableAfterInvoke.address,
            gasLimit: "210000000000000000",
            data: (
              await ERC20DelegatableAfterInvoke.populateTransaction.transfer(
                wallet2.address,
                transferAmount
              )
            ).data,
          },
        },
      ],
    };
    const invocation1 = delegatableUtils.signInvocation(
      INVOCATION_MESSAGE_1,
      pk2
    );

    await ERC20DelegatableAfterInvoke.invoke([
      {
        signature: invocation1.signature,
        invocations: invocation1.invocations,
      },
      {
        signature: invocation.signature,
        invocations: invocation.invocations,
      },
    ]);
  });

  it("should FAIL to INVOKE if owner is not one of the first delegators of any invocation - multiple invocations", async () => {
    expect(await ERC20DelegatableAfterInvoke.balanceOf(wallet0.address)).to.eq(
      ethers.utils.parseEther("1")
    );
    let transferAmount = 10;
    let tx1 = await ERC20DelegatableAfterInvoke.connect(wallet0).transfer(
      wallet1.address,
      transferAmount
    );
    await tx1.wait();

    let tx2 = await ERC20DelegatableAfterInvoke.connect(wallet0).transfer(
      wallet2.address,
      transferAmount
    );
    await tx2.wait();

    expect(await ERC20DelegatableAfterInvoke.balanceOf(wallet1.address)).to.eq(
      transferAmount
    );

    expect(await ERC20DelegatableAfterInvoke.balanceOf(wallet2.address)).to.eq(
      transferAmount
    );

    const _delegation = generateDelegation(
      CONTACT_NAME,
      ERC20DelegatableAfterInvoke,
      pk1,
      wallet0.address,
      [
        {
          enforcer: AllowedMethodsEnforcer.address,
          terms: "0xa9059cbb",
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
            to: ERC20DelegatableAfterInvoke.address,
            gasLimit: "210000000000000000",
            data: (
              await ERC20DelegatableAfterInvoke.populateTransaction.transfer(
                wallet0.address,
                transferAmount
              )
            ).data,
          },
        },
      ],
    };
    const invocation = delegatableUtils.signInvocation(INVOCATION_MESSAGE, pk0);

    const _delegation1 = generateDelegation(
      CONTACT_NAME,
      ERC20DelegatableAfterInvoke,
      pk2,
      wallet0.address,
      [
        {
          enforcer: AllowedMethodsEnforcer.address,
          terms: "0xa9059cbb",
        },
      ]
    );
    const INVOCATION_MESSAGE_1 = {
      replayProtection: {
        nonce: "0x02",
        queue: "0x00",
      },
      batch: [
        {
          authority: [_delegation1],
          transaction: {
            to: ERC20DelegatableAfterInvoke.address,
            gasLimit: "210000000000000000",
            data: (
              await ERC20DelegatableAfterInvoke.populateTransaction.transfer(
                wallet0.address,
                transferAmount
              )
            ).data,
          },
        },
      ],
    };
    const invocation1 = delegatableUtils.signInvocation(
      INVOCATION_MESSAGE_1,
      pk0
    );

    await expect(
      ERC20DelegatableAfterInvoke.invoke([
        {
          signature: invocation.signature,
          invocations: invocation.invocations,
        },
        {
          signature: invocation1.signature,
          invocations: invocation1.invocations,
        },
      ])
    ).to.be.revertedWith(
      "ERC20DelegatableAfterInvoke:no first delegator is owner"
    );
  });
});
