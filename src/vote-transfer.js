import { ApiPromise, Keyring, WsProvider } from '@polkadot/api';
import { validateEnv, validateSeedPhrase } from './validate-env.js';
import { sortAddresses } from '@polkadot/util-crypto';
import { generateMultisigAddress } from './generate-multisig-address.js';
import { config } from 'dotenv';

config();

// Get arguments from command line
const signatoryId = process.argv[2];
const destinationAddress = process.argv[3];
const amountStr = process.argv[4];
// Optional 5th argument: 'TAO' or 'ALPHA' (defaults to TAO)
const currencyType = process.argv[5]?.toUpperCase();

if (
  !['A', 'B', 'C'].includes(signatoryId) ||
  !destinationAddress ||
  !amountStr ||
  isNaN(parseFloat(amountStr)) ||
  !['TAO', 'ALPHA'].includes(currencyType)
) {
  console.error('Usage: npm run vote_transfer <A|B|C> <destination_address> <amount> [TAO|ALPHA]');
  console.error(
    'Example: npm run vote_transfer A 5Fpemt6xxiZx6JdxVi1HcB7v3fcUdKcdqPSfcURqYdwvnsoH 0.1 TAO',
  );
  process.exit(1);
}

const amountRao = BigInt(Math.floor(parseFloat(amountStr) * 1e9));

async function voteTransfer() {
  const env = validateEnv();
  const { rpcUrl, threshold, signatories, subnetId } = env;

  const seedPhraseKey = `signatory${signatoryId}SeedPhrase`;
  const mySeedPhrase = env[seedPhraseKey];
  validateSeedPhrase(mySeedPhrase);

  const multisigAddress = generateMultisigAddress(signatories, threshold);

  console.log(`🔗 Connecting to ${rpcUrl}...`);
  const provider = new WsProvider(rpcUrl);
  const api = await ApiPromise.create({ provider });
  const keyring = new Keyring({ type: 'sr25519' });

  const myKeyring = keyring.addFromMnemonic(mySeedPhrase);

  // Array of other signatories (sorted)
  const myAddress = env[`signatory${signatoryId}`];
  const otherSignatories = sortAddresses(signatories.filter((addr) => addr !== myAddress));

  console.log(`👤 Voting as: ${myAddress} (Signatory ${signatoryId})`);
  console.log(`🏘️ Multisig Address: ${multisigAddress}`);
  console.log(`➡️ Destination: ${destinationAddress}`);
  console.log(`💸 Amount: ${amountStr} ${currencyType} (${amountRao.toString()} RAO equiv)`);

  let transferCall;
  if (currencyType === 'TAO') {
    transferCall = api.tx.balances.transferAllowDeath(destinationAddress, amountRao);
  } else {
    // ALPHA transfers are handled via subtensorModule.transferStake
    // destinationColdkey, hotkey, originNetuid, destinationNetuid, alphaAmount
    console.log(`📡 Transferring ALPHA on Subnet: ${subnetId}`);
    transferCall = api.tx.subtensorModule.transferStake(
      destinationAddress,
      multisigAddress, // hotkey is the multisig itself
      subnetId, // origin subnet
      subnetId, // destination subnet
      amountRao, // precision is 1e9 RAO
    );
  }

  const callHash = transferCall.method.hash.toHex();

  // Check if there is an active proposal for this call
  const multisigEntries = await api.query.multisig.multisigs(multisigAddress, callHash);

  let tx;

  if (multisigEntries.isEmpty) {
    console.log(`📝 No active proposal found. INITIATING new transfer proposal...`);
    // First vote -> timepoint is null, maxWeight is { refTime: 0, proofSize: 0 }
    tx = api.tx.multisig.asMulti(threshold, otherSignatories, null, transferCall.method.toHex(), {
      refTime: 0,
      proofSize: 0,
    });
  } else {
    // There is an active proposal, let's JOIN it
    const info = multisigEntries.unwrap();

    // Check if we already voted
    const hasVoted = info.approvals.some((a) => a.toString() === myAddress);
    if (hasVoted) {
      console.log(`❌ You have already voted for this proposal!`);
      process.exit(0);
    }

    const approvalsCount = info.approvals.length;
    console.log(`✅ Found active proposal! Current approvals: ${approvalsCount}/${threshold}`);

    // If our vote will hit the threshold, we need the exact weight of the call
    let maxWeight;
    const willExecute = approvalsCount + 1 >= threshold;

    if (willExecute) {
      console.log(`💥 This vote will EXECUTE the proposal. Calculating actual weight...`);
      const callInfo = await transferCall.paymentInfo(myAddress);
      maxWeight = callInfo.weight;
    } else {
      console.log(
        `➕ This vote will APPROVE the proposal (but more votes needed). Set weight to 0.`,
      );
      maxWeight = { refTime: 0, proofSize: 0 };
    }

    tx = api.tx.multisig.asMulti(
      threshold,
      otherSignatories,
      info.when, // Timepoint of the very first transaction
      transferCall.method.toHex(),
      maxWeight,
    );
  }

  console.log(`✍️ Signing and sending transaction...`);
  console.log(`🔗 Transaction Hash: ${tx.hash.toHex()}`);

  await tx.signAndSend(myKeyring, ({ status, events, dispatchError }) => {
    if (status.isInBlock) {
      console.log(`✔️ Transaction included in block: ${status.asInBlock}`);
    } else if (status.isFinalized) {
      console.log(`✅ Transaction finalized in block: ${status.asFinalized}`);

      if (dispatchError) {
        if (dispatchError.isModule) {
          const decoded = api.registry.findMetaError(dispatchError.asModule);
          const { docs, name, section } = decoded;
          console.error(`❌ Transaction failed: ${section}.${name}: ${docs.join(' ')}`);
        } else {
          console.error(`❌ Transaction failed: ${dispatchError.toString()}`);
        }
        process.exit(1);
      } else {
        // Look through events to see if MultisigExecution happened
        const isExecuted = events.some(({ event }) =>
          api.events.multisig.MultisigExecuted.is(event),
        );

        if (isExecuted) {
          console.log(
            `🎉 TRANSFER OF ${amountStr} ${currencyType} TO ${destinationAddress} HAS BEEN SUCCESSFULLY EXECUTED!`,
          );
        } else {
          console.log('🎉 Vote successfully recorded! Waiting for more signatures.');
        }
        process.exit(0);
      }
    } else {
      console.log(`⏳ Current status: ${status.type}`);
    }
  });
}

voteTransfer().catch(console.error);
