import { ApiPromise, WsProvider } from '@polkadot/api';
import { generateMultisigAddress } from './multisig-generate-address.js';
import { Env } from './validate-env.js';

async function multisigBalance() {
  const { rpcUrl, threshold, signatories, subnetId } = Env;
  const multisigAddress = generateMultisigAddress(signatories, threshold);

  const provider = new WsProvider(rpcUrl);
  const api = await ApiPromise.create({ provider });

  try {
    const { data: balance } = await api.query.system.account(multisigAddress);

    const free = balance.free.toBigInt();
    const reserved = balance.reserved.toBigInt();
    const frozen = (balance.frozen ?? balance.miscFrozen)?.toBigInt() ?? 0n;
    const untouchable = frozen > reserved ? frozen : reserved;
    const liquid = free > untouchable ? free - untouchable : 0n;

    console.log(`\n💰 TAO Balance:`);
    console.log(`- Free (total):          ${Number(free) / 1e9} TAO`);
    console.log(`- Reserved (proxy/etc):  ${Number(reserved) / 1e9} TAO`);
    console.log(`- Frozen:                ${Number(frozen) / 1e9} TAO`);
    console.log(`- Liquid (transferable): ${Number(liquid) / 1e9} TAO  ← use this for transfers`);

    if (free === 0n) {
      console.log(`\n⚠️ WARNING: Multisig has 0 TAO.`);
    }

    // Query all stake positions for this coldkey via Runtime API (same approach as btcli)
    console.log(`\n📊 Alpha Staked (StakeInfoRuntimeApi):`);
    const stakeInfosCodec =
      await api.call.stakeInfoRuntimeApi.getStakeInfoForColdkey(multisigAddress);
    const stakeInfos = stakeInfosCodec.toJSON();

    if (!Array.isArray(stakeInfos) || stakeInfos.length === 0) {
      console.log(`   none`);
    } else {
      // Group by netuid
      const bySubnet = new Map();
      for (const info of stakeInfos) {
        const netuid = info.netuid ?? info[3];
        const stakeRao = BigInt(info.stake ?? info[2] ?? '0');
        const hotkey = info.hotkey ?? info[0];
        if (!bySubnet.has(netuid)) bySubnet.set(netuid, []);
        bySubnet.get(netuid).push({ hotkey, stakeRao });
      }

      for (const [netuid, positions] of [...bySubnet.entries()].sort((a, b) => a[0] - b[0])) {
        const total = positions.reduce((s, p) => s + p.stakeRao, 0n);
        console.log(`  Subnet ${netuid}:  ${Number(total) / 1e9} Alpha total`);
        for (const { hotkey, stakeRao } of positions) {
          const label = hotkey === multisigAddress ? '(self)' : '';
          console.log(`    └─ hotkey ${hotkey} ${label}: ${Number(stakeRao) / 1e9} Alpha`);
        }
      }

      const targetSubnetPositions = stakeInfos.filter(
        (info) => (info.netuid ?? info[3]) === subnetId,
      );
      const totalForSubnet = targetSubnetPositions.reduce(
        (s, info) => s + BigInt(info.stake ?? info[2] ?? '0'),
        0n,
      );
      console.log(`\n  → Subnet ${subnetId} total: ${Number(totalForSubnet) / 1e9} Alpha`);
    }

    // Check subnet registration
    try {
      const isRegistered = await api.query.subtensorModule.isNetworkMember(multisigAddress, subnetId);
      if (isRegistered.isTrue) {
        console.log(`\n⚠️  Registered in subnet ${subnetId}: transfers capped at liquid = ${Number(liquid) / 1e9} TAO`);
      }
    } catch { /* ignore */ }
  } catch (error) {
    console.error('Error checking balance:', error);
  } finally {
    process.exit(0);
  }
}

multisigBalance();
