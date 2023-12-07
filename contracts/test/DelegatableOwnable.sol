//SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../Delegatable.sol";

contract DelegatableOwnable is Delegatable, Ownable {
    constructor(string memory name) Delegatable(name, "1") {}

    string public purpose = "What is my purpose?";

    function setPurpose(string calldata newPurpose) external onlyOwner {
        purpose = newPurpose;
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
