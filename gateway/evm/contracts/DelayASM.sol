// SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.18;

import "./IAdditionalSecurityModule.sol";

// Delay ASM
contract DelayASM is IAdditionalSecurityModule {
    mapping(bytes32 => bool) public delayedTransfers;
    address public immutable gatewayContract;
    uint256 public delayPeriod;
    address public immutable owner;
    string public appRouterBridgeAddress;

    constructor(address gatewayAddress, uint256 _delayPeriod, string memory _routerBridgeAddress) {
        gatewayContract = gatewayAddress;
        owner = msg.sender;
        delayPeriod = _delayPeriod;
        appRouterBridgeAddress = _routerBridgeAddress;
    }

    function setDelayPeriod(uint256 _delayPeriod) external {
        require(msg.sender == owner, "Caller is not owner");
        delayPeriod = _delayPeriod;
    }

    function rejectRequest(bytes32 id) external {
        require(msg.sender == owner);
        delayedTransfers[id] = true;
    }

    function verifyCrossChainRequest(
        uint256 requestIdentifier,
        uint256 requestTimestamp,
        string calldata requestSender,
        string calldata srcChainId,
        bytes calldata packet,
        address handler
    ) external view returns (bool) {
        require(msg.sender == gatewayContract, "Caller is not gateway");
        bytes32 id = keccak256(
            abi.encode(requestIdentifier, requestTimestamp, requestSender, srcChainId, packet, handler)
        );
        if (delayedTransfers[id]) {
            return false;
        }
        if (block.timestamp > requestTimestamp + delayPeriod) {
            return true;
        }
        revert("Transaction needs to be delayed");
    }
}
