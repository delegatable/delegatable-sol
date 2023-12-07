//SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import "../TypesAndDecoders.sol";

interface IDelegatable {
    /**
     * @notice Allows a smart contract to submit a batch of invocations for processing, allowing itself to be the delegate.
     * @param batch Invocation[] - The batch of invocations to process.
     * @return success bool - Whether the batch of invocations was successfully processed.
     */
    function contractInvoke(Invocation[] calldata batch)
        external
        returns (bool);

    /**
     * @notice Allows anyone to submit a batch of signed invocations for processing.
     * @param signedInvocations SignedInvocation[] - The batch of signed invocations to process.
     * @return success bool - Whether the batch of invocations was successfully processed.
     */
    function invoke(SignedInvocation[] calldata signedInvocations)
        external
        returns (bool success);

    /**
     * @notice Returns the typehash for this contract's delegation signatures.
     * @param delegation Delegation - The delegation to get the type of
     * @return bytes32 - The type of the delegation
     */
    function getDelegationTypedDataHash(Delegation memory delegation)
        external
        view
        returns (bytes32);

    /**
     * @notice Returns the typehash for this contract's invocation signatures.
     * @param invocations Invocations
     * @return bytes32 - The type of the Invocations
     */
    function getInvocationsTypedDataHash(Invocations memory invocations)
        external
        view
        returns (bytes32);

    function getEIP712DomainHash(
        string memory contractName,
        string memory version,
        uint256 chainId,
        address verifyingContract
    ) external pure returns (bytes32);

    /**
     * @notice Verifies that the given invocation is valid.
     * @param signedInvocation - The signed invocation to verify
     * @return address - The address of the account authorizing this invocation to act on its behalf.
     */
    function verifyInvocationSignature(SignedInvocation memory signedInvocation)
        external
        view
        returns (address);

    /**
     * @notice Verifies that the given delegation is valid.
     * @param signedDelegation - The delegation to verify
     * @return address - The address of the account authorizing this delegation to act on its behalf.
     */
    function verifyDelegationSignature(SignedDelegation memory signedDelegation)
        external
        view
        returns (address);
}
