pragma solidity 0.8.15;
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
        if (isOwner[recover(_hash, _signature)]) {
            return 0x1626ba7e;
        } else {
            return 0xffffffff;
        }
    }
}
