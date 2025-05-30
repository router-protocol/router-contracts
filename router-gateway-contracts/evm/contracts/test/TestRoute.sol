// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "../ERC20Token.sol";

contract TestRoute is ERC20Token {
    constructor() ERC20Token("TestRoute", "TRoute", 18) {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }
}
