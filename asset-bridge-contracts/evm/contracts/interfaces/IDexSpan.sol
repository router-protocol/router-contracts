// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

abstract contract IDexSpan {
    function swapMultiWithRecipient(
        address[] memory tokens,
        uint256 amount,
        uint256 minReturn,
        uint256[] memory flags,
        bytes[] memory dataTx,
        bool isWrapper,
        address recipient
    ) public payable virtual returns (uint256 returnAmount);
}
