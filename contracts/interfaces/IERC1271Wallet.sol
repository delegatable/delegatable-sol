//SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import "../CaveatEnforcer.sol";

interface IERC1271Wallet {
    function isValidSignature(bytes32 _hash, bytes calldata _signature)
        external
        view
        returns (bytes4);
}
