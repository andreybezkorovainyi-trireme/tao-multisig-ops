# Bittensor Multisig Operations (tao-multisig-ops)

This repository provides a complete suite of Node.js scripts to manage a Bittensor multisig wallet. It facilitates secure collaboration between multiple parties (signatories) to create proposals, approve transactions, assign proxies, register the wallet to subnets, and execute staking operations through a proxy.

## Prerequisites & Setup

1. **Install Dependencies:**
   Ensure you have Node.js installed, then run:
   ```bash
   npm install
   ```

2. **Environment Variables (.env):**
   Create a `.env` file in the root of the project. A template of the required variables is as follows:

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

   # Proxy Configuration
   STAKING_PROXY_ADDRESS=5...
   # Only needed for the person running 'proxy_execute'
   STAKING_PROXY_SEED_PHRASE=
   ```

   **Important Note on Seed Phrases:**
   You do **not** need the seed phrases of the other signatories. You only need to configure the `_ADDRESS` for all participants, and your own personal `_SEED_PHRASE` (e.g., if you are Signatory A, you only set `SIGNATORY_A_SEED_PHRASE`). Keep your seed phrase secure and never commit your `.env` file!

## Available Scripts

### Utility Scripts
- `npm run multisig_address`: Generates and prints the derived multisig address based on the signatories and threshold in your `.env`.
- `npm run multisig_balance`: Queries the network for the current TAO balance and Alpha balance (in the configured `SUBNET_ID`) of the multisig wallet.
- `npm run multisig_proxies`: Checks if the multisig wallet has any proxies assigned to it.

### Proxy Execution
- `npm run proxy_execute <stake|unstake> <amount_in_TAO>`: After a proxy has been successfully assigned via the voting scripts, the holder of the `STAKING_PROXY_SEED_PHRASE` can run this script to stake or unstake funds on behalf of the multisig without needing signatures from the others.

### Voting Scripts (Proposals)
Because this is a multisig wallet, transactions cannot be executed instantly by one person. They must be proposed, and then approved by enough signatories to meet the `MULTISIG_THRESHOLD`.

There are three types of operations that require voting:
1. **Init Proxy:** `npm run vote_proxy_<A|B|C>` (Assigns the `STAKING_PROXY_ADDRESS` as a staking proxy to the multisig).
2. **Register Wallet:** `npm run vote_register_<A|B|C>` (Registers the multisig wallet to the `SUBNET_ID`).
3. **Transfer Funds:** `npm run vote_transfer_<A|B|C> <destination> <amount> [TAO|ALPHA]` (Transfers TAO or Alpha from the multisig).

## Example Workflow: Adding a Proxy

Adding a proxy requires an on-chain deposit. 
> ⚠️ **CRITICAL:** Before initiating a proxy addition, the multisig wallet **must** have a small amount of base TAO transferred to it. Adding a proxy requires a locked deposit (`ProxyDepositBase` + `ProxyDepositFactor`), which is usually around ~0.093 TAO on the mainnet. If the wallet balance is zero, the transaction will fail silently upon execution!

**Step 1: Signatory A Initiates the Proposal**
Signatory A configures their `SIGNATORY_A_SEED_PHRASE` in the `.env` file and runs:
```bash
npm run vote_proxy_A
```
*Result:* The script recognizes there is no active proposal, creates one, and broadcasts it to the network. The transaction hash is logged.

**Step 2: Signatory B Approves the Proposal**
Signatory B configures their `SIGNATORY_B_SEED_PHRASE` and runs:
```bash
npm run vote_proxy_B
```
*Result:* The script detects the active proposal waiting for signatures. Signatory B's script signs precisely the same call hash. Assuming the `MULTISIG_THRESHOLD` is 2, this second signature triggers the actual execution of the `addProxy` call. The script will wait for block finalization and confirm that the proxy was successfully added!

*(Note: Any signatory can be the one to initiate or approve; the scripts automatically sort addresses safely behind the scenes to maintain determinism).*
