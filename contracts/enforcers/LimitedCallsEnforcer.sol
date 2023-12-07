//SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import {BytesLib} from "../libraries/BytesLib.sol";
import "../CaveatEnforcer.sol";

contract LimitedCallsEnforcer is CaveatEnforcer {
    mapping(address => mapping(bytes32 => uint256)) callCounts;

    /**
     * @notice Allows the delegator to specify a maximum number of times the recipient may perform transactions on their behalf.
     * @param terms - The maximum number of times the delegate may perform transactions on their behalf.
     * @param transaction - The transaction the delegate might try to perform.
     * @param delegationHash - The hash of the delegation being operated on.
     */
    function enforceCaveat(
        bytes calldata terms,
        Transaction calldata transaction,
        bytes32 delegationHash
    ) public override returns (bool) {
        uint256 limit = BytesLib.toUint256(terms, 0);
        uint256 callCount = callCounts[msg.sender][delegationHash];
        require(callCount < limit, "LimitedCallsEnforcer:limit-exceeded");
        callCounts[msg.sender][delegationHash]++;
        return true;
    }
}
