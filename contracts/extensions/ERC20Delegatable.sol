//SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../Delegatable.sol";

contract ERC20Delegatable is ERC20, Delegatable {
    constructor(
        string memory name,
        string memory symbol,
        uint256 amount
    ) Delegatable(name, "1") ERC20(name, symbol) {
        _mint(msg.sender, amount);
    }

    function _msgSender()
        internal
        view
        override(DelegatableCore, Context)
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
}
