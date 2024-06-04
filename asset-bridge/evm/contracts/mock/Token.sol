// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract Token is ERC20, Pausable, AccessControl {
    uint8 private _decimals;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_
    ) ERC20(name_, symbol_) Pausable() AccessControl() {
        _setDecimals(decimals_);
        _setupRole(PAUSER_ROLE, _msgSender());
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());

        // only for testing purposes
        _mint(msg.sender, 1000000000000000000000000);
    }

    /// @notice Used to set decimals
    /// @param decimal Value of decimal
    function _setDecimals(uint8 decimal) internal {
        _decimals = decimal;
    }

    /// @notice Fetches decimals
    /// @return Returns Value of decimals that is set
    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    /// @notice Used to pause the token
    /// @notice Only callable by an address that has Pauser Role
    /// @return Returns true when paused
    function pauseToken() public virtual onlyRole(PAUSER_ROLE) returns (bool) {
        _pause();
        return true;
    }

    /// @notice Used to unpause the token
    /// @notice Only callable by an address that has Pauser Role
    /// @return Returns true when unpaused
    function unpauseToken() public virtual onlyRole(PAUSER_ROLE) returns (bool) {
        _unpause();
        return true;
    }

    /// @notice Mints `_value` amount of tokens to address `_to`
    /// @notice Only callable by an address that has Minter Role.
    /// @param _to Recipient address
    /// @param _value Amount of tokens to be minted to `_to`
    /// @return Returns true if minted succesfully
    function mint(address _to, uint256 _value) public virtual whenNotPaused onlyRole(MINTER_ROLE) returns (bool) {
        _mint(_to, _value);
        return true;
    }

    /// @notice Destroys `_value` amount of tokens from `_from` account
    /// @notice Only callable by an address that has Burner Role.
    /// @param _from Address whose tokens are to be destroyed
    /// @param _value Amount of tokens to be destroyed
    /// @return Returns true if burnt succesfully
    function burn(address _from, uint256 _value) public virtual whenNotPaused onlyRole(BURNER_ROLE) returns (bool) {
        _burn(_from, _value);
        return true;
    }

    /// @dev See {ERC20-_beforeTokenTransfer}.
    ///
    /// Requirements:
    ///
    /// - the contract must not be paused.
    function _beforeTokenTransfer(address from, address to, uint256 amount) internal virtual override {
        super._beforeTokenTransfer(from, to, amount);

        require(!paused(), "ERC20Pausable: token transfer while paused");
    }
}
