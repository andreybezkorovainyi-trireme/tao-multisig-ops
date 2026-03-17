import { isAddress, sortAddresses } from '@polkadot/util-crypto';
import dotenv from 'dotenv';
dotenv.config();

export function validateEnv() {
  const {
    RPC_URL,
    MULTISIG_THRESHOLD,
    SIGNATORY_A_ADDRESS,
    SIGNATORY_B_ADDRESS,
    SIGNATORY_C_ADDRESS,
    SIGNATORY_A_SEED_PHRASE,
    SIGNATORY_B_SEED_PHRASE,
    SIGNATORY_C_SEED_PHRASE,
    STAKING_PROXY_ADDRESS,
    STAKING_PROXY_SEED_PHRASE,
    SUBNET_ID,
  } = process.env;

  if (isNaN(MULTISIG_THRESHOLD)) {
    throw new Error('MULTISIG_THRESHOLD is not a number');
  }

  if (isNaN(SUBNET_ID)) {
    throw new Error('SUBNET_ID is not a number');
  }

  for (const [name, address] of Object.entries({
    SIGNATORY_A_ADDRESS,
    SIGNATORY_B_ADDRESS,
    SIGNATORY_C_ADDRESS,
    STAKING_PROXY_ADDRESS,
  })) {
    if (!isAddress(address)) {
      throw new Error(`Invalid signatory address: ${name}: ${address}`);
    }
  }

  if (!RPC_URL || !RPC_URL.includes('wss://')) {
    throw new Error('Invalid RPC_URL');
  }

  return {
    subnetId: Number(SUBNET_ID),
    threshold: Number(MULTISIG_THRESHOLD),
    signatories: sortAddresses([SIGNATORY_A_ADDRESS, SIGNATORY_B_ADDRESS, SIGNATORY_C_ADDRESS]),
    signatoryA: SIGNATORY_A_ADDRESS,
    signatoryB: SIGNATORY_B_ADDRESS,
    signatoryC: SIGNATORY_C_ADDRESS,
    rpcUrl: RPC_URL,
    // Skip validation for seed pharases, validate in actual script
    signatoryASeedPhrase: SIGNATORY_A_SEED_PHRASE,
    signatoryBSeedPhrase: SIGNATORY_B_SEED_PHRASE,
    signatoryCSeedPhrase: SIGNATORY_C_SEED_PHRASE,

    stakingProxyAddress: STAKING_PROXY_ADDRESS,
    stakingProxySeedPhrase: STAKING_PROXY_SEED_PHRASE,
  };
}

export function validateSeedPhrase(seedPhrase) {
  if (!seedPhrase || seedPhrase.split(' ').length !== 12) {
    throw new Error('Invalid seed phrase');
  }
}
