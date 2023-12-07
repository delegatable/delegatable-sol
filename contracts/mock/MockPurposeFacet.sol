//SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import "../Delegatable.sol";
import "../diamond/libraries/LibDiamond.sol";

struct AppStorage {
    string purpose;
}

contract MockPurposeFacet {
    AppStorage internal s;

    function purpose() public view returns (string memory) {
        return s.purpose;
    }

    function setPurpose(string memory purpose_) public {
        LibDiamond.enforceIsContractOwner();
        s.purpose = purpose_;
    }
}
