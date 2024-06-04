// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../dexspan/interface/IDexSpan.sol";

/// @title Interface for handler contracts that support deposits and deposit executions.
/// @author Router Protocol.
interface ICCTPBridge {
    error InvalidFee();
    error CCTPNotSupported();
    error WrongReturnToken();
    error UnequalLength();
    error InvalidUpdateType();
    error InvalidAmount();

    event iUSDCDeposited(
        uint256 partnerId,
        uint256 amount,
        bytes32 destChainIdBytes,
        uint256 usdcNonce,
        address srcToken,
        bytes32 recipient,
        address depositor
    );

    struct DestDetails {
        uint32 domainId;
        uint256 fee;
        bool isSet;
    }

    function iDepositUSDC(
        uint256 partnerId,
        bytes32 destChainIdBytes,
        bytes32 recipient,
        uint256 amount
    ) external payable;

    function swapAndIDepositUSDC(
        uint256 partnerId,
        bytes32 destChainIdBytes,
        bytes32 recipient,
        uint256 amount,
        IDexSpan.SwapPayload memory swapPayload
    ) external payable;
}
