import { ApiPromise, Keyring, WsProvider } from '@polkadot/api';
import { sortAddresses } from '@polkadot/util-crypto';
import { generateMultisigAddress } from './multisig-generate-address.js';
import { Env, validateSeedPhrase } from './validate-env.js';

const signatoryId = process.argv[2];

if (!['A', 'B', 'C'].includes(signatoryId)) {
  console.error('Usage: npm run vote_remove_proxy_<A|B|C>');
  process.exit(1);
}

async function voteRemoveProxy() {
  const { rpcUrl, threshold, signatories, stakingProxyAddress } = Env;

  const seedPhraseKey = `signatory${signatoryId}SeedPhrase`;
  const mySeedPhrase = Env[seedPhraseKey];
  validateSeedPhrase(mySeedPhrase);

  const multisigAddress = generateMultisigAddress(signatories, threshold);

  console.log(`🔗 Connecting to ${rpcUrl}...`);
  const provider = new WsProvider(rpcUrl);
  const api = await ApiPromise.create({ provider });
  const keyring = new Keyring({ type: 'sr25519' });

  const myKeyring = keyring.addFromMnemonic(mySeedPhrase);

  const myAddress = Env[`signatory${signatoryId}`];
  const otherSignatories = sortAddresses(signatories.filter((addr) => addr !== myAddress));

  console.log(`👤 Voting as: ${myAddress} (Signatory ${signatoryId})`);
  console.log(`🏘️ Multisig Address: ${multisigAddress}`);
  console.log(`🗑️ Removing proxy: ${stakingProxyAddress} (type: Staking)`);

  const removeProxyCall = api.tx.proxy.removeProxy(stakingProxyAddress, 'Staking', 0);
  const callHash = removeProxyCall.method.hash.toHex();
  console.log(`📋 Call hash: ${callHash}`);

  const multisigEntries = await api.query.multisig.multisigs(multisigAddress, callHash);

  let tx;

  if (multisigEntries.isEmpty) {
    console.log(`📝 No active proposal found. INITIATING new remove-proxy proposal...`);
    tx = api.tx.multisig.asMulti(
      threshold,
      otherSignatories,
      null,
      removeProxyCall.method.toHex(),
      { refTime: 0, proofSize: 0 },
    );
  } else {
    const info = multisigEntries.unwrap();

    const hasVoted = info.approvals.some((a) => a.toString() === myAddress);
    if (hasVoted) {
      console.log(`❌ You have already voted for this proposal!`);
      process.exit(0);
    }

    const approvalsCount = info.approvals.length;
    console.log(`✅ Found active proposal! Current approvals: ${approvalsCount}/${threshold}`);

    const willExecute = approvalsCount + 1 >= threshold;
    let maxWeight;

    if (willExecute) {
      console.log(`💥 This vote will EXECUTE the proposal. Calculating actual weight...`);
      const callInfo = await removeProxyCall.paymentInfo(myAddress);
      maxWeight = callInfo.weight;
    } else {
      console.log(`➕ This vote will APPROVE the proposal (but more votes needed). Set weight to 0.`);
      maxWeight = { refTime: 0, proofSize: 0 };
    }

    tx = api.tx.multisig.asMulti(
      threshold,
      otherSignatories,
      info.when,
      removeProxyCall.method.toHex(),
      maxWeight,
    );
  }

  console.log(`✍️ Signing and sending transaction...`);

  await tx.signAndSend(myKeyring, ({ status, events, dispatchError }) => {
    if (status.isInBlock) {
      console.log(`✔️ Transaction included in block: ${status.asInBlock}`);
    } else if (status.isFinalized) {
      console.log(`✅ Transaction finalized in block: ${status.asFinalized}`);

      if (dispatchError) {
        if (dispatchError.isModule) {
          const decoded = api.registry.findMetaError(dispatchError.asModule);
          console.error(`❌ Transaction failed: ${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`);
        } else {
          console.error(`❌ Transaction failed: ${dispatchError.toString()}`);
        }
        process.exit(1);
      }

      const executedEvent = events.find(({ event }) =>
        api.events.multisig.MultisigExecuted.is(event),
      );

      if (executedEvent) {
        const result = executedEvent.event.data[4];
        if (result.isOk) {
          console.log(`🎉 PROXY ${stakingProxyAddress} HAS BEEN SUCCESSFULLY REMOVED!`);
          console.log(`💰 The proxy deposit (~0.093 TAO) has been returned to the multisig free balance.`);
        } else {
          const err = result.asErr;
          if (err.isModule) {
            const decoded = api.registry.findMetaError(err.asModule);
            console.error(`❌ Inner call failed: ${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`);
          } else {
            console.error(`❌ Inner call failed: ${err.toString()}`);
          }
        }
        process.exit(0);
      }

      console.log('🎉 Vote successfully recorded! Waiting for more signatures.');
      process.exit(0);
    } else {
      console.log(`⏳ Current status: ${status.type}`);
    }
  });
}

voteRemoveProxy().catch(console.error);