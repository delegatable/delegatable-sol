pragma solidity 0.8.15;
import "hardhat/console.sol";
import "../libraries/ECRecovery.sol";

//SPDX-License-Identifier: MIT

contract EIP1271 is ECRecovery {
    mapping(address => bool) isOwner;

    constructor() {
        isOwner[msg.sender] = true;
    }

    function addOwner(address _owner) public {
        isOwner[_owner] = true;
    }

    /**
     * @notice Verifies that the signer is the owner of the signing contract.
     */
    function isValidSignature(bytes32 _hash, bytes calldata _signature)
        external
        view
        returns (bytes4)
    {
        console.log("Recovered signer to be %s", recover(_hash, _signature));
        if (isOwner[recover(_hash, _signature)]) {
            console.log("an owner.");
            return 0x1626ba7e;
        } else {
            console.log("Not an owner.");
            return 0xffffffff;
        }
    }

}
