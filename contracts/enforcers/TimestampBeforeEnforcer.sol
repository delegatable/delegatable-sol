//SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import "../CaveatEnforcer.sol";
import {BytesLib} from "../libraries/BytesLib.sol";

contract TimestampBeforeEnforcer is CaveatEnforcer {
    /**
     * @notice Allows the delegator to specify the latest timestamp the delegation will be valid.
     * @param terms - The latest timestamp this delegation is valid.
     * @param transaction - The transaction the delegate might try to perform.
     * @param delegationHash - The hash of the delegation being operated on.
     **/
    function enforceCaveat(
        bytes calldata terms,
        Transaction calldata transaction,
        bytes32 delegationHash
    ) public override returns (bool) {
        uint64 timestampThreshold = BytesLib.toUint64(terms, 0);
        if (timestampThreshold > block.timestamp) {
            return true;
        } else {
            revert("TimestampBeforeEnforcer:expired-delegation");
        }
    }
}
