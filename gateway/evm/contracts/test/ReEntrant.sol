// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "../IGateway.sol";
import "../IDapp.sol";
import "hardhat/console.sol";

contract ReEntrant is IDapp {
    address public owner;
    IGateway public gatewayContract;
    string public greeting;
    uint256 eventIdentifier;

    event RequestFromRouterEvent(string indexed srcContractAddress, bytes data);

    constructor(address payable gatewayAddress) {
        owner = msg.sender;
        gatewayContract = IGateway(gatewayAddress);
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

    function sendStringPayloadToRouter(
        string memory sampleString,
        string memory destContractAddress
    ) external payable {
        console.logString(sampleString);
        bytes memory stringPaylaod = abi.encode(sampleString);
        bytes memory requestPacket = abi.encode(destContractAddress, stringPaylaod);
        bytes memory requestMetadata = getRequestMetadata(
            1000000, 
            uint64(0), 
            1000000, 
            uint64(0),
            100000000000000000,
            uint8(0), 
            false, 
            ""
        );

        eventIdentifier = gatewayContract.iSend{value: msg.value}(
            1,
            0,
            "0x",
            "9000",
            requestMetadata,
            requestPacket
        );
    }

    function sendRequestToRouter(
        string calldata destChainId,
        string calldata destContractAddress,
        string memory str
    ) public payable {

        bytes memory payload = abi.encode(str);
        bytes memory requestPacket = abi.encode(destContractAddress, payload);

        bytes memory requestMetadata = getRequestMetadata(
            1000000, 
            uint64(0), 
            1000000, 
            uint64(0),
            100000000000000000,
            uint8(0), 
            false, 
            ""
        );

        gatewayContract.iSend{value: msg.value}(
            1,
            0,
            "0x",
            destChainId,
            requestMetadata,
            requestPacket
        );
    }

    function iReceive(
        string memory srcContractAddress,
        bytes memory packet,
        string memory //srcChainId
    ) external returns (bytes memory) {
        // This check is to ensure that the contract is called from the Gateway only.
        require(msg.sender == address(gatewayContract));
        string memory sampleStr = abi.decode(packet, (string));

        require(keccak256(abi.encodePacked(sampleStr)) != keccak256(abi.encodePacked("")));
        greeting = sampleStr;

        if (keccak256(abi.encodePacked(sampleStr)) == keccak256(abi.encodePacked("Hello RE-ENTRANCY"))) {
            this.sendStringPayloadToRouter(sampleStr, srcContractAddress);
        }
        emit RequestFromRouterEvent(srcContractAddress, packet);
        return abi.encode(sampleStr);
    }

    function iAck(uint256 requestIdentifier, bool execFlag, bytes memory execData) external {}

    receive() external payable {}
}
