import { ApiPromise, Keyring, WsProvider } from '@polkadot/api';
import { sortAddresses } from '@polkadot/util-crypto';
import { generateMultisigAddress } from './multisig-generate-address.js';
import { Env, validateSeedPhrase } from './validate-env.js';

// Get argument from command line
const signatoryId = process.argv[2];

if (!['A', 'B', 'C'].includes(signatoryId)) {
  console.error('Please specify which signatory you are: A, B, or C');
  console.error('Usage: npm run vote-register A');
  process.exit(1);
}

async function voteRegisterWallet() {
  const { rpcUrl, threshold, signatories, subnetId } = Env;
  const seedPhraseKey = `signatory${signatoryId}SeedPhrase`;
  const mySeedPhrase = Env[seedPhraseKey];
  validateSeedPhrase(mySeedPhrase);

  const multisigAddress = generateMultisigAddress(signatories, threshold);

  console.log(`🔗 Connecting to ${rpcUrl}...`);
  const provider = new WsProvider(rpcUrl);
  const api = await ApiPromise.create({ provider });
  const keyring = new Keyring({ type: 'sr25519' });

  const myKeyring = keyring.addFromMnemonic(mySeedPhrase);

  // Array of other signatories (sorted)
  const myAddress = Env[`signatory${signatoryId}`];
  const otherSignatories = sortAddresses(signatories.filter((addr) => addr !== myAddress));

  console.log(`👤 Voting as: ${myAddress} (Signatory ${signatoryId})`);
  console.log(`📡 Target Subnet: ${subnetId}`);

  // Base call we want to execute via Multisig
  const registerCall = api.tx.subtensorModule.burnedRegister(subnetId, multisigAddress);
  const callHash = registerCall.method.hash.toHex();

  // Check if there is an active proposal for this call
  const multisigEntries = await api.query.multisig.multisigs(multisigAddress, callHash);

  let tx;

  if (multisigEntries.isEmpty) {
    console.log(`📝 No active proposal found. INITIATING new registration proposal...`);
    // First vote -> timepoint is null, maxWeight is { refTime: 0, proofSize: 0 }
    tx = api.tx.multisig.asMulti(threshold, otherSignatories, null, registerCall.method.toHex(), {
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
      const callInfo = await registerCall.paymentInfo(myAddress);
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
      registerCall.method.toHex(),
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
          console.log(`🎉 WALLET HAS BEEN SUCCESSFULLY REGISTERED TO SUBNET ${subnetId}!`);
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

voteRegisterWallet().catch(console.error);
