import { Keyring } from '@polkadot/api';
import { createKeyMulti } from '@polkadot/util-crypto';
import { Env } from './validate-env.js';

/**
 * Creates a multisig address for Bittensor network (ss58Format: 42)
 * @param {string[]} addresses - Array of signatory addresses
 * @param {number} _threshold - Number of required signatures
 * @returns {string} The multisig address
 */
export function generateMultisigAddress(_signatories, _threshold) {
  const { signatories, threshold } =
    _signatories && _threshold
      ? { signatories: _signatories, threshold: _threshold }
      : Env;

  const keyring = new Keyring({ type: 'sr25519', ss58Format: 42 }); // Format Bittensor - 42

  // createKeyMulti automatically sorts addresses (required network requirement)
  const multiAddressAsBytes = createKeyMulti(signatories, threshold);
  const address = keyring.encodeAddress(multiAddressAsBytes, 42);

  console.log(`Multisig address: ${address}`);
  return address;
}

generateMultisigAddress();
