import { ApiPromise, WsProvider } from '@polkadot/api';
import { Env } from './validate-env.js';

async function checkBlock() {
  const { rpcUrl } = Env;
  const provider = new WsProvider(rpcUrl);
  const api = await ApiPromise.create({ provider });

  const blockHash = '0xf65064dc3f01c4e68a39f4155067f318643ee98ba58d42333a96ad30f1b3ec89';

  console.log(`Checking block: ${blockHash}`);

  try {
    const signedBlock = await api.rpc.chain.getBlock(blockHash);
    const apiAt = await api.at(signedBlock.block.header.hash);
    const allRecords = await apiAt.query.system.events();

    signedBlock.block.extrinsics.forEach((extrinsic, index) => {
      const events = allRecords
        .filter(({ phase }) =>
          phase.isApplyExtrinsic &&
          phase.asApplyExtrinsic.eq(index)
        );

      events.forEach(({ event }) => {
        if (api.events.multisig.MultisigExecuted.is(event)) {
          console.log(`\nFound MultisigExecuted Event!`);
          const [approving, timepoint, multisig, callHash, result] = event.data;

          if (result.isOk) {
            console.log('✅ Inner call succeeded.');
          } else {
            console.log('❌ Inner call FAILED.');
            const dispatchError = result.asErr;
            if (dispatchError.isModule) {
              const decoded = api.registry.findMetaError(dispatchError.asModule);
              const { docs, name, section } = decoded;
              console.log(`Error details: ${section}.${name} - ${docs.join(' ')}`);
            } else {
              console.log(`Error details: ${dispatchError.toString()}`);
            }
          }
        }
      });
    });

    // Also let's check the required proxy deposit
    const proxyDepositBase = api.consts.proxy.proxyDepositBase;
    const proxyDepositFactor = api.consts.proxy.proxyDepositFactor;

    console.log(`\n--- Proxy Deposit Constants ---`);
    console.log(`ProxyDepositBase: ${proxyDepositBase.toHuman()} (${proxyDepositBase.toString()} RAO)`);
    console.log(`ProxyDepositFactor: ${proxyDepositFactor.toHuman()} (${proxyDepositFactor.toString()} RAO)`);

    const requiredDeposit = proxyDepositBase.add(proxyDepositFactor);
    console.log(`Required Deposit for 1 proxy: ${requiredDeposit.toHuman()} (${requiredDeposit.toString()} RAO = ${requiredDeposit.toNumber() / 1e9} TAO)`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

checkBlock();
