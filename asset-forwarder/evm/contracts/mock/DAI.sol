// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract DAI is Initializable, ERC20Upgradeable, OwnableUpgradeable {
    function initialize() external initializer {
        __ERC20_init("DAI Token", "DAI");
        __Ownable_init();
    }

    function faucet(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
