//SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import "hardhat/console.sol";
import "../DelegatableCore.sol";
import {ReplayProtection} from "../TypesAndDecoders.sol";

contract MockDelegatableCore is DelegatableCore {
    /// @notice The hash of the domain separator used in the EIP712 domain hash.
    bytes32 public immutable domainHash;

    constructor(string memory contractName) {
        domainHash = getEIP712DomainHash(
            contractName,
            "1",
            block.chainid,
            address(this)
        );
    }

    /* ===================================================================================== */
    /* Helper Functions                                                                    */
    /* ===================================================================================== */
    function updateNonce(
        address intendedSender,
        uint256 queue,
        uint256 nonce
    ) internal {
        multiNonce[intendedSender][queue] = nonce;
    }

    function exec() external view returns (address) {
        return _msgSender();
    }

    address public specialSender;

    function execFrom(address sender) external returns (address) {
        specialSender = sender;
        bytes memory data;
        _execute(address(this), data, uint256(21000000), sender);
    }

    fallback() external payable {
        specialSender = _msgSender();
    }

    /* ===================================================================================== */
    /* Core Functions                                                                    */
    /* ===================================================================================== */

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
        override(DelegatableCore)
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

    function invoke(Invocation[] calldata batch, address sender)
        external
        returns (bool success)
    {
        _invoke(batch, sender);
    }

    function enforceReplayProtection(
        address intendedSender,
        ReplayProtection memory protection
    ) external {
        _enforceReplayProtection(intendedSender, protection);
    }

    function execute(
        address to,
        bytes memory data,
        uint256 gasLimit,
        address sender
    ) internal returns (bool success) {
        return _execute(to, data, gasLimit, sender);
    }
}
