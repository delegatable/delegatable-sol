// SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

import "hardhat/console.sol";
import {EIP712DOMAIN_TYPEHASH} from "./TypesAndDecoders.sol";
import {Delegation, Invocation, Invocations, SignedInvocation, SignedDelegation} from "./CaveatEnforcer.sol";
import {DelegatableCore} from "./DelegatableCore.sol";
import {IDelegatable} from "./interfaces/IDelegatable.sol";
import {IERC1271Wallet} from "./interfaces/IERC1271Wallet.sol";

abstract contract Delegatable is IDelegatable, DelegatableCore {
    /// @notice The hash of the domain separator used in the EIP712 domain hash.
    bytes32 public immutable domainHash;

    /**
     * @notice Delegatable Constructor
     * @param contractName string - The name of the contract
     * @param version string - The version of the contract
     */
    constructor(string memory contractName, string memory version) {
        domainHash = getEIP712DomainHash(
            contractName,
            version,
            block.chainid,
            address(this)
        );
    }

    /* ===================================================================================== */
    /* External Functions                                                                    */
    /* ===================================================================================== */

    /// @inheritdoc IDelegatable
    function getDelegationTypedDataHash(Delegation memory delegation)
        public
        view
        returns (bytes32)
    {
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                domainHash,
                GET_DELEGATION_PACKETHASH(delegation)
            )
        );
        return digest;
    }

    /// @inheritdoc IDelegatable
    function getInvocationsTypedDataHash(Invocations memory invocations)
        public
        view
        returns (bytes32)
    {
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                domainHash,
                GET_INVOCATIONS_PACKETHASH(invocations)
            )
        );
        return digest;
    }

    function getEIP712DomainHash(
        string memory contractName,
        string memory version,
        uint256 chainId,
        address verifyingContract
    ) public pure returns (bytes32) {
        bytes memory encoded = abi.encode(
            EIP712DOMAIN_TYPEHASH,
            keccak256(bytes(contractName)),
            keccak256(bytes(version)),
            chainId,
            verifyingContract
        );
        return keccak256(encoded);
    }

    function verifyDelegationSignature(
        SignedDelegation calldata signedDelegation
    )
        public
        view
        virtual
        override(IDelegatable, DelegatableCore)
        returns (address)
    {
        Delegation calldata delegation = signedDelegation.delegation;
        bytes32 sigHash = getDelegationTypedDataHash(delegation);
        address recoveredSignatureSigner = flexibleRecover(
            sigHash,
            signedDelegation.signature,
            signedDelegation.signerIsContract
        );
        return recoveredSignatureSigner;
    }

    function verifyInvocationSignature(
        SignedInvocation calldata signedInvocation
    ) public view returns (address) {
        bytes32 sigHash = getInvocationsTypedDataHash(
            signedInvocation.invocations
        );
        address recoveredSignatureSigner = flexibleRecover(
            sigHash,
            signedInvocation.signature,
            signedInvocation.signerIsContract
        );
        return recoveredSignatureSigner;
    }

    function flexibleRecover(
        bytes32 _hash,
        bytes calldata _signature,
        bool isContractAccount
    ) internal view returns (address) {
        if (isContractAccount) {
            address intendedSender = address(bytes20(_signature[0:20]));
            bytes calldata proof = _signature[20:_signature.length];
            console.log("Contract account address?: %s", intendedSender);
            console.log("Proof:");
            console.logBytes(proof);
            _callERC1271isValidSignature(intendedSender, _hash, proof);
            return intendedSender;
        } else {
            return recover(_hash, _signature);
        }
    }

    function _callERC1271isValidSignature(
        address _addr,
        bytes32 _hash,
        bytes calldata _signature
    ) internal view {
        bytes4 result = IERC1271Wallet(_addr).isValidSignature(
            _hash,
            _signature
        );
        require(result == 0x1626ba7e, "INVALID_SIGNATURE");
    }

    // --------------------------------------
    // WRITES
    // --------------------------------------

    /// @inheritdoc IDelegatable
    function contractInvoke(Invocation[] calldata batch)
        external
        override
        returns (bool)
    {
        return _invoke(batch, msg.sender);
    }

    /// @inheritdoc IDelegatable
    function invoke(SignedInvocation[] calldata signedInvocations)
        external
        override
        returns (bool success)
    {
        for (uint256 i = 0; i < signedInvocations.length; i++) {
            SignedInvocation calldata signedInvocation = signedInvocations[i];
            address invocationSigner = verifyInvocationSignature(
                signedInvocation
            );
            _enforceReplayProtection(
                invocationSigner,
                signedInvocations[i].invocations.replayProtection
            );
            _invoke(signedInvocation.invocations.batch, invocationSigner);
        }
    }

    /* ===================================================================================== */
    /* Internal Functions                                                                    */
    /* ===================================================================================== */
}
