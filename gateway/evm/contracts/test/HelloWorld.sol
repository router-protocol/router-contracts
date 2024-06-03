// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../IGateway.sol";
import "../IDapp.sol";
import "../Utils.sol";
import "hardhat/console.sol";

contract HelloWorld is IDapp {
    using SafeERC20 for IERC20;
    address public owner;
    IGateway public gatewayContract;
    string public greeting;
    uint256 public lastEventIdentifier;
    string public ackMessage;
    IERC20 public routeToken;
    address public assetVault;

    // for testing read query purposes
    uint256 public constant number = 20;

    event RequestFromRouterEvent(string indexed bridgeContract, bytes data);

    error CustomError(string message);

    constructor(address payable gatewayAddress, address routeTokenAddress, address assetVaultAddress) {
        owner = msg.sender;
        gatewayContract = IGateway(gatewayAddress);
        routeToken = IERC20(routeTokenAddress);
        assetVault = assetVaultAddress;
    }

    function setDappMetadata(string memory feePayerAddress) external {
        require(msg.sender == owner, "only owner");
        gatewayContract.setDappMetadata(feePayerAddress);
    }

    function getRequestMetadata(
        uint64 gasLimit, 
        uint64 gasPrice,
        uint64 ackGasLimit, 
        uint64 ackGasPrice,
        uint128 relayerFees,
        uint8 ackType,
        bool isReadCall,
        string memory asmAddress 
    ) public pure returns (bytes memory) {
        return abi.encodePacked(
            gasLimit,
            gasPrice,
            ackGasLimit,
            ackGasPrice,
            relayerFees,
            ackType,
            isReadCall,
            asmAddress
        );
    }

    function iSend(
        uint256 routeAmount,
        string calldata routeRecipient,
        string calldata destChainId,
        string calldata destContractAddress,
        uint8 ackType,
        uint128 relayerFees
    ) external payable {
        routeToken.safeTransferFrom(msg.sender, address(this), routeAmount);
        routeToken.safeIncreaseAllowance(assetVault, routeAmount);

        bytes memory payload = abi.encode("Hello Router");

        bytes memory requestMetadata = getRequestMetadata(
            1000000, 
            uint64(0), 
            1000000, 
            uint64(0),
            relayerFees,
            ackType, 
            false, 
            ""
        );

        bytes memory requestPacket = abi.encode(destContractAddress, payload);

        lastEventIdentifier = gatewayContract.iSend{value: msg.value}(
            1,
            routeAmount,
            routeRecipient,
            destChainId,
            requestMetadata,
            requestPacket
        );
    }

    function iReceive(
        string memory srcContractAddress,
        bytes memory packet,
        string memory srcChainId
    ) external returns (bytes memory) {
        require(msg.sender == address(gatewayContract));

        string memory sampleStr = abi.decode(packet, (string));

        if (keccak256(bytes(sampleStr)) == keccak256(bytes(""))) {
            revert CustomError("String should not be empty");
        }

        greeting = sampleStr;
        return abi.encode(sampleStr);
    }

    function iAck(uint256 eventIdentifier, bool execFlag, bytes memory execData) external {
        ackMessage = abi.decode(execData, (string));
    }

    receive() external payable {}
}
