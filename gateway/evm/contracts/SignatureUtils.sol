// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

// import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./libraries/ECDSA.sol";
import "./Utils.sol";

library SignatureUtils {
    error InvalidSignatureLength();

    function verifySig(
        address _signer,
        bytes32 _messageDigest,
        bytes32 r,
        bytes32 s,
        uint8 v
    ) private pure returns (bool) {
        return _signer == ECDSA.recover(_messageDigest, r, s, v);
    }

    function checkValidatorSignatures(
        // The current validator set and their powers
        Utils.ValsetArgs calldata _currentValset,
        // The current validator's signatures
        bytes[] calldata _sigs,
        // This is what we are checking they have signed
        bytes32 _theHash,
        uint64 _powerThreshold
    ) internal pure {
        uint64 cumulativePower = 0;

        for (uint64 i = 0; i < _currentValset.validators.length; i++) {
            if (_sigs[i].length != 65) revert InvalidSignatureLength();
            bytes memory sig = _sigs[i];

            // Divide the signature in r, s and v variables
            bytes32 r;
            bytes32 s;
            uint8 v;

            // ecrecover takes the signature parameters, and the only way to get them
            // currently is to use assembly.
            // solhint-disable-next-line no-inline-assembly
            assembly {
                r := mload(add(sig, 0x20))
                s := mload(add(sig, 0x40))
                v := byte(0, mload(add(sig, 0x60)))
            }

            // If v is set to 0, this signifies that it was not possible to get a signature
            // from this validator and we skip evaluation
            // (In a valid signature, it is either 27 or 28)
            if (v != 0) {
                // Check that the current validator has signed off on the hash
                if (!verifySig(_currentValset.validators[i], _theHash, r, s, v)) {
                    revert Utils.InvalidSignature();
                }

                // Sum up cumulative power
                cumulativePower = cumulativePower + _currentValset.powers[i];

                // Break early to avoid wasting gas
                if (cumulativePower > _powerThreshold) {
                    break;
                }
            }
        }

        // Check that there was enough power
        if (cumulativePower <= _powerThreshold) {
            revert Utils.InsufficientPower(cumulativePower, _powerThreshold);
        }
        // Success
    }
}
