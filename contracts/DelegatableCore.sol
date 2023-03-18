// SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

import {EIP712Decoder, EIP712DOMAIN_TYPEHASH} from "./TypesAndDecoders.sol";
import {Delegation, Invocation, Invocations, SignedInvocation, SignedDelegation, Transaction, ReplayProtection, CaveatEnforcer} from "./CaveatEnforcer.sol";

abstract contract DelegatableCore is EIP712Decoder {
    /// @notice Account delegation nonce manager

    mapping(address => mapping(uint128 => uint128)) internal multiNonce;

    function getNonce(address intendedSender, uint128 queue)
        external
        view
        returns (uint128)
    {
        return multiNonce[intendedSender][queue];
    }

    function _enforceReplayProtection(
        address intendedSender,
        ReplayProtection memory protection
    ) internal {
        uint128 queue = protection.queue;
        uint128 nonce = protection.nonce;
        require(
            nonce == (multiNonce[intendedSender][queue] + 1),
            "DelegatableCore:nonce2-out-of-order"
        );
        multiNonce[intendedSender][queue] = nonce;
    }

    // Add a mapping to store the remaining gas limit for each Delegation
    mapping(bytes32 => uint256) public delegationRemainingGas;
    mapping(bytes32 => bool) public gasLimitHasBeenSet;

    /**
     * validate the signature is valid for this message.
     * @param userOp validate the userOp.signature field
     * @param userOpHash convenient field: the hash of the request, to check the signature against
     *          (also hashes the entrypoint and chain id)
     * @return validationData signature and time-range of this operation
     *      <20-byte> sigAuthorizer - 0 for valid signature, 1 to mark signature failure,
     *         otherwise, an address of an "authorizer" contract.
     *      <6-byte> validUntil - last timestamp this operation is valid. 0 for "indefinite"
     *      <6-byte> validAfter - first timestamp this operation is valid
     *      If the account doesn't use time-range, it is enough to return SIG_VALIDATION_FAILED value (1) for signature failure.
     *      Note that the validation code cannot use block.timestamp (or block.number) directly.
     */
  function _validateSignature(UserOperation calldata userOp, bytes32 userOpHash)
    internal virtual returns (uint256 validationData)
    {
        _requireFromEntryPoint();

        // Decode delegations
        SignedDelegation[] memory delegations = decodeDelegationArray(userOp.signature);

        address intendedSender = userOp.sender;
        address canGrant = intendedSender;
        bytes32 authHash = 0x0;

        for (uint256 d = 0; d < delegations.length; d++) {
            SignedDelegation memory signedDelegation = delegations[d];
            address delegationSigner = verifyDelegationSignature(signedDelegation);

            require(
                delegationSigner == canGrant,
                "DelegatableCore:invalid-delegation-signer"
            );

            Delegation memory delegation = signedDelegation.delegation;
            require(
                delegation.authority == authHash,
                "DelegatableCore:invalid-authority-delegation-link"
            );

            bytes32 delegationHash = GET_SIGNEDDELEGATION_PACKETHASH(signedDelegation);

            // Check remaining gas limit
            uint256 remainingGas = remainingGasLimits[delegationHash];

            if (!gasLimitHasBeenSet[delegationHash]) {
                gasLimitHasBeenSet[delegationHash] = true;
                remainingGas = delegation.gasLimit;
                remainingGasLimits[delegationHash] = remainingGas;
            }

            require(
                remainingGas >= userOp.transaction.gasLimit,
                "DelegatableCore:delegation-gas-limit-exceeded"
            );

            // Update remaining gas limit
            remainingGasLimits[delegationHash] = remainingGas - userOp.transaction.gasLimit;

            // Store the hash of this delegation in `authHash`
            // That way the next delegation can be verified against it.
            authHash = delegationHash;
            canGrant = delegation.delegate;
        }

        // // Perform validation checks
        // bool isValid = /* perform validation checks */;

        // address sigAuthorizer = isValid ? address(0) : address(1);
        // uint48 validUntil = 0; // Set validUntil to indefinite (0)
        // uint48 validAfter = 0; // Set validAfter to 0

        // // Pack validationData as specified in the return description
        // validationData = uint256(uint160(sigAuthorizer))
        //     | (uint256(validUntil) << 160)
        //     | (uint256(validAfter) << 208);
        return;
        // TODO: Return the validation check info. Maybe add time range to the schema.
    }

    /**
     * ensure the request comes from the known entrypoint.
     */
    function _requireFromEntryPoint() internal virtual view {
        require(msg.sender == address(entryPoint()), "account: not from EntryPoint");
    }

    function executeOp(UserOperation calldata op) internal returns (bool success) {
        _requireFromEntryPoint();

        success = _execute(op);
        require(success, "DelegatableCore::execution-failed");
    }

    function _execute(UserOperation memory userOp) internal returns (bool success) {
        bytes memory full = abi.encodePacked(userOp.callData, userOp.sender);
        bytes memory errorMessage;

        (success, errorMessage) = address(userOp.sender).call{gas: userOp.callGasLimit}(full);

        if (!success) {
            if (errorMessage.length > 0) {
                string memory reason = extractRevertReason(errorMessage);
                revert(reason);
            } else {
                revert("DelegatableCore::execution-failed");
            }
        }
    }

    function extractRevertReason(bytes memory revertData)
        internal
        pure
        returns (string memory reason)
    {
        uint l = revertData.length;
        if (l < 68) return "";
        uint t;
        assembly {
            revertData := add(revertData, 4)
            t := mload(revertData) // Save the content of the length slot
            mstore(revertData, sub(l, 4)) // Set proper length
        }
        reason = abi.decode(revertData, (string));
        assembly {
            mstore(revertData, t) // Restore the content of the length slot
        }
    }

    function _msgSender() internal view virtual returns (address sender) {
        if (msg.sender == address(this)) {
            bytes memory array = msg.data;
            uint index = msg.data.length;
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

    // EIP 4337 Methods
    struct UserOperation {
        address sender;
        uint256 nonce;
        bytes initCode;
        bytes callData;
        uint256 callGasLimit;
        uint256 callGasLimit;
        uint256 verificationGasLimit;
        uint256 preVerificationGas;
        uint256 maxFeePerGas;
        uint256 maxPriorityFeePerGas;
        bytes paymasterAndData;
        bytes signature;
    }

    /**
     * Validate user's signature and nonce.
     * subclass doesn't need to override this method. Instead, it should override the specific internal validation methods.
     */
    function validateUserOp(UserOperation calldata userOp, bytes32 userOpHash, uint256 missingAccountFunds)
    external override virtual returns (uint256 validationData) {
        _requireFromEntryPoint();
        validationData = _validateSignature(userOp);
        if (userOp.initCode.length == 0) {
            _validateAndUpdateNonce(userOp);
        }
        _payPrefund(missingAccountFunds);
    }

    /**
     * validate the current nonce matches the UserOperation nonce.
     * then it should update the account's state to prevent replay of this UserOperation.
     * called only if initCode is empty (since "nonce" field is used as "salt" on account creation)
     * @param userOp the op to validate.
     */
    function _validateAndUpdateNonce(UserOperation calldata userOp) internal virtual {
        uint128 queue = uint128(userOp.nonce >> 128); // Shift the input right by 128 bits to get the upper 128 bits
        uint128 desiredNonce = uint128(userOp.nonce); // Cast the input to uint128 to get the lower 128 bits (masking the upper bits)
        uint128 currentNonce = multiNonce[msg.sender][queue];
        require(desiredNonce == currentNonce + 1, "account: nonce mismatch");
    }


    function encodeDelegationArray(Delegation[] memory delegationArray) public pure returns (bytes memory encodedDelegationArray) {
        encodedDelegationArray = abi.encode(delegationArray);
    }

    function decodeDelegationArray(bytes memory encodedDelegationArray) public pure returns (SignedDelegation[] memory delegationArray) {
        delegationArray = abi.decode(encodedDelegationArray, (SignedDelegation[]));
    }

    // EIP 1271 Methods:
    bytes4 constant internal MAGICVALUE = 0x1626ba7e;

    function isValidSignature(bytes32 _hash, bytes memory _signature)
        public
        view
        returns (bytes4 magicValue)
    {
        address owner = /* Get the contract's owner address */;

        if (_isContract(owner)) {
            // Proxy the call to the contract's owner
            (bool success, bytes memory result) = owner.staticcall(
                abi.encodeWithSelector(
                    this.isValidSignature.selector,
                    _hash,
                    _signature
                )
            );

            if (success && result.length == 32) {
                return abi.decode(result, (bytes4));
            } else {
                return bytes4(0); // Return an invalid magic value
            }
        } else {
            // Validate the signature as if the owner is an externally owned account
            if (_hash.recover(_signature) == owner) {
                return MAGICVALUE;
            } else {
                return bytes4(0); // Return an invalid magic value
            }
        }
    }

    function _isContract(address addr) private view returns (bool) {
        uint256 size;
        assembly {
            size := extcodesize(addr)
        }
        return size > 0;
    }

}
