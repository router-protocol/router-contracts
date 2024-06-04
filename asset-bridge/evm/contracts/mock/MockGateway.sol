// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

contract MockGateway is
    Initializable,
    PausableUpgradeable,
    AccessControlUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable
{
    string public chainId;
    uint64 public eventNonce;
    uint256 public iSendDefaultFee;

    event ISendEvent(
        uint256 version,
        uint256 routeAmount,
        uint256 indexed eventNonce,
        address requestSender,
        string srcChainId,
        string destChainId,
        bytes routeRecipient,
        bytes requestMetadata,
        bytes requestPacket
    );

    function _authorizeUpgrade(address newImplementation) internal virtual override onlyRole(DEFAULT_ADMIN_ROLE) {}

    function initialize() external initializer {
        // ACTIONS
        __AccessControl_init();
        __Pausable_init();

        // Constructor Fx
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);

        chainId = "1";
        eventNonce = 1;
        iSendDefaultFee = 1000000000000000;
    }

    enum FeePayer {
        APP,
        USER,
        NONE
    }

    function iSend(
        uint256 version,
        uint256 routeAmount,
        bytes memory routeRecipient,
        string memory destChainId,
        bytes calldata requestMetadata,
        bytes calldata requestPacket
    ) external payable whenNotPaused returns (uint256) {
        // "fees too low" => "C03"
        require(msg.value >= iSendDefaultFee, "C03");

        if (routeAmount > 0) {
            // "empty recipient" => "C04"
            // keccak256("") = 0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470
            // TODO: Can we remove
            require(
                keccak256(routeRecipient) != 0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470,
                "C04"
            );

            // vault.deposit(routeAmount, msg.sender);
        }

        eventNonce++;

        emit ISendEvent(
            version,
            routeAmount,
            eventNonce,
            msg.sender,
            chainId,
            destChainId,
            routeRecipient,
            requestMetadata,
            requestPacket
        );

        return eventNonce;
    }

    function toBytes(address a) public pure returns (bytes memory b) {
        assembly {
            let m := mload(0x40)
            a := and(a, 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)
            mstore(add(m, 20), xor(0x140000000000000000000000000000000000000000, a))
            mstore(0x40, add(m, 52))
            b := m
        }
    }
}
