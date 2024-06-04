// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract TestSequencer {
    using SafeERC20 for IERC20;

    // depositReserveTokenAndExecute(bool,bool,bytes,bytes,bytes)
    bytes4 public constant DEPOSIT_RESERVE_AND_EXECUTE_SELECTOR = 0xf64d944a;
    // depositNonReserveTokenAndExecute(bool,bool,bytes,bytes,bytes)
    bytes4 public constant DEPOSIT_NON_RESERVE_AND_EXECUTE_SELECTOR = 0x79334b17;
    // depositLPTokenAndExecute(bool,bytes,bytes,bytes)
    bytes4 public constant DEPOSIT_LP_AND_EXECUTE_SELECTOR = 0xe18cfa35;

    address public admin;
    string public greeting;
    address public voyagerDepositHandler;
    address public voyagerExecuteHandler;

    // chainIdBytes => Our contract address on that chain
    mapping(bytes32 => address) public ourContractsOnChain;

    event SequencerCallReceived(address settlementToken, uint256 settlementAmount, string greeting);

    constructor(address _voyagerDepositHandler, address _voyagerExecuteHandler) {
        voyagerDepositHandler = _voyagerDepositHandler;
        voyagerExecuteHandler = _voyagerExecuteHandler;
        admin = msg.sender;
    }

    function setContractsOnChain(bytes32 chainIdBytes, address contractAddr) external {
        require(msg.sender == admin, "only admin");
        ourContractsOnChain[chainIdBytes] = contractAddr;
    }

    function sendCrossChainRequest(
        bytes4 selector,
        bool isSourceNative,
        bool isAppTokenPayer,
        uint64 gasLimit,
        uint64 gasPrice,
        bytes memory swapData,
        bytes memory executeData
    ) external payable {
        bytes32 destChainIdBytes = abi.decode(swapData, (bytes32));

        bytes memory arbitraryData = abi.encode(
            toBytes(ourContractsOnChain[destChainIdBytes]),
            abi.encode("hello"),
            toBytes(msg.sender),
            gasLimit,
            gasPrice
        );

        bool success;

        if (selector == DEPOSIT_RESERVE_AND_EXECUTE_SELECTOR || selector == DEPOSIT_NON_RESERVE_AND_EXECUTE_SELECTOR) {
            (success, ) = voyagerDepositHandler.call{ value: msg.value }(
                abi.encodeWithSelector(selector, isSourceNative, isAppTokenPayer, swapData, executeData, arbitraryData)
            );
        } else {
            (success, ) = voyagerDepositHandler.call{ value: msg.value }(
                abi.encodeWithSelector(selector, isAppTokenPayer, swapData, executeData, arbitraryData)
            );
        }

        require(success, "unsuccessful");
    }

    function voyagerReceive(
        address sourceSenderAddress,
        bytes32 srcChainIdBytes,
        bytes memory data,
        address settlementToken,
        uint256 settlementAmount
    ) external {
        require(msg.sender == voyagerExecuteHandler, "only voyager execute handler");
        require(sourceSenderAddress == ourContractsOnChain[srcChainIdBytes], "not our contract");

        // Just to check that tokens are received
        IERC20(settlementToken).safeTransfer(admin, settlementAmount);

        string memory _greeting = abi.decode(data, (string));
        greeting = _greeting;

        emit SequencerCallReceived(settlementToken, settlementAmount, _greeting);
    }

    function toBytes(address addr) internal pure returns (bytes memory b) {
        assembly {
            let m := mload(0x40)
            addr := and(addr, 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)
            mstore(add(m, 20), xor(0x140000000000000000000000000000000000000000, addr))
            mstore(0x40, add(m, 52))
            b := m
        }
    }
}
