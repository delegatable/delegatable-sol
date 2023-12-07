//SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import "../CaveatEnforcer.sol";
import {BytesLib} from "../libraries/BytesLib.sol";

contract BlockNumberEnforcer is CaveatEnforcer {
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
        uint128 logicOperator = BytesLib.toUint128(terms, 0);
        uint128 blockExpiration = BytesLib.toUint128(terms, 16);
        if (logicOperator == 0) {
            if (blockExpiration < block.number) {
                return true;
            } else {
                revert("BlockNumberEnforcer:expired-delegation");
            }
        } else {
            if (blockExpiration > block.number) {
                return true;
            } else {
                revert("BlockNumberEnforcer:early-delegation");
            }
        }
    }
}
