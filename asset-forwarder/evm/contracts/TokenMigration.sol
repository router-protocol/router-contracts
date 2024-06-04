// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract TokenMigration is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;
    IERC20 public immutable OLD_TOKEN;
    IERC20 public immutable NEW_TOKEN;

    uint256 public mutiplier;
    uint256 public constant divider = 10000;

    constructor(address oldToken, address newToken, uint256 _multiplier) {
        mutiplier = _multiplier;
        OLD_TOKEN = IERC20(oldToken);
        NEW_TOKEN = IERC20(newToken);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function deposit(uint256 amount) external nonReentrant {
        uint256 newAmount = (amount * mutiplier) / divider;
        OLD_TOKEN.safeTransferFrom(msg.sender, address(this), amount);
        NEW_TOKEN.safeTransfer(msg.sender, newAmount);
    }

    function withdraw(
        IERC20 token,
        uint256 amount,
        address recipient
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        token.safeTransfer(recipient, amount);
    }

    function withdrawNativeToken(
        uint256 amount,
        address payable recipient
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        (bool sent, ) = recipient.call{value: amount}("");
        require(sent, "Transaction failed");
    }
}
