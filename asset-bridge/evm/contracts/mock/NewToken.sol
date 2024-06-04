// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract NewToken is ERC20 {
    uint8 private _decimals;

    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
        _decimals = decimals_;
        // only for testing purposes
        _mint(msg.sender, 1000000000000000000000000);
    }

    /// @notice Fetches decimals
    /// @return Returns Value of decimals that is set
    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function deposit() external payable {
        _mint(msg.sender, msg.value);
    }
}
