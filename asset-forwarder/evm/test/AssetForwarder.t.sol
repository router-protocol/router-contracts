// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "forge-std/Test.sol";
import "../contracts/mock/Native.sol";
import "../contracts/AssetForwarder.sol";
import "../contracts/ERC20Upgradable.sol";
import "../contracts/interfaces/IAssetForwarder.sol";

import "../contracts/mock/Interactor.sol";
import "../contracts/mock/Dummy.sol";

contract AssetForwarderTest is Test {
    AssetForwarder public assetForwarder;
    string public chainId;
    UpgradeableERC20 public token;
    UpgradeableERC20 public route;
    UpgradeableERC20 public usdc;
    Native public native;
    address public tokenAddress;
    address public gatewayContract;
    address public routerMiddleware;
    uint256 public depositFee;
    uint256 public relayFee;

    Interactor public interactor;
    Dummy public dummy;

    event ISendEvent(address);
    error MessageAlreadyExecuted();
    error InvalidGateway();
    error InvalidRequestSender();
    error InvalidRefundData();
    error InvalidRelayerFee();
    error InvalidAmount();
    error AmountTooLarge();

    address public recipient;

    function setUp() public {
        chainId = "80001";
        token = new UpgradeableERC20();
        token.initialize("TEST1", "TEST1");
        route = new UpgradeableERC20();
        route.initialize("TEST1", "TEST1");
        usdc = new UpgradeableERC20();
        usdc.initialize("TEST1", "TEST1");

        UpgradeableERC20 token2 = new UpgradeableERC20();
        token2.initialize("TEST2", "TEST2");

        gatewayContract = address(this);
        routerMiddleware = address(2);
        native = new Native("Test2", "TEST", 18);
        depositFee = 1000000000000000000;
        relayFee = 1000000000000000000;

        assetForwarder = new AssetForwarder(
            gatewayContract,
            bytes("routerMiddlewareAddress"),
            0,
            0
        );

        interactor = new Interactor();
        dummy = new Dummy();

        token.approve(address(assetForwarder), 10000000000000000);
        route.approve(address(assetForwarder), 10000000000000000);
        usdc.approve(address(assetForwarder), 10000000000000000);
        native.approve(address(assetForwarder), 10000000000000000);
        token.transfer(address(assetForwarder), 10000000000000000);
        usdc.transfer(address(assetForwarder), 10000000000000000);
        route.transfer(address(assetForwarder), 10000000000000000);
    }

    function testIDeposit() public {
        assetForwarder.iDeposit{value: 100000}(
            IAssetForwarder.DepositData(
                1,
                100000,
                1000,
                address(usdc),
                msg.sender,
                bytes32("dst_chainId")
            ),
            bytes("dst_token"),
            bytes("recipient")
        );
    }

    function testIDepositRoute() public {
        assetForwarder.iDeposit{value: 100000}(
            IAssetForwarder.DepositData(
                1,
                100000,
                1000,
                address(usdc),
                msg.sender,
                bytes32("dst_chainId")
            ),
            bytes("dst_token"),
            bytes("recipient")
        );
    }

    function testIDepositUsdc() public {
        // log("TEST");
        assetForwarder.iDeposit{value: 100000}(
            IAssetForwarder.DepositData(
                1,
                100000,
                1000,
                address(usdc),
                msg.sender,
                bytes32("dst_chainId")
            ),
            bytes("dst_token"),
            bytes("recipient")
        );
    }

    function testIDepositReverts() public {
        vm.expectRevert(AmountTooLarge.selector);
        assetForwarder.iDeposit{value: 10000}(
            IAssetForwarder.DepositData(
                1,
                1e37,
                1000,
                address(usdc),
                msg.sender,
                bytes32("dst_chainId")
            ),
            bytes("dst_token"),
            bytes("recipient")
        );
    }

    function testIDepositNative() public {
        assetForwarder.iDeposit{value: 100000}(
            IAssetForwarder.DepositData(
                1,
                100000,
                1000,
                address(usdc),
                msg.sender,
                bytes32("dst_chainId")
            ),
            bytes("dst_token"),
            bytes("recipient")
        );
    }

    function testIRelay() public {
        IAssetForwarder.RelayData memory relayData = IAssetForwarder.RelayData({
            amount: 1000,
            srcChainId: bytes32("chainId"),
            depositId: 1,
            destToken: address(token),
            recipient: 0x777000622973412F5edc6F8EAd3A06CD614f66b0
        });
        assetForwarder.iRelay{value: 100000}(relayData);
        vm.expectRevert(MessageAlreadyExecuted.selector);
        assetForwarder.iRelay{value: 100000}(relayData);
    }

    function testIRelayMulticall() public {
        IAssetForwarder.RelayData memory relayDataWithToken = IAssetForwarder
            .RelayData({
                amount: 1000,
                srcChainId: bytes32("chainId"),
                depositId: 1,
                destToken: address(token),
                recipient: 0x777000622973412F5edc6F8EAd3A06CD614f66b0
            });
        IAssetForwarder.RelayData memory relayDataWithRoute = IAssetForwarder
            .RelayData({
                amount: 1000,
                srcChainId: bytes32("chainId"),
                depositId: 2,
                destToken: address(route),
                recipient: 0x777000622973412F5edc6F8EAd3A06CD614f66b0
            });

        bytes[] memory dataArray = new bytes[](2);

        dataArray[0] = abi.encodeWithSignature(
            "iRelay((uint256,bytes32,uint256,address,address))",
            relayDataWithToken
        );
        dataArray[1] = abi.encodeWithSignature(
            "iRelay((uint256,bytes32,uint256,address,address))",
            relayDataWithRoute
        );
        assetForwarder.multicall(dataArray);
    }

    function testIRelayNative() public {
        IAssetForwarder.RelayData memory relayData = IAssetForwarder.RelayData({
            amount: 100000,
            srcChainId: bytes32("chainId"),
            depositId: 1,
            destToken: address(native),
            recipient: 0x777000622973412F5edc6F8EAd3A06CD614f66b0
        });
        assetForwarder.iRelay{value: 100000}(relayData);
    }

    function testIRecieve() public {
        address[] memory tokens = new address[](2);
        uint[] memory amounts = new uint[](2);

        amounts[0] = 1000;
        amounts[1] = 1000;

        tokens[0] = address(route);
        tokens[1] = address(usdc);

        bytes memory packet = abi.encode(
            bytes("0x777000622973412F5edc6F8EAd3A06CD614f66b0"),
            tokens,
            amounts
        );
        assetForwarder.iReceive("routerMiddlewareAddress", packet, "chainId");
    }

    function testIRecieveMulticall() public {
        address[] memory tokensForPacket1 = new address[](2);
        uint[] memory amountsForPacket1 = new uint[](2);

        address[] memory tokensForPacket2 = new address[](2);
        uint[] memory amountsForPacket2 = new uint[](2);

        amountsForPacket1[0] = 1000;
        amountsForPacket1[1] = 1000;

        amountsForPacket2[0] = 2000;
        amountsForPacket2[1] = 2000;

        // amounts[0] = 1000;
        // amounts[1] = 1000;

        tokensForPacket1[0] = address(route);
        tokensForPacket1[1] = address(usdc);

        tokensForPacket2[0] = address(token);
        tokensForPacket2[1] = address(usdc);

        bytes memory packet1 = abi.encode(
            bytes("0x777000622973412F5edc6F8EAd3A06CD614f66b0"),
            tokensForPacket1,
            amountsForPacket1
        );
        bytes memory packet2 = abi.encode(
            bytes("0x777000622973412F5edc6F8EAd3A06CD614f66b0"),
            tokensForPacket2,
            amountsForPacket2
        );

        bytes[] memory dataArray = new bytes[](2);

        dataArray[0] = abi.encodeWithSignature(
            "iReceive(string,bytes,string)",
            "routerMiddlewareAddress",
            packet1,
            "chainId"
        );
        dataArray[1] = abi.encodeWithSignature(
            "iReceive(string,bytes,string)",
            "routerMiddlewareAddress",
            packet2,
            "chainId"
        );
        assetForwarder.multicall(dataArray);
    }

    function testIRecieveReverts() public {
        address[] memory tokens = new address[](2);
        uint[] memory amounts = new uint[](1);

        amounts[0] = 1000;

        tokens[0] = address(route);
        tokens[1] = address(usdc);

        bytes memory packet = abi.encode(
            address(0x777000622973412F5edc6F8EAd3A06CD614f66b0),
            tokens,
            amounts
        );
        vm.startPrank(msg.sender);
        vm.expectRevert(InvalidGateway.selector);
        assetForwarder.iReceive("routerMiddlewareAddress", packet, "chainId");
        vm.stopPrank();

        vm.expectRevert(InvalidRequestSender.selector);
        assetForwarder.iReceive("routerMiddleware", packet, "chainId");

        vm.expectRevert(InvalidRefundData.selector);
        assetForwarder.iReceive("routerMiddlewareAddress", packet, "chainId");
    }

    function testIDepositMessage() public {
        assetForwarder.iDepositMessage{value: 100000}(
            IAssetForwarder.DepositData(
                1,
                100000,
                1000,
                address(usdc),
                msg.sender,
                bytes32("dst_chainId")
            ),
            bytes("dst_token"),
            bytes("recipient"),
            bytes("chainId")
        );
    }

    //Test relay message being executed on dummy contracts
    function testIRelayMessage() public {
        //message payload
        bytes memory payload = abi.encode(address(dummy), bytes("message"));

        address recip = address(interactor);

        IAssetForwarder.RelayDataMessage
            memory relayDataMessage = IAssetForwarder.RelayDataMessage({
                amount: 1000,
                srcChainId: bytes32("chainId"),
                depositId: 1,
                destToken: address(token),
                recipient: recip,
                message: payload
            });
        assetForwarder.iRelayMessage{value: 100000}(relayDataMessage);

        //checking retry to be reverted
        vm.expectRevert(MessageAlreadyExecuted.selector);
        assetForwarder.iRelayMessage{value: 100000}(relayDataMessage);

        //expect balance of interactor contract to be destination amount
        uint interactorTokenBalance = token.balanceOf(recip);
        assertEq(interactorTokenBalance, 1000);

        //expect count of dummy contract to be incremented
        uint count = dummy.count();
        assertEq(count, 1);
    }

    function testUpdatePauseStakeAmount() public {
        uint256 newMin = 1;
        uint256 newMax = 10;
        assetForwarder.update(3, address(0), "", newMin, newMax);
        assertEq(assetForwarder.pauseStakeAmountMin(), newMin);
        assertEq(assetForwarder.pauseStakeAmountMax(), newMax);
    }

    function testCommunityPauseDefault() public {
        assertTrue(assetForwarder.isCommunityPauseEnabled());
    }

    function testToggleCommunityPause() public {
        assetForwarder.toggleCommunityPause();
        assertTrue(!assetForwarder.isCommunityPauseEnabled());
        assetForwarder.toggleCommunityPause();
        assertTrue(assetForwarder.isCommunityPauseEnabled());
    }

    function testCommunityPause() public {
        uint256 newMin = 1;
        uint256 newMax = 3;
        assetForwarder.update(3, address(0), "", newMin, newMax);
        uint256 initialAmount1 = assetForwarder.pauseStakeAmountMin() + 1;
        assetForwarder.communityPause{value: initialAmount1}();
        assertTrue(assetForwarder.depositPause());
        assertTrue(assetForwarder.relayPause());
        assertEq(assetForwarder.totalStakedAmount(), initialAmount1);
    }

    function testWithdrawStakeAmount() public {
        uint256 newMin = 1;
        uint256 newMax = 3;
        assetForwarder.update(3, address(0), "", newMin, newMax);
        uint256 initialAmount = assetForwarder.pauseStakeAmountMin() + 1;
        assertEq(initialAmount, 2);
        assetForwarder.communityPause{value: initialAmount}();
        uint256 initialBalance = address(this).balance;
        assetForwarder.withdrawStakeAmount();
        assertEq(address(this).balance, initialBalance + initialAmount);
    }

    receive() external payable {}
}
