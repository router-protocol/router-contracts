// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract IDexSpanConsts {
    // flags = FLAG_DISABLE_UNISWAP + FLAG_DISABLE_BANCOR + ...
    uint256 internal constant FLAG_DISABLE_UNISWAP = 0x400;
    uint256 internal constant FLAG_DISABLE_SPLIT_RECALCULATION = 0x800000000000;
    uint256 internal constant FLAG_DISABLE_ALL_SPLIT_SOURCES = 0x20000000;
    uint256 internal constant FLAG_DISABLE_UNISWAP_V2_ALL = 0x400;
    uint256 internal constant FLAG_DISABLE_EMPTY = 0x100000000000;

    uint256 internal constant FLAG_DISABLE_DFYN = 0x800;
    uint256 internal constant FLAG_DISABLE_PANCAKESWAP = 0x80;
    uint256 internal constant FLAG_DISABLE_QUICKSWAP = 0x40000000000;
    uint256 internal constant FLAG_DISABLE_SUSHISWAP = 0x1000000;
    uint256 internal constant FLAG_DISABLE_ONEINCH = 0x100000;
}

abstract contract IDexSpan is IDexSpanConsts {
    struct SwapPayload {
        uint256[] flags;
        uint256 minToAmount;
        address[] tokens;
        bytes[] dataTx;
    }

    struct SwapParams {
        address[] tokens;
        uint256 amount;
        uint256 minReturn;
        uint256[] flags;
        bytes[] dataTx;
        bool isWrapper;
        address recipient;
        bytes destToken;
    }

    function transferOwnership(address _newOwner) external virtual;

    function claimOwnership() external virtual;

    function setAssetForwarder(address _forwarder) external virtual;

    function setAssetBridge(address _assetBridge) external virtual;

    function setFlagToFactoryAddress(
        uint256 _flagCode,
        address _factoryAddress
    ) external virtual;

    function setFactorySetter(address _factorySetter) external virtual;

    function setWNativeAddresses(
        address _native,
        address _wrappedNative
    ) external virtual;

    function handleMessage(
        address _tokenSent,
        uint256 _amount,
        bytes memory message
    ) external virtual;

    function swapInSameChain(
        address[] memory tokens,
        uint256 amount,
        uint256 minReturn,
        uint256[] memory flags,
        bytes[] memory dataTx,
        bool isWrapper,
        address recipient,
        uint256 widgetID
    ) external virtual;

    function swapMultiWithRecipient(
        address[] memory tokens,
        uint256 amount,
        uint256 minReturn,
        uint256[] memory flags,
        bytes[] memory dataTx,
        bool isWrapper,
        address recipient
    ) public payable virtual returns (uint256 returnAmount);

    function swapAndDeposit(
        uint256 partnerId,
        bytes32 destChainIdBytes,
        bytes calldata recipient,
        uint8 depositType,
        uint256 feeAmount,
        bytes memory message,
        SwapParams memory swapData,
        address refundRecipient
    ) public payable virtual;
}
