// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "../Utils.sol";
import "../SignatureUtils.sol";

library ValsetUpdate {
    function validateValsetPower(Utils.ValsetArgs calldata _newValset) public pure {
        uint64 cumulativePower = 0;
        for (uint64 i = 0; i < _newValset.powers.length; i++) {
            cumulativePower = cumulativePower + _newValset.powers[i];
            if (cumulativePower > Utils.CONSTANT_POWER_THRESHOLD) {
                break;
            }
        }

        if (cumulativePower <= Utils.CONSTANT_POWER_THRESHOLD) {
            revert Utils.InsufficientPower({
                cumulativePower: cumulativePower,
                powerThreshold: Utils.CONSTANT_POWER_THRESHOLD
            });
        }
    }

    function updateValsetChecks(
        // The new version of the validator set
        Utils.ValsetArgs calldata _newValset,
        // The current validators that approve the change
        Utils.ValsetArgs calldata _currentValset
    ) public pure {
        // Check that the valset nonce is greater than the old one
        if (_newValset.valsetNonce <= _currentValset.valsetNonce) {
            revert Utils.InvalidValsetNonce({
                newNonce: _newValset.valsetNonce,
                currentNonce: _currentValset.valsetNonce
            });
        }

        // Check that the valset nonce is less than a million nonces forward from the old one
        // this makes it difficult for an attacker to lock out the contract by getting a single
        // bad validator set through with uint256 max nonce
        if (_newValset.valsetNonce > _currentValset.valsetNonce + 1000000) {
            revert Utils.InvalidValsetNonce({
                newNonce: _newValset.valsetNonce,
                currentNonce: _currentValset.valsetNonce
            });
        }

        // Check that new validators and powers set is well-formed
        if (_newValset.validators.length != _newValset.powers.length || _newValset.validators.length == 0) {
            revert Utils.MalformedNewValidatorSet();
        }

        // Check cumulative power to ensure the contract has sufficient power to actually
        // pass a vote
        validateValsetPower(_newValset);
    }
}
