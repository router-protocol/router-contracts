// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "./AssetVault.sol";
import "./SignatureUtils.sol";
import "./IDapp.sol";
import "./IAdditionalSecurityModule.sol";
import "./libraries/ValsetUpdate.sol";
import "./Utils.sol";

/**
    @title Facilitates request to Router, validator set update and request from router.
    @author Router Protocol
 */
contract GatewayUpgradeable is
    Initializable,
    PausableUpgradeable,
    AccessControlUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable
{
    using ValsetUpdate for Utils.ValsetArgs;
    bytes constant INVALID_REQUEST_RESPONSE = abi.encode(false, abi.encode(""));

    // bytes32 encoding of the string "checkpoint"
    bytes32 constant CHECK_POINT_METHOD_NAME = 0x636865636b706f696e7400000000000000000000000000000000000000000000;

    // bytes32 encoding of "iReceive"
    bytes32 constant IRECEIVE_METHOD_NAME = 0x6952656365697665000000000000000000000000000000000000000000000000;

    // bytes32 encoding of "iAck"
    bytes32 constant IACK_METHOD_NAME = 0x6941636b00000000000000000000000000000000000000000000000000000000;

    bytes32 public constant RESOURCE_SETTER = keccak256("RESOURCE_SETTER");
    bytes32 public constant PAUSER = keccak256("PAUSER");
    // storage
    string public chainId;
    // address of the vault contract
    AssetVault public vault;
    // current version for encoding decoding of request packet
    uint256 public currentVersion;
    // nonce for requestToRouter Messages
    uint256 public eventNonce;
    uint256 public stateLastValsetNonce;
    // last validated ValSet Checkpoint
    bytes32 public stateLastValsetCheckpoint;
    // default fee for "iSend"
    uint256 public iSendDefaultFee;

    // cross-chain nonce validation mapping for incoming requests from different chains
    // (srcChainid{string} =>  nonce{uint256} => handled{bool}))
    mapping(string => mapping(uint256 => bool)) public nonceExecuted;
    // cross-chain nonce validation mapping for acknowledgements
    // nonce{uint256} => handled{bool}))
    mapping(uint256 => bool) public ackNonceExecuted;

    // requestMetadata:
    // abi.encodePacked (
    //       uint64 destGasLimit;
    //       uint64 destGasPrice;
    //       uint64 ackGasLimit;
    //       uint64 ackGasPrice;
    //       uint128 relayerFees;
    //       uint8 ackType;
    //       bool isReadCall;
    //       string asmAddress;
    //    )
    // }

    // requestPacket:
    // abi.encode (
    //   string destContractAddress,
    //   bytes payload
    // )
    event ISendEvent(
        uint256 version,
        uint256 routeAmount,
        uint256 indexed eventNonce,
        address requestSender,
        string srcChainId,
        string destChainId,
        string routeRecipient,
        bytes requestMetadata,
        bytes requestPacket
    );

    event IReceiveEvent(
        uint256 indexed requestIdentifier,
        uint256 indexed eventNonce,
        string srcChainId,
        string destChainId,
        string relayerRouterAddress,
        string requestSender,
        bytes execData,
        bool execStatus
    );

    // This is CrossTalk Acknowledgement Request Submit Event
    event IAckEvent(
        uint256 indexed eventNonce,
        uint256 indexed requestIdentifier,
        string relayerRouterAddress,
        string chainId,
        bytes data,
        bool success
    );

    event ValsetUpdatedEvent(
        uint256 indexed _newValsetNonce,
        uint256 indexed _eventNonce,
        string srcChainId,
        address[] _validators,
        uint64[] _powers
    );

    event SetVaultEvent(address vaultAddress);

    event BridgeFeeUpdatedEvent(uint256 oldFeeValue, uint256 newFeeValue);

    event SetDappMetadataEvent(uint256 indexed eventNonce, address dappAddress, string chainId, string feePayerAddress);

    function pause() external onlyRole(PAUSER) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER) {
        _unpause();
    }

    // Make a new checkpoint from the supplied validator set
    // A checkpoint is a hash of all relevant information about the valset. This is stored by the contract,
    // instead of storing the information directly. This saves on storage and gas.
    // The format of the checkpoint is:
    // h(_chainId, "checkpoint", valsetNonce, validators[], powers[])
    // Where h is the keccak256 hash function.
    // The validator powers must be decreasing or equal. This is important for checking the signatures on the
    // next valset, since it allows the caller to stop verifying signatures once a quorum of signatures have been verified.
    function makeCheckpoint(Utils.ValsetArgs memory _valsetArgs) internal pure returns (bytes32) {
        bytes32 checkpoint = keccak256(
            abi.encode(CHECK_POINT_METHOD_NAME, _valsetArgs.valsetNonce, _valsetArgs.validators, _valsetArgs.powers)
        );

        return checkpoint;
    }

    // This updates the valset by checking that the validators in the current valset have signed off on the
    // new valset. The signatures supplied are the signatures of the current valset over the checkpoint hash
    // generated from the new valset.
    // Anyone can call this function, but they must supply valid signatures of CONSTANT_POWER_THRESHOLD of the current valset over
    // the new valset.
    function updateValset(
        // The new version of the validator set
        Utils.ValsetArgs calldata _newValset,
        // The current validators that approve the change
        Utils.ValsetArgs calldata _currentValset,
        // These are arrays of the parts of the current validator's signatures
        bytes[] calldata _sigs
    ) external whenNotPaused nonReentrant {
        // CHECKS
        ValsetUpdate.updateValsetChecks(_newValset, _currentValset);

        // Check that the supplied current validator set matches the saved checkpoint
        if (makeCheckpoint(_currentValset) != stateLastValsetCheckpoint) {
            revert Utils.IncorrectCheckpoint();
        }

        // Check that enough current validators have signed off on the new validator set
        bytes32 newCheckpoint = makeCheckpoint(_newValset);
        bytes32 digest = _make_digest(newCheckpoint);
        SignatureUtils.checkValidatorSignatures(_currentValset, _sigs, digest, Utils.CONSTANT_POWER_THRESHOLD);

        // ACTIONS

        // Stored to be used next time to validate that the valset
        // supplied by the caller is correct.
        stateLastValsetCheckpoint = newCheckpoint;

        // Store new nonce
        stateLastValsetNonce = _newValset.valsetNonce;
        eventNonce++;
        emit ValsetUpdatedEvent(_newValset.valsetNonce, eventNonce, chainId, _newValset.validators, _newValset.powers);
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
        @notice Initializes Bridge, creates and grants {msg.sender} the admin role,
        creates and grants {initialRelayers} the relayer role.
        @param _chainId ID of chain the Bridge contract exists on.
     */
    function initialize(
        string memory _chainId,
        address[] memory _validators,
        uint64[] memory _powers,
        uint64 valsetNonce
    ) external initializer {
        // CHECKS
        // Check that validators, powers, and signatures (v,r,s) set is well-formed
        if (_validators.length != _powers.length || _validators.length == 0) {
            revert Utils.MalformedCurrentValidatorSet();
        }

        // Check cumulative power to ensure the contract has sufficient power to actually
        // pass a vote
        // point -> if due to special order our set to
        Utils.ValsetArgs memory _valset;
        _valset = Utils.ValsetArgs(_validators, _powers, valsetNonce);
        ValsetUpdate.validateValsetPower(_valset);

        bytes32 newCheckpoint = makeCheckpoint(_valset);

        // ACTIONS
        __ReentrancyGuard_init();
        __AccessControl_init();
        __Pausable_init();

        // Constructor Fx
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(RESOURCE_SETTER, msg.sender);
        _grantRole(PAUSER, msg.sender);

        chainId = _chainId;
        eventNonce = 1;
        stateLastValsetNonce = valsetNonce;
        stateLastValsetCheckpoint = newCheckpoint;
        currentVersion = 1;
        emit ValsetUpdatedEvent(valsetNonce, eventNonce, chainId, _validators, _powers);
        // Constructor Fx
    }

    function _authorizeUpgrade(address newImplementation) internal virtual override onlyRole(DEFAULT_ADMIN_ROLE) {}

    function setCurrentVersion(uint256 newVersion) external onlyRole(RESOURCE_SETTER) {
        currentVersion = newVersion;
    }

    function setBridgeFees(uint256 _iSendDefaultFee) external onlyRole(RESOURCE_SETTER) {
        // default fee for "sendCrossChainRequest"
        assert(_iSendDefaultFee < Utils.I_DEFAULT_FEE_UPPER_LIMIT);
        emit BridgeFeeUpdatedEvent(iSendDefaultFee, _iSendDefaultFee);
        iSendDefaultFee = _iSendDefaultFee;
    }

    /// @notice Used to withdraw fee
    /// @param recipient Address to withdraw tokens to.
    function withdrawFee(
        address tokenAddress,
        address payable recipient,
        uint256 gasLimit,
        uint256 amount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        // default fee for "sendCrossChainRequest"
        if (tokenAddress != address(0)) {
            (bool success, ) = tokenAddress.call{ gas: gasLimit }(
                abi.encodeWithSignature("transfer(address,uint256)", recipient, amount)
            );
            require(success, "Failed to send Tokens!");
        } else {
            (bool success, ) = recipient.call{ gas: gasLimit, value: amount }("");
            require(success, "Failed to send Eth!");
        }
    }

    function setVault(address _vaultAddress) external onlyRole(DEFAULT_ADMIN_ROLE) {
        // "empty address" => "C02"
        if (_vaultAddress == address(0)) {
            revert Utils.C02();
        }
        vault = AssetVault(_vaultAddress);
        emit SetVaultEvent(_vaultAddress);
    }

    function setDappMetadata(string memory feePayerAddress) external payable returns (uint256) {
        // "fees too low" => "C03"
        if (msg.value < iSendDefaultFee) {
            revert Utils.C03();
        }
        eventNonce++;
        emit SetDappMetadataEvent(eventNonce, msg.sender, chainId, feePayerAddress);
        return eventNonce;
    }

    function iSend(
        uint256 version,
        uint256 routeAmount,
        string calldata routeRecipient,
        string calldata destChainId,
        bytes calldata requestMetadata,
        bytes calldata requestPacket
    ) external payable whenNotPaused returns (uint256) {
        // "fees too low" => "C03"
        if (msg.value < iSendDefaultFee) {
            revert Utils.C03();
        }
        if (routeAmount > 0) {
            // "empty recipient" => "C04"
            // keccak256(bytes("")) = 0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470
            // TODO: Can we remove
            if (
                keccak256(bytes(routeRecipient)) == 0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470
            ) {
                revert Utils.C04();
            }

            vault.deposit(routeAmount, msg.sender);
        }
        ++eventNonce;
        emitISendEvent(version, routeAmount, destChainId, routeRecipient, requestMetadata, requestPacket);
        return eventNonce;
    }

    function emitISendEvent(
        uint256 version,
        uint256 routeAmount,
        string calldata destChainId,
        string calldata routeRecipient,
        bytes calldata requestMetadata,
        bytes calldata requestPacket
    ) internal {
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
    }

    function checkCheckpointAndVerifySigs(
        Utils.ValsetArgs calldata _valsetArgs,
        bytes[] calldata _sigs,
        bytes memory encodedABI
    ) internal view {
        if (makeCheckpoint(_valsetArgs) != stateLastValsetCheckpoint) {
            revert Utils.IncorrectCheckpoint();
        }

        bytes32 messagehash = keccak256(encodedABI);
        bytes32 digest = _make_digest(messagehash);
        SignatureUtils.checkValidatorSignatures(_valsetArgs, _sigs, digest, Utils.CONSTANT_POWER_THRESHOLD);
    }

    function _make_digest(bytes32 data) private pure returns (bytes32 _digest) {
        _digest = keccak256(abi.encodePacked(Utils.MSG_PREFIX, data));
    }

    function iReceive(
        Utils.ValsetArgs calldata _currentValset,
        bytes[] calldata _sigs,
        Utils.RequestPayload memory requestPayload,
        string memory relayerRouterAddress
    ) external whenNotPaused nonReentrant {
        bytes memory encodedABI = abi.encode(
            IRECEIVE_METHOD_NAME,
            requestPayload.routeAmount,
            requestPayload.requestIdentifier,
            requestPayload.requestTimestamp,
            requestPayload.srcChainId,
            requestPayload.routeRecipient,
            chainId,
            requestPayload.asmAddress,
            requestPayload.requestSender,
            requestPayload.handlerAddress,
            requestPayload.packet,
            requestPayload.isReadCall
        );

        checkCheckpointAndVerifySigs(_currentValset, _sigs, encodedABI);

        // "cross-chain request message already handled" => "C06"
        if (nonceExecuted[requestPayload.srcChainId][requestPayload.requestIdentifier] == true) {
            revert Utils.C06();
        }

        if (requestPayload.routeAmount > 0) {
            //caution: make sure recipient should be correct
            if (requestPayload.routeRecipient == address(0)) {
                revert Utils.InvalidRecipient();
            }
            vault.handleWithdraw(requestPayload.routeAmount, requestPayload.routeRecipient);
        }

        // (bytes memory handler, bytes memory packet) = abi.decode(requestPayload.requestPacket, (bytes, bytes));

        bool isValidRequest = true;

        if (requestPayload.asmAddress != address(0) && isContract(requestPayload.asmAddress)) {
            IAdditionalSecurityModule asm = IAdditionalSecurityModule(requestPayload.asmAddress);
            isValidRequest = asm.verifyCrossChainRequest(
                requestPayload.requestIdentifier,
                requestPayload.requestTimestamp,
                requestPayload.requestSender,
                requestPayload.srcChainId,
                requestPayload.packet,
                requestPayload.handlerAddress
            );
        }

        nonceExecuted[requestPayload.srcChainId][requestPayload.requestIdentifier] = true;
        ++eventNonce;
        if (!isValidRequest) {
            // Since we are sending a specific set of bytes (invalid request response), we can remove exeCode
            emit IReceiveEvent(
                requestPayload.requestIdentifier,
                eventNonce,
                requestPayload.srcChainId,
                chainId,
                relayerRouterAddress,
                requestPayload.requestSender,
                INVALID_REQUEST_RESPONSE,
                false
            );
            return;
        }

        bytes memory execData;
        bool execFlag;
        if (!requestPayload.isReadCall) {
            (execFlag, execData) = requestPayload.handlerAddress.call(
                abi.encodeWithSelector(
                    IDapp.iReceive.selector,
                    requestPayload.requestSender,
                    requestPayload.packet,
                    requestPayload.srcChainId
                )
            );
        } else {
            (execFlag, execData) = requestPayload.handlerAddress.staticcall(requestPayload.packet);
        }
        if (!execFlag && gasleft() < Utils.MIN_GAS_THRESHHOLD)
            revert Utils.MessageExcecutionFailedWithLowGas();
        emit IReceiveEvent(
            requestPayload.requestIdentifier,
            eventNonce,
            requestPayload.srcChainId,
            chainId,
            relayerRouterAddress,
            requestPayload.requestSender,
            execData,
            execFlag
        );
    }

    function iAck(
        // The validators that approve the call
        Utils.ValsetArgs calldata _currentValset,
        // These are arrays of the parts of the validators signatures
        bytes[] calldata _sigs,
        Utils.CrossChainAckPayload memory crossChainAckPayload,
        string memory relayerRouterAddress
    ) external whenNotPaused nonReentrant {
        // chainId data is present inside the signature validation
        // valsetArgs validation will be handled by the makeCheckPoint function
        if (ackNonceExecuted[crossChainAckPayload.requestIdentifier] == true) {
            revert Utils.C06();
        }
        if (nonceExecuted[crossChainAckPayload.destChainId][crossChainAckPayload.ackRequestIdentifier] == true) {
            revert Utils.C07();
        }

        bytes memory encodedABI = abi.encode(
            // bytes32 encoding of "iAck"
            IACK_METHOD_NAME,
            chainId,
            crossChainAckPayload.requestIdentifier,
            crossChainAckPayload.ackRequestIdentifier,
            crossChainAckPayload.destChainId,
            crossChainAckPayload.requestSender,
            crossChainAckPayload.execData,
            crossChainAckPayload.execFlag
        );

        checkCheckpointAndVerifySigs(_currentValset, _sigs, encodedABI);

        ackNonceExecuted[crossChainAckPayload.requestIdentifier] = true;
        nonceExecuted[crossChainAckPayload.destChainId][crossChainAckPayload.ackRequestIdentifier] = true;

        uint256 nonce;
        unchecked {
            nonce = ++eventNonce;
        }

        // address handler = toAddress(crossChainAckPayload.requestSender);
        (bool success, bytes memory data) = crossChainAckPayload.requestSender.call{ gas: gasleft() }(
            abi.encodeWithSelector(
                IDapp.iAck.selector,
                crossChainAckPayload.requestIdentifier,
                crossChainAckPayload.execFlag,
                crossChainAckPayload.execData
            )
        );
        if (!success && gasleft() < Utils.MIN_GAS_THRESHHOLD)
                revert Utils.MessageExcecutionFailedWithLowGas();

        emit IAckEvent(nonce, crossChainAckPayload.requestIdentifier, relayerRouterAddress, chainId, data, success);
    }

    function isContract(address addr) internal view returns (bool) {
        uint256 size;
        assembly {
            size := extcodesize(addr)
        }
        return size > 0;
    }
}
