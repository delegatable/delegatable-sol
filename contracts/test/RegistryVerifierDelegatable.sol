//SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../Delegatable.sol";

interface IRegistry {
    function isTrustAnchor(address _address) external view returns (bool);
}

contract RegistryVerifierDelegatable is Delegatable, Ownable {
    address public immutable registry;

    constructor(string memory name, address _registry) Delegatable(name, "1") {
        registry = _registry;
    }

    string public purpose = "What is my purpose?";

    function setPurpose(string calldata newPurpose) external onlyOwner {
        purpose = newPurpose;
    }

    function _beforeSingleInvoke(Invocation[] calldata batch, address sender)
        internal
        override(DelegatableCore)
    {
        for (uint256 x = 0; x < batch.length; x++) {
            Invocation memory invocation = batch[x];
            for (uint256 d = 0; d < invocation.authority.length; d++) {
                SignedDelegation memory signedDelegation = invocation.authority[
                    d
                ];
                address delegationSigner = verifyDelegationSignature(
                    signedDelegation
                );
                require(
                    IRegistry(registry).isTrustAnchor(delegationSigner),
                    "verifier:not-registered"
                );
            }
        }
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
