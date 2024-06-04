// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IAssetForwarder.sol";
import "./interfaces/IWETH.sol";
import "./interfaces/ITokenMessenger.sol";
import "./interfaces/IMessageHandler.sol";

contract AssetForwarderUpgradeable is
    Initializable,
    PausableUpgradeable,
    AccessControlUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable,
    IAssetForwarder
{
    using SafeERC20 for IERC20;

    IWETH public wrappedNativeToken;
    bytes32 public routerMiddlewareBase;
    address public gatewayContract;
    
    uint256 public depositNonce;
    uint256 public constant MAX_TRANSFER_SIZE = 1e36;
    bytes32 public constant RESOURCE_SETTER = keccak256("RESOURCE_SETTER");
    bytes32 public constant PAUSER = keccak256("PAUSER");
    mapping(bytes32 => bool) public executeRecord;
    uint256 public MIN_GAS_THRESHHOLD;
    uint256 public pauseStakeAmountMin;
    uint256 public pauseStakeAmountMax;
    uint256 public totalStakedAmount;
    bool public isCommunityPauseEnabled;

    address private constant NATIVE_ADDRESS =
        0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    event CommunityPaused(address indexed pauser, uint256 stakedAmount);

    error MessageAlreadyExecuted();
    error InvalidGateway();
    error InvalidRequestSender();
    error InvalidRefundData();
    error InvalidAmount();
    error AmountTooLarge();
    error MessageExcecutionFailedWithLowGas();
    error InvalidFee();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _wrappedNativeTokenAddress,
        address _gatewayContract,
        bytes memory _routerMiddlewareBase,
        uint _minGasThreshhold,
        uint256 _depositNonce
    ) external initializer {
        // ACTIONS
        __ReentrancyGuard_init();
        __AccessControl_init();
        __Pausable_init();
        wrappedNativeToken = IWETH(_wrappedNativeTokenAddress);
        gatewayContract = _gatewayContract;
        routerMiddlewareBase = keccak256(_routerMiddlewareBase);
        MIN_GAS_THRESHHOLD = _minGasThreshhold;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(RESOURCE_SETTER, msg.sender);
        _grantRole(PAUSER, msg.sender);
        depositNonce = _depositNonce;
        isCommunityPauseEnabled = true;
    }

    function _authorizeUpgrade(address newImplementation) internal virtual override onlyRole(DEFAULT_ADMIN_ROLE) {}
    
    function update(
        uint index,
        address _gatewayContract,
        bytes calldata _routerMiddlewareBase,
        uint256 minPauseStakeAmount,
        uint256 maxPauseStakeAmount
    ) public onlyRole(RESOURCE_SETTER) {
        if (index == 1) {
            gatewayContract = _gatewayContract;
        } else if (index == 2) {
            routerMiddlewareBase = keccak256(_routerMiddlewareBase);
        } else if (index == 3) {
            require(
                minPauseStakeAmount <= maxPauseStakeAmount,
                "minPauseStakeAmount must be less than or equal to maxPauseStakeAmount"
            );
            pauseStakeAmountMin = minPauseStakeAmount;
            pauseStakeAmountMax = maxPauseStakeAmount;
        }
    }


    function pause() external onlyRole(PAUSER) whenNotPaused {
        _pause();
    }

    /// @notice Unpauses deposits on the handler.
    /// @notice Only callable by an address that currently has the PAUSER role.
    function unpause() external onlyRole(PAUSER) whenPaused {
        _unpause();
    }

    function isNative(address token) internal pure returns (bool) {
        return token == NATIVE_ADDRESS;
    }

    // TODO: Docs Update
    function iDeposit(
        DepositData memory depositData,
        bytes memory destToken,
        bytes memory recipient
    ) external payable nonReentrant whenNotPaused {
        if (depositData.amount > MAX_TRANSFER_SIZE) revert AmountTooLarge();

        if (isNative(depositData.srcToken)) {
            if (depositData.amount != msg.value) revert InvalidAmount();
            wrappedNativeToken.deposit{value: msg.value}(); // only amount should be deposited
            depositData.srcToken = address(wrappedNativeToken);
        } else {
            IERC20(depositData.srcToken).safeTransferFrom(
                msg.sender,
                address(this),
                depositData.amount
            );
        }

        emit FundsDeposited(
            depositData.partnerId,
            depositData.amount,
            depositData.destChainIdBytes,
            depositData.destAmount,
            ++depositNonce,
            depositData.srcToken,
            depositData.refundRecipient,
            recipient,
            destToken
        );
    }

    function iDepositInfoUpdate(
        address srcToken,
        uint256 feeAmount,
        uint256 depositId,
        bool initiatewithdrawal
    ) external payable nonReentrant whenNotPaused {
        if (initiatewithdrawal) {
            require(msg.value == 0);
            emit DepositInfoUpdate(
                srcToken,
                0,
                depositId,
                ++depositNonce,
                true,
                msg.sender
            );
            return;
        }
        if (feeAmount > MAX_TRANSFER_SIZE) revert AmountTooLarge();
        if (isNative(srcToken)) {
            if (feeAmount != msg.value) revert InvalidAmount();
            wrappedNativeToken.deposit{value: msg.value}(); // only amount should be deposited
            srcToken = address(wrappedNativeToken);
        } else {
            IERC20(srcToken).safeTransferFrom(
                msg.sender,
                address(this),
                feeAmount
            );
        }
        emit DepositInfoUpdate(
            srcToken,
            feeAmount,
            depositId,
            ++depositNonce,
            false,
            msg.sender
        );
    }

    function iDepositMessage(
        DepositData memory depositData,
        bytes memory destToken,
        bytes memory recipient,
        bytes memory message
    ) external payable nonReentrant whenNotPaused {
        if (depositData.amount > MAX_TRANSFER_SIZE) revert AmountTooLarge();

        if (isNative(depositData.srcToken)) {
            if (depositData.amount != msg.value) revert InvalidAmount();
            wrappedNativeToken.deposit{value: msg.value}(); // only amount should be deposited
            depositData.srcToken = address(wrappedNativeToken);
        } else {
            IERC20(depositData.srcToken).safeTransferFrom(
                msg.sender,
                address(this),
                depositData.amount
            );
        }

        emit FundsDepositedWithMessage(
            depositData.partnerId,
            depositData.amount,
            depositData.destChainIdBytes,
            depositData.destAmount,
            ++depositNonce,
            depositData.srcToken,
            recipient,
            depositData.refundRecipient,
            destToken,
            message
        );
    }

    function iRelay(
        RelayData memory relayData
    ) external payable nonReentrant whenNotPaused {
        // Check is message is already executed
        if (relayData.amount > MAX_TRANSFER_SIZE) revert AmountTooLarge();
        bytes32 messageHash = keccak256(
            abi.encode(
                relayData.amount,
                relayData.srcChainId,
                relayData.depositId,
                relayData.destToken,
                relayData.recipient,
                address(this)
            )
        );
        if (executeRecord[messageHash]) revert MessageAlreadyExecuted();
        executeRecord[messageHash] = true;

        if (isNative(relayData.destToken)) {
            if (relayData.amount != msg.value) revert InvalidAmount();

            //slither-disable-next-line arbitrary-send-eth
            (bool success, ) = payable(relayData.recipient).call{value: relayData.amount}("");
            require(success == true);
        } else {
            IERC20(relayData.destToken).safeTransferFrom(
                msg.sender,
                relayData.recipient,
                relayData.amount
            );
        }

        emit FundsPaid(messageHash, msg.sender, ++depositNonce);
    }

    function iRelayMessage(
        RelayDataMessage memory relayData
    ) external payable nonReentrant whenNotPaused {
        if (relayData.amount > MAX_TRANSFER_SIZE) revert AmountTooLarge();

        // Check is message is already executed
        bytes32 messageHash = keccak256(
            abi.encode(
                relayData.amount,
                relayData.srcChainId,
                relayData.depositId,
                relayData.destToken,
                relayData.recipient,
                address(this),
                relayData.message
            )
        );
        if (executeRecord[messageHash]) revert MessageAlreadyExecuted();
        executeRecord[messageHash] = true;

        if (isNative(relayData.destToken)) {
            if (relayData.amount != msg.value) revert InvalidAmount();
            (bool success, ) = payable(relayData.recipient).call{value: relayData.amount}("");
            require(success == true);
        } else {
            IERC20(relayData.destToken).safeTransferFrom(
                msg.sender,
                relayData.recipient,
                relayData.amount
            );
        }

        bytes memory execData;
        bool execFlag;
        if (isContract(relayData.recipient) && relayData.message.length > 0) {
            (execFlag, execData) = relayData.recipient.call(
                abi.encodeWithSelector(
                    IMessageHandler.handleMessage.selector,
                    relayData.destToken,
                    relayData.amount,
                    relayData.message
                )
            );
            if (!execFlag && gasleft() < MIN_GAS_THRESHHOLD)
                revert MessageExcecutionFailedWithLowGas();
        }
        emit FundsPaidWithMessage(
            messageHash,
            msg.sender,
            ++depositNonce,
            execFlag,
            execData
        );
    }

    function iReceive(
        string calldata requestSender,
        bytes memory packet,
        string calldata
    ) external {
        if (msg.sender != address(gatewayContract)) revert InvalidGateway();
        if (routerMiddlewareBase != keccak256(bytes(requestSender)))
            revert InvalidRequestSender();

        (
            address recipient,
            address[] memory tokens,
            uint256[] memory amounts
        ) = abi.decode(packet, (address, address[], uint256[]));
        uint256 count = tokens.length;

        if (count != amounts.length) revert InvalidRefundData();

        for (uint256 i = 0; i < count; i++) {
            if (!isNative(tokens[i]))
                // Tron USDT mainnet token
                if (tokens[i] == address(0xa614f803B6FD780986A42c78Ec9c7f77e6DeD13C)) {
                    // balance check will be handled by require operation
                    (bool success, ) = tokens[i].call(abi.encodeWithSignature("transfer(address,uint256)", recipient, amounts[i]));
                    require(success == true);
                } else {
                    IERC20(tokens[i]).safeTransfer(recipient, amounts[i]);
                    //slither-disable-next-line arbitrary-send-eth
                }
            else {
                (bool success, ) = payable(recipient).call{value: amounts[i]}("");
                require(success == true);
            }
        }
    }

    function isContract(address addr) internal view returns (bool) {
        uint256 size;
        assembly {
            size := extcodesize(addr)
        }
        return size > 0;
    }

    // TODO: do we need this? We should not have it like this as this will
    // not be decentralized. We should have withdraw fees instead.
    function rescue(
        address token,
        uint256 amount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        if (isNative(token)) {
            (bool success, ) = payable(msg.sender).call{value: amount}("");
            require(success == true);
        } else {
            token.call(abi.encodeWithSignature("transfer(address,uint256)", msg.sender, amount));
        }
    }

    function toggleCommunityPause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        isCommunityPauseEnabled = !isCommunityPauseEnabled;
    }

    function communityPause() external payable whenNotPaused {
        // Check if msg.value is within the allowed range
        require(isCommunityPauseEnabled, "Community pause is disabled");
        require(
            pauseStakeAmountMin != 0 && pauseStakeAmountMax != 0,
            "Set Stake Amount Range"
        );
        require(
            msg.value >= pauseStakeAmountMin &&
                msg.value <= pauseStakeAmountMax,
            "Stake amount out of range"
        );
        uint256 newTotalStakedAmount = totalStakedAmount + msg.value;
        totalStakedAmount = newTotalStakedAmount;

        _pause();

        emit CommunityPaused(msg.sender, msg.value);
    }

    function withdrawStakeAmount() external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(
            address(this).balance >= totalStakedAmount,
            "Insufficient funds"
        );
        uint256 withdrawalAmount = totalStakedAmount;
        totalStakedAmount = 0;
        (bool success, ) = payable(msg.sender).call{value: withdrawalAmount}("");
        require(success == true);
    }
}
