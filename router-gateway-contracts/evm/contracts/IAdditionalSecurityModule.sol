// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/**
 * @dev IAdditionalSecurityModule flow Interface.
 */
interface IAdditionalSecurityModule {
    function verifyCrossChainRequest(
        uint256 requestIdentifier,
        uint256 requestTimestamp,
        string calldata requestSender,
        string calldata srcChainId,
        bytes calldata packet,
        address handler
    ) external returns (bool);
}
