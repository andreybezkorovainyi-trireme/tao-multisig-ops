# Bittensor Multisig Operations (tao-multisig-ops)

This repository provides a complete suite of Node.js scripts to manage a Bittensor multisig wallet. It facilitates secure collaboration between multiple parties (signatories) to create proposals, approve transactions, assign proxies, register the wallet to subnets, and execute staking operations through a proxy.

## Prerequisites & Setup

> **Note:** For a detailed explanation of the assumed wallet roles and step-by-step transaction examples, please see the [Workflow Guide](WORKFLOW.md).

1. **Install Dependencies:**
   Supports both npm and pnpm (pnpm is configured to hoist `@polkadot/*` packages):

   ```bash
   npm install
   # or
   pnpm install
   ```

2. **Environment Variables (.env):**
   Create a `.env` file in the root of the project. **All participants must agree on the core variables and never change them for same wallet.** The multisig address is mathematically derived purely from these public keys and the threshold:
   - `MULTISIG_THRESHOLD`
   - `SIGNATORY_A_ADDRESS`
   - `SIGNATORY_B_ADDRESS`
   - `SIGNATORY_C_ADDRESS`

   If you ever need a different multisig wallet, you must create a new `.env` configuration. A template of the variables is as follows:

   ```env
   # Network settings
   RPC_URL=wss://test.finney.opentensor.ai
   SUBNET_ID=10

   # Multisig configuration
   MULTISIG_THRESHOLD=2

   # Signatory Addresses (Public Keys)
   SIGNATORY_A_ADDRESS=5...
   SIGNATORY_B_ADDRESS=5...
   SIGNATORY_C_ADDRESS=5...

   # Signatory Seed Phrases
   SIGNATORY_A_SEED_PHRASE=your seed phrase here...
   SIGNATORY_B_SEED_PHRASE=
   SIGNATORY_C_SEED_PHRASE=

   # Proxy Configuration (Set this to SIGNATORY_A_ADDRESS)
   STAKING_PROXY_ADDRESS=5...
   # Only needed for the person running 'proxy_execute' (Signatory A)
   STAKING_PROXY_SEED_PHRASE=

   # Validator hotkey the proxy stakes to (used by proxy_execute)
   VALIDATOR_HOTKEY_ADDRESS=5...
   ```

   **Important Note on Seed Phrases:**
   You do **not** need the seed phrases of the other signatories. You only need to configure the `_ADDRESS` for all participants, and your own personal `_SEED_PHRASE` (e.g., if you are Signatory A, you only set `SIGNATORY_A_SEED_PHRASE`). Keep your seed phrase secure and never commit your `.env` file!

## Available Scripts

### Utility Scripts

- `npm run multisig_address` — Generates and prints the derived multisig address based on the signatories and threshold in your `.env`.
- `npm run multisig_balance` — Queries the current TAO balance (free / reserved / liquid) and all Alpha staking positions across all validators for the configured `SUBNET_ID`.
- `npm run multisig_proxies` — Lists all proxies currently assigned to the multisig wallet.
- `npm run check_deposits` — Checks whether each signatory has enough TAO to initiate a multisig proposal, and whether the multisig itself has enough to add a proxy. Useful for troubleshooting `balances.InsufficientBalance` errors.
- `npm run diagnose_balance` — Prints low-level balance locks, freezes, holds, and subnet registration status. Useful when a transfer fails with `token.Frozen` despite a non-zero free balance.

### Proxy Execution

- `npm run proxy_execute <stake|unstake> <amount_in_TAO>` — After a proxy has been successfully assigned via the voting scripts, the holder of the `STAKING_PROXY_SEED_PHRASE` can run this script to stake or unstake funds on behalf of the multisig without needing signatures from the other signatories.

### Voting Scripts (Proposals)

Because this is a multisig wallet, transactions cannot be executed instantly by one person. They must be proposed and then approved by enough signatories to meet the `MULTISIG_THRESHOLD`.

There are four types of operations that require voting:

1. **Add Proxy:** `npm run vote_add_proxy_<A|B|C>` — Assigns `STAKING_PROXY_ADDRESS` as a Staking proxy to the multisig.
2. **Remove Proxy:** `npm run vote_remove_proxy_<A|B|C>` — Removes the Staking proxy from the multisig.
3. **Register Wallet:** `npm run vote_register_<A|B|C>` — Registers the multisig wallet to the configured `SUBNET_ID`.
4. **Transfer Funds:** `npm run vote_transfer_<A|B|C> <destination> <amount> [TAO|ALPHA]` — Transfers TAO or Alpha from the multisig.

