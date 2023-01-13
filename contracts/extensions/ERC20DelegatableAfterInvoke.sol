//SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../Delegatable.sol";

contract ERC20DelegatableAfterInvoke is ERC20, Delegatable {
    address public owner;

    constructor(
        address _owner,
        string memory name,
        string memory symbol,
        uint256 amount
    ) Delegatable(name, "1") ERC20(name, symbol) {
        owner = _owner;
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

    function _afterInvoke(SignedInvocation[] calldata signedInvocations)
        internal
        override
    {
        address _owner = owner;
        bool ownerFound = false;
        for (uint256 i = 0; i < signedInvocations.length; i++) {
            SignedDelegation memory firstSignedDelegation = signedInvocations[i]
                .invocations
                .batch[0]
                .authority[0];
            address firstDelegationSigner = verifyDelegationSignature(
                firstSignedDelegation
            );
            if (firstDelegationSigner == _owner) {
                ownerFound = true;
                break;
            }
        }
        if (!ownerFound) {
            revert(
                "ERC20DelegatableAfterInvoke:no first delegator is owner"
            );
        }
    }
}
