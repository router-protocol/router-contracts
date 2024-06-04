//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Faucet {
    using SafeERC20 for IERC20;

    address public owner;
    mapping(address => uint256) public tokenAmount;
    uint256 public timeLimit = 24 hours;
    mapping(address => mapping(address => uint256)) public lastSent;

    error InsufficientFunds(address tokenAddress);
    error TokenAlreadySent(address tokenAddress, address user);

    constructor(address[] memory tokens, uint256[] memory limits) {
        owner = msg.sender;

        assert(tokens.length == limits.length);

        for (uint256 index = 0; index < tokens.length; index++) {
            tokenAmount[tokens[index]] = limits[index];
        }
    }

    function whitelistToken(address[] calldata tokens, uint256[] calldata amounts) external {
        require(msg.sender == owner, "Only owner can whitelist tokens");
        require(tokens.length == amounts.length, "Arrays length mismatch");

        for (uint256 i = 0; i < tokens.length; i++) {
            tokenAmount[tokens[i]] = amounts[i];
        }
    }

    function updateTimeLimit(uint256 newTimeLimit) external {
        require(msg.sender == owner, "Only owner can update time limit");
        timeLimit = newTimeLimit;
    }

    function fetchBalance(address token) external view returns (uint256) {
        if(isNative(token)) {
            return (address(this).balance);
        }
        return IERC20(token).balanceOf(address(this));
    }

    function distributeToken(address tokenAddress) public payable {
        require(
            block.timestamp - lastSent[tokenAddress][msg.sender] >= timeLimit,
            "Time limit not reached"
        );
        
        uint256 currentBalance = this.fetchBalance(tokenAddress);
        uint256 tokenAmountToDistribute = tokenAmount[tokenAddress];

        if (tokenAmountToDistribute > currentBalance) {
            revert InsufficientFunds(tokenAddress);
        }

        if (isNative(tokenAddress)) {
            (bool success, ) = payable(msg.sender).call{value: tokenAmountToDistribute}("");
            require(success, "Native token transfer failed");
        } else {
            (bool success, ) = tokenAddress.call(
                abi.encodeWithSignature(
                    "transfer(address,uint256)",
                    msg.sender,
                    tokenAmountToDistribute
                )
            );
            require(success, "Token Transfer Failed");
        }
        
        lastSent[tokenAddress][msg.sender] = block.timestamp;
    }

    address private constant NATIVE_ADDRESS =
        0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    function isNative(address token) internal pure returns (bool) {
        return token == NATIVE_ADDRESS;
    }

    function withdrawFee(address payable token) external {
        require(msg.sender == owner, "Only owner can withdraw fees");
        
        uint256 fee = address(this).balance;
        if (!isNative(token)) {
            fee = IERC20(token).balanceOf(address(this));
        }

        if (isNative(token)) {
            (bool success, ) = payable(msg.sender).call{value: fee}("");
            require(success, "Native token transfer failed");
        } else {
            IERC20(token).safeTransfer(msg.sender, fee);
        }
    }

    receive() external payable {}
}
