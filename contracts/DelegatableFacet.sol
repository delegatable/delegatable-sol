// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

// import "hardhat/console.sol";
import {EIP712DOMAIN_TYPEHASH} from "./TypesAndDecoders.sol";
import {Delegation, Invocation, Invocations, SignedInvocation, SignedDelegation} from "./CaveatEnforcer.sol";
import {DelegatableCore} from "./DelegatableCore.sol";
import {IDelegatable} from "./interfaces/IDelegatable.sol";

/* @notice AppStorage is used so ERC2535 Diamond facets do not clobber each others' storage.
 * https://eip2535diamonds.substack.com/p/keep-your-data-right-in-eip2535-diamonds?utm_source=substack&utm_campaign=post_embed&utm_medium=web
 */
struct AppStorage {
    bytes32 eip712domainTypeHash;
}

contract DelegatableFacet is IDelegatable, DelegatableCore {
    AppStorage internal s;

    /* ===================================================================================== */
    /* External Functions                                                                    */
    /* ===================================================================================== */

    /**
     * @notice Typehash Initializer - To be called by a diamond after facet assignment.
     * Yes, anyone can assign the facet's own name, but it doesn't do anything, so it's fine.
     */
    function setDomainHash(string calldata contractName) public {
        s.eip712domainTypeHash = getEIP712DomainHash(
            contractName,
            "1",
            block.chainid,
            address(this)
        );
    }

    /**
     * @notice Domain Hash Getter
     * @return bytes32 - The domain hash of the calling contract.
     */
    function getEIP712DomainHash() public view returns (bytes32) {
        bytes32 domainHash = s.eip712domainTypeHash;
        require(domainHash != 0, "Domain hash not set");
        return domainHash;
    }

    /// @inheritdoc IDelegatable
    function getDelegationTypedDataHash(Delegation memory delegation)
        public
        view
        returns (bytes32)
    {
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                getEIP712DomainHash(),
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
                getEIP712DomainHash(),
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

    function verifyDelegationSignature(SignedDelegation memory signedDelegation)
        public
        view
        virtual
        override(IDelegatable, DelegatableCore)
        returns (address)
    {
        Delegation memory delegation = signedDelegation.delegation;
        bytes32 sigHash = getDelegationTypedDataHash(delegation);
        address recoveredSignatureSigner = recover(
            sigHash,
            signedDelegation.signature
        );
        return recoveredSignatureSigner;
    }

    function verifyInvocationSignature(SignedInvocation memory signedInvocation)
        public
        view
        returns (address)
    {
        bytes32 sigHash = getInvocationsTypedDataHash(
            signedInvocation.invocations
        );
        address recoveredSignatureSigner = recover(
            sigHash,
            signedInvocation.signature
        );
        return recoveredSignatureSigner;
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
            success = _invoke(
                signedInvocation.invocations.batch,
                invocationSigner
            );
        }
    }

    /*
     * @notice Overrides the msgSender to enable delegation message signing.
     * @returns address - The account whose authority is being acted on.
     */
    function _msgSender()
        internal
        view
        virtual
        override(DelegatableCore)
        returns (address sender)
    {
        if (msg.sender == address(this)) {
            bytes memory array = msg.data;
            uint256 index = msg.data.length;
            assembly {
                sender := and(
                    mload(add(array, index)),
                    0xffffffffffffffffffffffffffffffffffffffff
                )
            }
        } else {
            sender = msg.sender;
        }
        return sender;
    }

    /* ===================================================================================== */
    /* Internal Functions                                                                    */
    /* ===================================================================================== */
}
