//SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import "../CaveatEnforcer.sol";
import {BytesLib} from "../libraries/BytesLib.sol";

contract BlockNumberBeforeEnforcer is CaveatEnforcer {
    /**
     * @notice Allows the delegator to specify the latest block the delegation will be valid.
     * @param terms - The range of blocks this delegation is valid. See test for example.
     * @param transaction - The transaction the delegate might try to perform.
     * @param delegationHash - The hash of the delegation being operated on.
     */
    function enforceCaveat(
        bytes calldata terms,
        Transaction calldata transaction,
        bytes32 delegationHash
    ) public override returns (bool) {
        uint64 blockThreshold = BytesLib.toUint64(terms, 0);
        if (blockThreshold > block.number) {
            return true;
        } else {
            revert("BlockNumberBeforeEnforcer:expired-delegation");
        }
    }
}
