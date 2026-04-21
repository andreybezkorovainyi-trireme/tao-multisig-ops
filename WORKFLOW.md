# Multisig Workflow Guide

This document explains the standard operating procedure for the multisig setup, roles, and the step-by-step example of assigning a Staking Proxy.

## Wallets & Roles

In this setup, there are three participants (signatories), each generating their own separate account (public address and private seed phrase). To reduce the total number of wallets needed, one signatory also assumes the role of the staking proxy.

1. **Signatory A + Proxy** (Takes responsibility for staking operations)
2. **Signatory B**
3. **Signatory C**

# Balance Requirements

Before executing any multisig operations, ensure the following wallets have sufficient TAO:

| Wallet | Required balance | Why |
|--------|-----------------|-----|
| **Signatory who initiates** (first vote) | ≥ 0.196 TAO free | Substrate reserves `DepositBase (0.132) + DepositFactor × 2 (0.064)` from the initiator's account. Returned after proposal executes. |
| **Signatories who join** (subsequent votes) | ~0.001 TAO | Only tx fees. No deposit required. |
| **Multisig wallet** | ≥ ~0.093 TAO free | Required for adding a proxy (`ProxyDepositBase + ProxyDepositFactor`). Locked until proxy is removed. |

> **Tip:** Run `npm run check_deposits` to see exact on-chain deposit constants and whether each wallet currently meets the requirements.

> ⚠️ **Only the initiator pays the proposal deposit.** If your balance is too low to initiate, ask another signatory with sufficient funds to run the `_A`, `_B`, or `_C` variant first — then join with your own script.

# Suggested Workflow

## 1. Adding a "Staking" Proxy

Before running the first `vote_proxy`, all participants must collaboratively agree to set `STAKING_PROXY_ADDRESS=SIGNATORY_A_ADDRESS` (or whichever signatory you chose) in their `.env` files. In this setup, Signatory A acts as both a signer and the staking proxy. This is done for convenience to reduce the number of wallets in the system. You can view the list of active proxies on the wallet at any time by running the `npm run multisig_proxies` script. The Staking proxy type allows the delegate to:

- Add stake to validator hotkeys
- Remove stake from validator hotkeys
- Unstake tokens
- Move stake between validators and subnets
- Swap stake between validators

The Staking proxy type does not allow transfers, registrations, or other non-staking operations, providing a secure way to delegate only staking responsibilities

> ⚠️ **CRITICAL:** Adding a proxy requires an on-chain deposit. Before initiating a proxy addition, the multisig wallet **must** have a small amount of base TAO transferred to it. Adding a proxy requires a locked deposit (`ProxyDepositBase` + `ProxyDepositFactor`), which is usually around ~0.093 TAO on the mainnet. If the wallet balance is zero, the transaction will fail silently upon execution!

### 1.1 Signatory A Initiates the Proposal

Signatory A configures their `SIGNATORY_A_SEED_PHRASE` in the `.env` file and runs:

```bash
npm run vote_proxy_A
```

_Result:_ The script recognizes there is no active proposal, creates a call to add STAKING_PROXY_ADDRESS as a proxy to the multisig wallet, and broadcasts it to the network. The transaction hash is logged.

### 1.2 Signatory B Approves the Proposal

Signatory B configures their `SIGNATORY_B_SEED_PHRASE` and runs:

```bash
npm run vote_proxy_B
```

_Result:_ The script detects the active proposal waiting for signatures. Signatory B's script signs precisely the same call hash. Assuming the `MULTISIG_THRESHOLD` is 2, this second signature triggers the actual execution of the `addProxy` call. The script will wait for block finalization and confirm that the proxy was successfully added!

_(Note: Any signatory can be the one to initiate or approve; the scripts automatically sort addresses safely behind the scenes to maintain determinism)._

## 2. Registering the Multisig Wallet to a Subnet

Before running the first `vote_register`, all participants must collaboratively agree to set `SUBNET_ID` in their `.env` files.

### 2.1 Signatory A Initiates the Proposal

Signatory A configures their `SIGNATORY_A_SEED_PHRASE` in the `.env` file and runs:

```bash
npm run vote_register_A
```

### 2.2 Signatory B Approves the Proposal

Signatory B configures their `SIGNATORY_B_SEED_PHRASE` and runs:

```bash
npm run vote_register_B
```
