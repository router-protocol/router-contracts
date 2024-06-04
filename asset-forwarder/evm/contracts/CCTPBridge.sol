// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./ReentrancyGuard.sol";
import "./interfaces/ICCTPBridge.sol";
import "./interfaces/IWETH.sol";
import "./interfaces/ITokenMessenger.sol";
import "./interfaces/IMessageHandler.sol";
import "./MultiCaller.sol";

contract CCTPBridge is
    AccessControl,
    ReentrancyGuard,
    Pausable,
    ICCTPBridge,
    MultiCaller
{
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    address private constant NATIVE_ADDRESS =
        0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    IDexSpan public dexspan;
    // address of USDC
    address public usdc;
    // USDC token messenger
    ITokenMessenger public tokenMessenger;
    mapping(bytes32 => DestDetails) public destDetails;

    bytes32 public constant RESOURCE_SETTER = keccak256("RESOURCE_SETTER");
    bytes32 public constant PAUSER = keccak256("PAUSER");

    constructor(
        address _usdcAddress,
        address _tokenMessenger,
        address _dexspan
    ) {
        tokenMessenger = ITokenMessenger(_tokenMessenger);
        usdc = _usdcAddress;
        dexspan = IDexSpan(_dexspan);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(RESOURCE_SETTER, msg.sender);
        _grantRole(PAUSER, msg.sender);
    }

    function pause() external onlyRole(PAUSER) whenNotPaused {
        _pause();
    }

    /// @notice Unpauses deposits on the handler.
    /// @notice Only callable by an address that currently has the PAUSER role.
    function unpause() external onlyRole(PAUSER) whenPaused {
        _unpause();
    }

    /// @notice Function used to update resource
    /// @notice Only RESOURCE_SETTER can call this function
    function update(
        uint8 utype,
        address _address
    ) public onlyRole(RESOURCE_SETTER) {
        if (utype == 1) dexspan = IDexSpan(_address);
        else if (utype == 2) tokenMessenger = ITokenMessenger(_address);
        else if (utype == 3) usdc = _address;
        else revert ICCTPBridge.InvalidUpdateType();
    }

    function setDestDetails(
        bytes32[] memory _destChainIdBytes,
        DestDetails[] memory _destDetails
    ) public onlyRole(RESOURCE_SETTER) {
        if (_destChainIdBytes.length != _destDetails.length)
            revert UnequalLength();
        for (uint256 idx = 0; idx < _destDetails.length; idx++)
            destDetails[_destChainIdBytes[idx]] = _destDetails[idx];
    }

    function iDepositUSDC(
        uint256 partnerId,
        bytes32 destChainIdBytes,
        bytes32 recipient,
        uint256 amount
    )
        external
        payable
        nonReentrant
        whenNotPaused
        isValidRequest(destChainIdBytes)
    {
        IERC20(usdc).safeTransferFrom(msg.sender, address(this), amount);
        _depositForBurn(partnerId, destChainIdBytes, recipient, amount);
    }

    function swapAndIDepositUSDC(
        uint256 partnerId,
        bytes32 destChainIdBytes,
        bytes32 recipient,
        uint256 amount,
        IDexSpan.SwapPayload memory swapPayload
    )
        external
        payable
        nonReentrant
        whenNotPaused
        isValidRequest(destChainIdBytes)
    {
        // return token should be usdc token
        if (swapPayload.tokens[swapPayload.tokens.length - 1] != usdc)
            revert WrongReturnToken();

        uint256 value = 0;
        if (isNative(swapPayload.tokens[0])) {
            // left native after fee deduction
            uint256 lvalue = msg.value - destDetails[destChainIdBytes].fee;
            if (lvalue < amount) revert ICCTPBridge.InvalidAmount();
            value = amount;
        } else {
            IERC20(swapPayload.tokens[0]).safeTransferFrom(
                msg.sender,
                address(dexspan),
                amount
            );
        }

        uint256 returnAmount = dexspan.swapMultiWithRecipient{value: value}( // recipient will be address(this)
            swapPayload.tokens,
            amount,
            swapPayload.minToAmount,
            swapPayload.flags,
            swapPayload.dataTx,
            true,
            address(this)
        );
        _depositForBurn(partnerId, destChainIdBytes, recipient, returnAmount);
    }

    /// Modifiers

    modifier isValidRequest(bytes32 destChainIdBytes) {
        if (!destDetails[destChainIdBytes].isSet)
            revert ICCTPBridge.CCTPNotSupported();
        if (
            destDetails[destChainIdBytes].fee != 0 &&
            msg.value < destDetails[destChainIdBytes].fee
        ) revert ICCTPBridge.InvalidFee();
        _;
    }

    /// Internals

    function _depositForBurn(
        uint256 partnerId,
        bytes32 destChainIdBytes,
        bytes32 recipient,
        uint256 amount
    ) internal {
        IERC20(usdc).safeIncreaseAllowance(address(tokenMessenger), amount);
        uint64 nonce = tokenMessenger.depositForBurn(
            amount,
            destDetails[destChainIdBytes].domainId,
            recipient,
            usdc
        ); // it will emit event DepositForBurn, returns nonce
        emit iUSDCDeposited(
            partnerId,
            amount,
            destChainIdBytes,
            nonce,
            usdc,
            recipient,
            msg.sender
        );
    }

    // TODO: do we need this? We should not have it like this as this will
    // not be decentralized. We should have withdraw fees instead.
    function rescue(
        address token,
        uint256 amount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        if (isNative(NATIVE_ADDRESS)) {
            (bool success, ) = payable(msg.sender).call{value: amount}("");
            assert(success == true);
        } else {
            token.call(
                abi.encodeWithSignature(
                    "transfer(address,uint256)",
                    msg.sender,
                    amount
                )
            );
        }
    }

    function isNative(address token) internal pure returns (bool) {
        return token == NATIVE_ADDRESS;
    }
}
