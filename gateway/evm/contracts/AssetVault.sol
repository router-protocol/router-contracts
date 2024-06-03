//SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "./ERC20Token.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract AssetVault is ReentrancyGuard {
    address public immutable gateway;
    ERC20Token public immutable routeToken;

    constructor(address gatewayAddress, address routeTokenAddress) {
        gateway = gatewayAddress;
        routeToken = ERC20Token(routeTokenAddress);
    }

    event AssetBurned(uint256 amount, address indexed sender);
    event AssetMinted(uint256 amount, address indexed recipient);

    /// @notice function to deposit route token
    /// @param amount is the qty of Route token to burn
    /// @param caller is invoker of gateway contract
    function deposit(uint256 amount, address caller) external {
        require(msg.sender == gateway, "!Gateway");
        routeToken.burnFrom(caller, amount); // it any failure it will revert
        emit AssetBurned(amount, caller);
    }

    /// @notice function to withdraw route token
    /// @param amount is the qty of Route token to mint
    /// @param recipient is the address where router token will be transfered
    function handleWithdraw(uint256 amount, address recipient) external {
        require(msg.sender == gateway, "!Gateway");
        routeToken.mint(recipient, amount);
        emit AssetMinted(amount, recipient);
    }
}
