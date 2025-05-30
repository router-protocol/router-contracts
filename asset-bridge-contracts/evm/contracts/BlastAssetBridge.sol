// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@routerprotocol/evm-gateway-contracts/contracts/IGateway.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/IAssetBridge.sol";
import "@routerprotocol/asset-forwarder/contracts/interfaces/IMessageHandler.sol";
import "./interfaces/IDexSpan.sol";
import "./interfaces/IBurnableERC20.sol";
import "./ReentrancyGuard.sol";
import "./interfaces/IBlastPoints.sol";
import { IBlast } from "./interfaces/IBlast.sol";

/// @title Handles ERC20 deposits and relay executions.
/// @author Router Protocol.
/// @notice This contract is intended to be used with the Bridge contract.
contract BlastAssetBridge is Context, AccessControl, ReentrancyGuard, Pausable, IAssetBridge {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    address public constant BlastPointsAddress = 0x2536FE9ab3F511540F2f9e2eC2A805005C3Dd800;
    IBlast public constant BLAST = IBlast(0x4300000000000000000000000000000000000002);

    bytes32 public constant RESOURCE_SETTER = keccak256("RESOURCE_SETTER");
    bytes32 public constant PAUSER = keccak256("PAUSER");

    // NOTE: Change chainId everytime we deploy
    string public constant ROUTER_CHAIN_ID = "router_9607-1";
    bytes32 public constant ROUTER_CHAIN_ID_BYTES = keccak256(bytes(ROUTER_CHAIN_ID));
    // only dest gas limit specified 6 mill, rest is 0
    bytes public constant AssetBridge_REQUEST_METADATA =
        hex"00000000005B8D80000000000000000000000000000000000000000000000000000000000000000000000000000000000000";

    address private constant ETH_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    // Instance of the gateway contract
    IGateway public immutable gateway;
    IDexSpan public dexSpan;

    // NOTE: Change ROUTER_BRIDGE_ADDRESS everytime we deploy
    string public constant ROUTER_BRIDGE_ADDRESS = "router17p9rzwnnfxcjp32un9ug7yhhzgtkhvl9jfksztgw5uh69wac2pgsmpev85";
    bytes32 public constant ROUTER_BRIDGE_ADDRESS_BYTES = keccak256(bytes(ROUTER_BRIDGE_ADDRESS));
    uint256 public depositNonce;
    // keccak256(abi.encode(destChainId)) + depositNonce => Revert Executed?
    mapping(bytes32 => mapping(uint256 => bool)) public _executionRevertCompleted;

    // token contract address => is reserve
    mapping(address => uint256) public _tokenWhitelist;

    // keccak256(abi.encode(sourceChainId)) + nonce => isExecuted
    mapping(bytes32 => mapping(uint256 => bool)) public executeRecord;

    // codeId:
    // 1 -> Only Gateway contract
    // 2 -> array length mismatch
    // 3 -> contract address cannot be zero address
    // 4 -> provided contract is not whitelisted
    // 5 -> Either reserve handler or dest caller address is zero address
    // 6 -> Insufficient native assets sent
    // 7 -> token not whitelisted
    // 8 -> min amount lower than required
    // 9 -> invalid data
    // 10 -> invalid token addresses
    // 11 -> data for reserve transfer
    // 12 -> data for LP transfer
    // 13 -> only AssetBridge middleware
    // 14 -> already reverted
    // 15 -> no deposit found
    // 16 -> dest chain not configured
    // 17 -> InvalidChainID
    // 18 -> InvalidMiddlewareAddress
    // 19 -> already executed
    error AssetBridgeError(uint8 codeId);

    modifier isGateway() {
        // Only gateway contracts
        if (msg.sender != address(gateway)) revert AssetBridgeError(1);
        _;
    }

    modifier isLengthSame(uint256 l1, uint256 l2) {
        // array length mismatch
        if (l1 != l2) revert AssetBridgeError(2);
        _;
    }

    constructor(
        address _dexSpan,
        address _gatewayAddress,
        string memory chainId,
        string memory routerBridgeAddress,
        uint256 startNonce
    ) {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(RESOURCE_SETTER, msg.sender);
        _setupRole(PAUSER, msg.sender);
        dexSpan = IDexSpan(_dexSpan);
        gateway = IGateway(_gatewayAddress);
        if (ROUTER_CHAIN_ID_BYTES != keccak256(bytes(chainId))) {
            revert AssetBridgeError(17);
        }
        if (ROUTER_BRIDGE_ADDRESS_BYTES != keccak256(bytes(routerBridgeAddress))) {
            revert AssetBridgeError(18);
        }
        depositNonce = startNonce;
        IBlastPoints(BlastPointsAddress).configurePointsOperator(msg.sender);
        BLAST.configureClaimableGas();
        BLAST.configureGovernor(msg.sender);
    }

    /// @notice Pauses deposits on the handler.
    /// @notice Only callable by an address that currently has the PAUSER role.
    function pause() external onlyRole(PAUSER) whenNotPaused {
        _pause();
    }

    /// @notice Unpauses deposits on the handler.
    /// @notice Only callable by an address that currently has the PAUSER role.
    function unpause() external onlyRole(PAUSER) whenPaused {
        _unpause();
    }

    function setWhiteListTokenMulti(
        address[] memory _tokens,
        uint256[] memory types
    ) public onlyRole(RESOURCE_SETTER) isLengthSame(_tokens.length, types.length) {
        uint8 length = uint8(_tokens.length);
        for (uint8 i = 0; i < length; i++) {
            if (_tokens[i] == address(0)) {
                // token address can't be zero
                revert AssetBridgeError(3);
            }
            _tokenWhitelist[_tokens[i]] = types[i];
        }
    }

    function setDappMetadata(string memory feePayer) external payable onlyRole(RESOURCE_SETTER) {
        gateway.setDappMetadata{ value: msg.value }(feePayer);
    }

    /// @notice Sets DexSpan address.
    /// @param _dexSpan Address of DexSpan contract
    function setDexSpanAddress(address _dexSpan) external onlyRole(RESOURCE_SETTER) {
        // contract address cannot be zero address
        if (_dexSpan == address(0)) revert AssetBridgeError(3);
        dexSpan = IDexSpan(_dexSpan);
    }

    function transferToken(TransferPayload memory transferPayload) external payable nonReentrant whenNotPaused {
        bytes memory packet = _getTransferPacket(
            transferPayload.destChainIdBytes,
            transferPayload.srcTokenAddress,
            transferPayload.srcTokenAmount,
            transferPayload.dstAmount,
            transferPayload.recipient,
            transferPayload.partnerId
        );
        _transferToken(transferPayload, packet);
        emit TokenTransfer(
            transferPayload.destChainIdBytes,
            transferPayload.srcTokenAddress,
            transferPayload.srcTokenAmount,
            transferPayload.recipient,
            transferPayload.partnerId,
            depositNonce
        );
    }

    function transferTokenWithInstruction(
        TransferPayload memory transferPayload,
        uint64 destGasLimit,
        bytes calldata instruction
    ) external payable nonReentrant whenNotPaused {
        bytes memory packet = _getTransferWithInstructionPacket(
            transferPayload.destChainIdBytes,
            transferPayload.srcTokenAddress,
            transferPayload.srcTokenAmount,
            transferPayload.dstAmount,
            transferPayload.recipient,
            transferPayload.partnerId,
            destGasLimit,
            instruction
        );
        _transferToken(transferPayload, packet);
        emit TokenTransferWithInstruction(
            transferPayload.destChainIdBytes,
            transferPayload.srcTokenAddress,
            transferPayload.srcTokenAmount,
            transferPayload.recipient,
            transferPayload.partnerId,
            destGasLimit,
            instruction,
            depositNonce
        );
    }

    function swapAndTransferToken(
        TransferPayload memory transferPayload,
        SwapPayload memory swapPayload
    ) external payable nonReentrant whenNotPaused {
        bool isSourceNative = _isNative(swapPayload.tokens[0]);
        uint256 nativeAmount = 0;
        if (!isSourceNative)
            _safeTransferFrom(swapPayload.tokens[0], msg.sender, address(dexSpan), transferPayload.srcTokenAmount);
        else {
            // No native assets sent
            if (msg.value < transferPayload.srcTokenAmount) revert AssetBridgeError(6);
            nativeAmount = transferPayload.srcTokenAmount;
        }
        address toToken = swapPayload.tokens[swapPayload.tokens.length - 1];
        uint256 oldBalance = IBurnableERC20V2(toToken).balanceOf(address(this));
        uint256 returnAmount = dexSpan.swapMultiWithRecipient{ value: nativeAmount }(
            swapPayload.tokens,
            transferPayload.srcTokenAmount,
            swapPayload.minToAmount,
            swapPayload.flags,
            swapPayload.dataTx,
            true,
            address(this)
        );
        uint256 newBalance = IBurnableERC20V2(toToken).balanceOf(address(this));
        assert(oldBalance + returnAmount == newBalance);
        _tokenAndAmountValidation(toToken);
        _lockOrBurnToken(toToken, address(this), returnAmount);
        bytes memory packet = _getTransferPacket(
            transferPayload.destChainIdBytes,
            toToken,
            returnAmount,
            transferPayload.dstAmount,
            transferPayload.recipient,
            transferPayload.partnerId
        );
        _iSend(packet, msg.value.sub(nativeAmount));

        emit TokenTransfer(
            transferPayload.destChainIdBytes,
            toToken,
            returnAmount,
            transferPayload.recipient,
            transferPayload.partnerId,
            depositNonce
        );
    }

    function swapAndTransferTokenWithInstruction(
        TransferPayload memory transferPayload,
        SwapPayload memory swapPayload,
        uint64 destGasLimit,
        bytes calldata instruction
    ) external payable nonReentrant whenNotPaused {
        bool isSourceNative = _isNative(swapPayload.tokens[0]);
        uint256 nativeAmount = 0;
        if (!isSourceNative)
            _safeTransferFrom(swapPayload.tokens[0], msg.sender, address(dexSpan), transferPayload.srcTokenAmount);
        else {
            // No native assets sent
            if (msg.value < transferPayload.srcTokenAmount) revert AssetBridgeError(6);
            nativeAmount = transferPayload.srcTokenAmount;
        }
        address toToken = swapPayload.tokens[swapPayload.tokens.length - 1];
        uint256 oldBalance = IBurnableERC20V2(toToken).balanceOf(address(this));
        uint256 returnAmount = dexSpan.swapMultiWithRecipient{ value: nativeAmount }(
            swapPayload.tokens,
            transferPayload.srcTokenAmount,
            swapPayload.minToAmount,
            swapPayload.flags,
            swapPayload.dataTx,
            true,
            address(this)
        );
        uint256 newBalance = IBurnableERC20V2(toToken).balanceOf(address(this));
        assert(oldBalance + returnAmount == newBalance);
        _tokenAndAmountValidation(toToken);
        _lockOrBurnToken(toToken, address(this), returnAmount);
        bytes memory packet = _getTransferWithInstructionPacket(
            transferPayload.destChainIdBytes,
            toToken,
            returnAmount,
            transferPayload.dstAmount,
            transferPayload.recipient,
            transferPayload.partnerId,
            destGasLimit,
            instruction
        );
        _iSend(packet, msg.value.sub(nativeAmount));

        emit TokenTransferWithInstruction(
            transferPayload.destChainIdBytes,
            toToken,
            returnAmount,
            transferPayload.recipient,
            transferPayload.partnerId,
            destGasLimit,
            instruction,
            depositNonce
        );
    }

    /// @notice Function to handle the request for execution received from Router Chain
    /// @param requestSender Address of the sender of the transaction on the source chain.
    /// @param srcChainId request source chain id.
    /// @param packet Packet coming from the router chain.
    function iReceive(
        string memory requestSender,
        bytes memory packet,
        string memory srcChainId
    ) external isGateway nonReentrant whenNotPaused {
        // only AssetBridge middleware
        if (keccak256(bytes(srcChainId)) != ROUTER_CHAIN_ID_BYTES) revert AssetBridgeError(13);
        // only AssetBridge middleware
        if (keccak256(bytes(requestSender)) != ROUTER_BRIDGE_ADDRESS_BYTES) revert AssetBridgeError(17);

        uint8 txType = abi.decode(packet, (uint8));
        // Refunding deposited token in case of some issues on dest chain
        if (txType == 2) {
            (, bytes32 destChainIdBytes, IAssetBridge.DepositData memory depositData) = abi.decode(
                packet,
                (uint8, bytes32, IAssetBridge.DepositData)
            );
            // already reverted
            if (_executionRevertCompleted[destChainIdBytes][depositData.depositNonce]) revert AssetBridgeError(14);
            _executionRevertCompleted[destChainIdBytes][depositData.depositNonce] = true;

            _executeProposalForReserveToken(
                depositData.srcTokenAddress,
                depositData.srcTokenAmount,
                depositData.sender
            );
            emit DepositReverted(
                destChainIdBytes,
                depositData.depositNonce,
                depositData.sender,
                depositData.srcTokenAddress,
                depositData.srcTokenAmount
            );
            return;
        }

        if (txType == 0) {
            // mint token
            (, bytes32 srcChainIdBytes, IAssetBridge.ExecuteInfo memory executeDetails) = abi.decode(
                packet,
                (uint8, bytes32, IAssetBridge.ExecuteInfo)
            );
            // already executed
            if (executeRecord[srcChainIdBytes][executeDetails.depositNonce]) revert AssetBridgeError(19);
            executeRecord[srcChainIdBytes][executeDetails.depositNonce] = true;

            _executeProposalForReserveToken(
                executeDetails.destTokenAddress,
                executeDetails.destTokenAmount,
                executeDetails.recipient
            );
            emit Execute(
                0,
                srcChainIdBytes,
                executeDetails.depositNonce,
                executeDetails.destTokenAddress,
                executeDetails.destTokenAmount,
                executeDetails.recipient
            );
            return;
        }

        if (txType == 1) {
            // mint token and execute
            (, bytes32 srcChainIdBytes, IAssetBridge.ExecuteInfo memory executeDetails, bytes memory instruction) = abi
                .decode(packet, (uint8, bytes32, IAssetBridge.ExecuteInfo, bytes));
            if (executeRecord[srcChainIdBytes][executeDetails.depositNonce]) revert AssetBridgeError(19);
            executeRecord[srcChainIdBytes][executeDetails.depositNonce] = true;

            _executeProposalForReserveToken(
                executeDetails.destTokenAddress,
                executeDetails.destTokenAmount,
                executeDetails.recipient
            );
            (bool success, bytes memory data) = executeDetails.recipient.call(
                abi.encodeWithSelector(
                    IMessageHandler.handleMessage.selector, // function handleAssetBridgeMessage(address tokenSent, uint256 amount, bytes memory instruction) external;
                    executeDetails.destTokenAddress,
                    executeDetails.destTokenAmount,
                    instruction
                )
            );
            //TODO: do we need any check on data and success
            //TODO: there should be min gas left after call

            emit ExecuteWithMessage(
                1,
                srcChainIdBytes,
                executeDetails.depositNonce,
                executeDetails.destTokenAddress,
                executeDetails.destTokenAmount,
                executeDetails.recipient,
                success,
                data
            );
            return;
        }
    }

    /// @notice Function to withdraw funds from this contract.
    /// @notice Only DEFAULT_ADMIN can call this function.
    /// @param  token Address of token to withdraw. If native token, send address 0.
    /// @param  amount Amount of tokens to withdraw. If all tokens, send 0.
    /// @param  recipient Address of recipient.
    function withdrawFunds(
        address token,
        uint256 amount,
        address payable recipient
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_isNative(token)) {
            amount = amount != 0 ? amount : address(this).balance;
            _safeTransferETH(recipient, amount);
        } else {
            IBurnableERC20V2 _token = IBurnableERC20V2(token);
            amount = amount != 0 ? amount : _token.balanceOf(address(this));
            _safeTransferFrom(token, address(this), recipient, amount);
        }
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /// Utils
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    function _executeProposalForReserveToken(address token, uint256 amount, address recipient) internal {
        uint256 tokenType = _tokenWhitelist[token];
        if (tokenType == 0) revert AssetBridgeError(7);
        if (tokenType != 1) {
            IBurnableERC20V2(token).mint(recipient, amount);
        } else {
            if (_isNative(token)) {
                (bool success, ) = recipient.call{ value: amount }("");
                require(success, "Transfer failed.");
            } else _safeTransferFrom(token, address(this), recipient, amount);
        }
    }

    function _isNative(address token) internal pure returns (bool) {
        return token == ETH_ADDRESS;
    }

    function _iSend(bytes memory packet, uint256 value) internal {
        bytes memory requestPacket = abi.encode(ROUTER_BRIDGE_ADDRESS, packet);
        gateway.iSend{ value: value }(1, 0, "", ROUTER_CHAIN_ID, AssetBridge_REQUEST_METADATA, requestPacket);
    }

    function _getTransferPacket(
        bytes32 destChainIdBytes,
        address srcTokenAddress,
        uint256 srcTokenAmount,
        uint256 dstTokenAmount,
        bytes memory recipient,
        uint256 partnerId
    ) internal returns (bytes memory) {
        unchecked {
            ++depositNonce;
        }
        return
            abi.encode(
                uint8(3),
                destChainIdBytes,
                srcTokenAddress,
                srcTokenAmount,
                dstTokenAmount,
                msg.sender,
                recipient,
                depositNonce,
                partnerId
            );
    }

    function _getTransferWithInstructionPacket(
        bytes32 destChainIdBytes,
        address srcTokenAddress,
        uint256 srcTokenAmount,
        uint256 dstTokenAmount,
        bytes memory recipient,
        uint256 partnerId,
        uint64 gasLimit,
        bytes calldata instruction
    ) internal returns (bytes memory) {
        unchecked {
            ++depositNonce;
        }
        return
            abi.encode(
                uint8(4),
                destChainIdBytes,
                srcTokenAddress,
                srcTokenAmount,
                dstTokenAmount,
                msg.sender,
                recipient,
                depositNonce,
                partnerId,
                gasLimit,
                instruction
            );
    }

    function _lockOrBurnToken(address token, address from, uint256 amount) internal {
        uint256 tokenType = _tokenWhitelist[token];
        if (tokenType == 1) {
            if (from != address(this)) _safeTransferFrom(token, from, address(this), amount);
        } else if (tokenType == 2) {
            // Old ERC20 Contracts
            IBurnableERC20V1(token).burn(from, amount);
        } else if (tokenType == 3) {
            // New ERC20 Contracts
            if (from == address(this)) {
                IBurnableERC20V2(token).burn(amount);
            } else {
                IBurnableERC20V2(token).burnFrom(from, amount);
            }
        } else if (tokenType == 4) {
            // Circle USDC token
            if (from != address(this)) {
                IERC20(token).safeTransferFrom(from, address(this), amount);
            }
            IBurnableERC20V2(token).burn(amount);
        } else {
            revert AssetBridgeError(7); // token not whitelisted
        }
    }

    function _tokenAndAmountValidation(address token) internal view {
        if (_tokenWhitelist[token] == 0) {
            revert AssetBridgeError(7); // token not whitelisted
        }
    }

    function _swap(SwapPayload memory swapPayload, uint256 srcAmount) internal returns (uint256 returnAmount) {
        bool isSourceNative = _isNative(swapPayload.tokens[0]);
        uint256 nativeAmount = 0;
        if (!isSourceNative) _safeTransferFrom(swapPayload.tokens[0], msg.sender, address(dexSpan), srcAmount);
        else {
            if (msg.value < srcAmount) {
                // No native assets sent
                revert AssetBridgeError(6);
            }
            nativeAmount = srcAmount;
        }
        address toToken = swapPayload.tokens[swapPayload.tokens.length - 1];
        uint256 oldBalance = IBurnableERC20V2(toToken).balanceOf(address(this));
        returnAmount = dexSpan.swapMultiWithRecipient{ value: nativeAmount }(
            swapPayload.tokens,
            srcAmount,
            swapPayload.minToAmount,
            swapPayload.flags,
            swapPayload.dataTx,
            true,
            address(this)
        );
        uint256 newBalance = IBurnableERC20V2(toToken).balanceOf(address(this));
        assert(oldBalance + returnAmount == newBalance);
    }

    function _transferToken(TransferPayload memory transferPayload, bytes memory packet) internal {
        _tokenAndAmountValidation(transferPayload.srcTokenAddress);
        bool isSourceNative = _isNative(transferPayload.srcTokenAddress);
        if (!isSourceNative)
            _lockOrBurnToken(transferPayload.srcTokenAddress, msg.sender, transferPayload.srcTokenAmount);
        else {
            if (msg.value < transferPayload.srcTokenAmount) {
                // No native assets sent
                revert AssetBridgeError(6);
            }
        }
        if (!isSourceNative) _iSend(packet, msg.value);
        else _iSend(packet, msg.value.sub(transferPayload.srcTokenAmount));
    }

    function _safeTransferETH(address to, uint256 value) internal {
        require(to != address(0), "safeTransferETH: transfer to address 0");
        (bool success, ) = to.call{ value: value }(new bytes(0));
        require(success, "safeTransferETH: ETH transfer failed");
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) internal {
        if (from == address(this)) {
            IERC20(token).safeTransfer(to, amount);
        } else {
            IERC20(token).safeTransferFrom(from, to, amount);
        }
    }
}
