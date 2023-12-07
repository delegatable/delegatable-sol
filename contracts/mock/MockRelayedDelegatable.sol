//SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../Delegatable.sol";

contract MockRelayedDelegatable is Ownable {
    string public purpose = "What is my purpose?";
    address public trustedRelay;

    constructor(address _trustedRelay) {
        trustedRelay = _trustedRelay;
    }

    function setPurpose(string memory purpose_) public onlyOwner {
        purpose = purpose_;
    }

    function _msgSender()
        internal
        view
        virtual
        override(Context)
        returns (address sender)
    {
        if (msg.sender == trustedRelay) {
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
