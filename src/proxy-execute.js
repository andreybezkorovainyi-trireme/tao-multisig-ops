import { ApiPromise, Keyring, WsProvider } from '@polkadot/api';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import { generateMultisigAddress } from './multisig-generate-address.js';
import { Env, validateSeedPhrase } from './validate-env.js';

// Get argument from command line
const action = process.argv[2];
const amountStr = process.argv[3];

if (!['stake', 'unstake'].includes(action) || !amountStr || isNaN(parseFloat(amountStr))) {
  console.error('Usage: npm run proxy_execute <stake|unstake> <amount_in_TAO>');
  console.error('Example: npm run proxy_execute stake 0.01');
  process.exit(1);
}

const amountRao = BigInt(Math.floor(parseFloat(amountStr) * 1e9));

async function proxyExecute() {
  await cryptoWaitReady();
  const { rpcUrl, threshold, signatories, subnetId, stakingProxySeedPhrase, validatorHotkeyAddress } = Env;
  validateSeedPhrase(stakingProxySeedPhrase);

  const multisigAddress = generateMultisigAddress(signatories, threshold);

  console.log(`🔗 Connecting to ${rpcUrl}...`);
  const provider = new WsProvider(rpcUrl);
  const api = await ApiPromise.create({ provider });

  const keyring = new Keyring({ type: 'sr25519' });
  const proxyWallet = keyring.addFromMnemonic(stakingProxySeedPhrase);

  let validatorHotkey = validatorHotkeyAddress;
  if (!validatorHotkey) {
    console.warn(
      '===============================================================================================',
    );
    console.warn(
      'VALIDATOR_HOTKEY_ADDRESS is not set. The Multisig address will be used as the validator hotkey.',
    );
    console.warn(
      '===============================================================================================',
    );
    validatorHotkey = multisigAddress;
  }

  console.log('Validator Hotkey:', validatorHotkey);

  console.log(`👤 Proxy Wallet (Delegate): ${proxyWallet.address}`);
  console.log(`📡 Target Subnet: ${subnetId}`);
  console.log(`💸 Amount: ${amountStr} TAO (${amountRao.toString()} RAO)`);
  console.log(`🛠️ Action: ${action.toUpperCase()}`);

  // Base inner call
  let innerTx;
  if (action === 'stake') {
    // arguments: hotkey (multisig itself), netuid, amount
    innerTx = api.tx.subtensorModule.addStake(validatorHotkey, subnetId, amountRao);
  } else {
    // arguments: hotkey (multisig itself), netuid, amount
    innerTx = api.tx.subtensorModule.removeStake(validatorHotkey, subnetId, amountRao);
  }

  // Wrap inner call inside a proxy call
  const proxyTx = api.tx.proxy.proxy(
    multisigAddress, // The account we proxy FOR
    'Staking', // The proxy type
    innerTx, // The extrinsic to dispatch
  );

  console.log('✍️ Signing and sending proxy transaction...');
  console.log(`🔗 Transaction Hash: ${proxyTx.hash.toHex()}`);

  return new Promise((resolve, reject) => {
    proxyTx
      .signAndSend(proxyWallet, ({ status, events, dispatchError }) => {
        if (status.isInBlock) {
          console.log(`✔️ Transaction included in block: ${status.asInBlock}`);
        } else if (status.isFinalized) {
          console.log(`✅ Transaction finalized in block: ${status.asFinalized}`);

          if (dispatchError) {
            if (dispatchError.isModule) {
              const decoded = api.registry.findMetaError(dispatchError.asModule);
              const { docs, name, section } = decoded;
              console.error(`❌ Transaction failed: ${section}.${name} - ${docs.join(' ')}`);
            } else {
              console.error(`❌ Transaction failed: ${dispatchError.toString()}`);
            }
            reject(new Error('Transaction failed'));
          } else {
            // We also check inner proxy.ProxyExecuted event for errors
            const proxyExecutedEvent = events.find(({ event }) =>
              api.events.proxy.ProxyExecuted.is(event),
            );

            if (proxyExecutedEvent) {
              const [result] = proxyExecutedEvent.event.data;
              if (result.isOk) {
                console.log(`🎉 Successfully executed ${action} via Proxy!`);
                resolve();
              } else {
                const proxyError = result.asErr;
                if (proxyError.isModule) {
                  const decoded = api.registry.findMetaError(proxyError.asModule);
                  console.error(
                    `❌ Inner Proxy execution failed: ${decoded.section}.${decoded.name} - ${decoded.docs.join(' ')}`,
                  );
                } else {
                  console.error(`❌ Inner Proxy execution failed: ${proxyError.toString()}`);
                }
                reject(new Error('Inner Proxy call failed'));
              }
            } else {
              console.log(`⚠️ ProxyExecuted event not found, but transaction succeeded.`);
              resolve();
            }
          }
        } else {
          console.log(`⏳ Current status: ${status.type}`);
        }
      })
      .catch(reject);
  });
}

proxyExecute()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('🔥 Error processing the transaction:', err);
    process.exit(1);
  });
