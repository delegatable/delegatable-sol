//SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../Delegatable.sol";

contract MockDelegatable is Delegatable, Ownable {
    string public purpose = "What is my purpose?";

    constructor(string memory contractName) Delegatable(contractName, "1") {}

    function setPurpose(string memory purpose_) public onlyOwner {
        purpose = purpose_;
    }

    function alwaysFail() public pure {
        revert("I always fail");
    }

    function _msgSender()
        internal
        view
        virtual
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
