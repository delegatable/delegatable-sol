//SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

contract Registry is AccessControl {
    bytes32 public constant TRUST_CONTROLLER_ROLE =
        keccak256("TRUST_CONTROLLER_ROLE");
    mapping(address => bool) private _isTrusted;

    constructor(address admin, address trustController) {
        _setupRole(DEFAULT_ADMIN_ROLE, admin);
        _setupRole(TRUST_CONTROLLER_ROLE, trustController);
    }

    function isTrustAnchor(address _address) public view returns (bool) {
        return _isTrusted[_address];
    }

    function addTrustAnchor(address _trustAnchor) public {
        require(
            hasRole(TRUST_CONTROLLER_ROLE, _msgSender()),
            "Registry:unauthorized"
        );
        _isTrusted[_trustAnchor] = true;
    }

    function removeTrustAnchor(address _trustAnchor) public {
        require(
            hasRole(TRUST_CONTROLLER_ROLE, _msgSender()),
            "Registry:unauthorized"
        );
        _isTrusted[_trustAnchor] = false;
    }

    function grantTrustControllerRole(address trustController)
        external
        virtual
    {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, _msgSender()),
            "Registry:unauthorized"
        );
        grantRole(TRUST_CONTROLLER_ROLE, trustController);
    }

    function revokeTrustControllerRole(address trustController)
        external
        virtual
    {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, _msgSender()),
            "Registry:unauthorized"
        );
        revokeRole(TRUST_CONTROLLER_ROLE, trustController);
    }
}
