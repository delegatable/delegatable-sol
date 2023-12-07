//SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import "./TypesAndDecoders.sol";

abstract contract CaveatEnforcer {
    function enforceCaveat(
        bytes calldata terms,
        Transaction calldata tx,
        bytes32 delegationHash
    ) public virtual returns (bool);
}
