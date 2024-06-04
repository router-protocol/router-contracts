// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "./interface/IUniswapV2Factory.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

library DisableFlags {
    function check(uint256 flags, uint256 flag) internal pure returns (bool) {
        return (flags & flag) != 0;
    }
}

contract FetchLiquidity {
    using SafeMath for uint256;
    using DisableFlags for uint256;

    IUniswapV2Factory internal constant uniswapV2 = IUniswapV2Factory(0xb9FFd4f89A86a989069CAcaE90e9ce824D0c4971);
    IUniswapV2Factory internal constant dfynExchange = IUniswapV2Factory(0xb9FFd4f89A86a989069CAcaE90e9ce824D0c4971);
    IUniswapV2Factory internal constant pancakeSwap = IUniswapV2Factory(0xb9FFd4f89A86a989069CAcaE90e9ce824D0c4971);
    IUniswapV2Factory internal constant quickSwap = IUniswapV2Factory(0xb9FFd4f89A86a989069CAcaE90e9ce824D0c4971);
    IUniswapV2Factory internal constant sushiSwap = IUniswapV2Factory(0xb9FFd4f89A86a989069CAcaE90e9ce824D0c4971);

    uint256 internal constant FLAG_ENABLE_DFYN = 1;
    uint256 internal constant FLAG_ENABLE_UNISWAP_V2 = 2;
    uint256 internal constant FLAG_ENABLE_PANCAKESWAP = 3;
    uint256 internal constant FLAG_ENABLE_QUICKSWAP = 4;
    uint256 internal constant FLAG_ENABLE_SUSHISWAP = 5;

    struct dexResponse {
        IERC20Upgradeable _fromToken;
        IERC20Upgradeable _destToken;
        uint112 _reserve0;
        uint112 _reserve1;
        uint112 _exchangeCode;
    }

    function getLiquidityReserves(
        IERC20Upgradeable[2][] calldata tokensIn,
        uint256[] calldata exchangeIds
    ) external view returns (dexResponse[] memory response) {
        return _getReserves(exchangeIds, tokensIn);
    }

    function _getReserves(
        uint256[] memory exchangeIds,
        IERC20Upgradeable[2][] memory tokensIn
    ) internal view returns (dexResponse[] memory) {
        dexResponse[] memory response = new dexResponse[](
            tokensIn.length * exchangeIds.length
        );
        uint256 actualLength = 0;
        for (uint256 index = 0; index < exchangeIds.length; index++) {
            uint256 exchangeId = exchangeIds[index];
            (
                IUniswapV2Factory exchangeInstance,
                uint256 exchangeCode
            ) = _getExchangeInstance(exchangeId);
            dexResponse[] memory data = _getLiquidityMulti(
                tokensIn,
                exchangeInstance,
                exchangeCode
            );

            for (uint256 j = 0; j < data.length; j++) {
                response[actualLength + j] = data[j];
            }
            actualLength += data.length;
        }
        return response;
    }

    function _getLiquidityMulti(
        IERC20Upgradeable[2][] memory tokensIn,
        IUniswapV2Factory exchangeInstance,
        uint256 exchangeCode
    ) internal view returns (dexResponse[] memory response) {
        response = new dexResponse[](tokensIn.length);
        for (uint256 i = 0; i < tokensIn.length; i++) {
            (
                IERC20Upgradeable _fromToken,
                IERC20Upgradeable _destToken,
                uint112 _reserve0,
                uint112 _reserve1,

            ) = _calculateExchange(
                    tokensIn[i][0],
                    tokensIn[i][1],
                    exchangeInstance
                );
            response[i] = dexResponse(
                _fromToken,
                _destToken,
                _reserve0,
                _reserve1,
                uint112(exchangeCode)
            );
        }
        return response;
    }

    function _calculateExchange(
        IERC20Upgradeable fromToken,
        IERC20Upgradeable destToken,
        IUniswapV2Factory exchangeInstance
    )
        internal
        view
        returns (
            IERC20Upgradeable _fromToken,
            IERC20Upgradeable _destToken,
            uint112 _reserve0,
            uint112 _reserve1,
            uint32 _blockTimestampLast
        )
    {
        IUniswapV2Exchange exchange = exchangeInstance.getPair(
            fromToken,
            destToken
        );
        if (exchange != IUniswapV2Exchange(address(0))) {
            (_reserve0, _reserve1, ) = exchange.getReserves();
            return (
                fromToken,
                destToken,
                _reserve0,
                _reserve1,
                _blockTimestampLast
            );
        }
        return (fromToken, destToken, 0, 0, 0);
    }

    function _getExchangeInstance(
        uint256 flags
    ) internal pure returns (IUniswapV2Factory, uint256) {
        if (flags == FLAG_ENABLE_DFYN) {
            return (dfynExchange, FLAG_ENABLE_DFYN);
        } else if (flags == FLAG_ENABLE_UNISWAP_V2) {
            return (uniswapV2, FLAG_ENABLE_UNISWAP_V2);
        } else if (flags == FLAG_ENABLE_PANCAKESWAP) {
            return (pancakeSwap, FLAG_ENABLE_PANCAKESWAP);
        } else if (flags == FLAG_ENABLE_QUICKSWAP) {
            return (quickSwap, FLAG_ENABLE_QUICKSWAP);
        } else if (flags == FLAG_ENABLE_SUSHISWAP) {
            return (sushiSwap, FLAG_ENABLE_SUSHISWAP);
        }
    }
}
