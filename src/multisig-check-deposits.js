import { ApiPromise, WsProvider } from '@polkadot/api';
import { Env } from './validate-env.js';
import { generateMultisigAddress } from './multisig-generate-address.js';

async function checkDeposits() {
  const { rpcUrl, threshold, signatories, signatoryA, signatoryB, signatoryC } = Env;

  const multisigAddress = generateMultisigAddress(signatories, threshold);

  const provider = new WsProvider(rpcUrl);
  const api = await ApiPromise.create({ provider });

  try {
    // Multisig pallet constants
    const depositBase = api.consts.multisig.depositBase.toBigInt();
    const depositFactor = api.consts.multisig.depositFactor.toBigInt();
    const numOtherSignatories = BigInt(signatories.length - 1);

    // Required deposit = DepositBase + DepositFactor * (numSignatories - 1)
    const requiredDeposit = depositBase + depositFactor * numOtherSignatories;

    console.log(`\n📋 Multisig Pallet Constants:`);
    console.log(`- DepositBase:   ${depositBase} RAO  (${Number(depositBase) / 1e9} TAO)`);
    console.log(`- DepositFactor: ${depositFactor} RAO  (${Number(depositFactor) / 1e9} TAO)`);
    console.log(`- Other signatories: ${numOtherSignatories}`);
    console.log(`\n💰 Required deposit to INITIATE a proposal:`);
    console.log(`  DepositBase + DepositFactor * ${numOtherSignatories} = ${requiredDeposit} RAO  (${Number(requiredDeposit) / 1e9} TAO)`);

    const addresses = { A: signatoryA, B: signatoryB, C: signatoryC };

    console.log(`\n👥 Signatory Balances vs Required Deposit:`);

    for (const [id, address] of Object.entries(addresses)) {
      const { data: balance } = await api.query.system.account(address);
      const free = balance.free.toBigInt();
      const reserved = balance.reserved.toBigInt();
      const canAfford = free >= requiredDeposit;

      console.log(`\n  Signatory ${id}: ${address}`);
      console.log(`    Free:     ${free} RAO  (${Number(free) / 1e9} TAO)`);
      console.log(`    Reserved: ${reserved} RAO  (${Number(reserved) / 1e9} TAO)`);
      console.log(`    Can initiate proposal: ${canAfford ? '✅ YES' : '❌ NO — needs at least ' + Number(requiredDeposit) / 1e9 + ' TAO free'}`);
    }

    // Proxy pallet constants
    const proxyDepositBase = api.consts.proxy.proxyDepositBase.toBigInt();
    const proxyDepositFactor = api.consts.proxy.proxyDepositFactor.toBigInt();
    const requiredProxyDeposit = proxyDepositBase + proxyDepositFactor * 1n;

    console.log(`\n🔑 Proxy Pallet Constants:`);
    console.log(`- ProxyDepositBase:   ${proxyDepositBase} RAO  (${Number(proxyDepositBase) / 1e9} TAO)`);
    console.log(`- ProxyDepositFactor: ${proxyDepositFactor} RAO  (${Number(proxyDepositFactor) / 1e9} TAO)`);
    console.log(`\n💰 Required deposit to ADD 1 proxy:`);
    console.log(`  ProxyDepositBase + ProxyDepositFactor * 1 = ${requiredProxyDeposit} RAO  (${Number(requiredProxyDeposit) / 1e9} TAO)`);

    const { data: msigBalance } = await api.query.system.account(multisigAddress);
    const msigFree = msigBalance.free.toBigInt();
    const msigReserved = msigBalance.reserved.toBigInt();
    const canAddProxy = msigFree >= requiredProxyDeposit;

    console.log(`\n🏘️  Multisig Address: ${multisigAddress}`);
    console.log(`    Free:     ${msigFree} RAO  (${Number(msigFree) / 1e9} TAO)`);
    console.log(`    Reserved: ${msigReserved} RAO  (${Number(msigReserved) / 1e9} TAO)`);
    console.log(`    Can add proxy: ${canAddProxy ? '✅ YES' : '❌ NO — needs at least ' + Number(requiredProxyDeposit) / 1e9 + ' TAO free'}`);
  } finally {
    await provider.disconnect();
    process.exit(0);
  }
}

checkDeposits().catch(console.error);
