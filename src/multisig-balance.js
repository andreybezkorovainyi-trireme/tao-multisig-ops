import { ApiPromise, WsProvider } from '@polkadot/api';
import { validateEnv } from './validate-env.js';
import { generateMultisigAddress } from './generate-multisig-address.js';

async function multisigBalance() {
  const env = validateEnv();
  const { rpcUrl, threshold, signatories, subnetId } = env;
  const multisigAddress = generateMultisigAddress(signatories, threshold);

  console.log(`Checking balance for Multisig Address: ${multisigAddress}`);

  const provider = new WsProvider(rpcUrl);
  const api = await ApiPromise.create({ provider });

  try {
    const { data: balance } = await api.query.system.account(multisigAddress);

    // Fetch Alpha balance for the subnet
    const alphaBalanceRaw = await api.query.subtensorModule.alpha(
      multisigAddress,
      multisigAddress,
      subnetId,
    );
    const fixed128Divisor = BigInt('18446744073709551616'); // 2^64
    const alphaRawBigInt = BigInt(alphaBalanceRaw.bits?.toString() || '0');
    const alphaActual = alphaRawBigInt / fixed128Divisor;
    const alphaBalance = Number(alphaActual) / 1e9;

    console.log(`\n💰 Balance Info:`);
    console.log(`- Free (Available): ${balance.free.toHuman()}`);
    console.log(`- Reserved: ${balance.reserved.toHuman()}`);

    // Convert to readable tao (1 TAO = 10^9 RAO)
    const freeTao = balance.free.toNumber() / 1e9;
    console.log(`\nFree Balance in TAO: ${freeTao} TAO`);
    console.log(`Alpha Balance in Subnet ${subnetId}: ${alphaBalance.toFixed(9)} Alpha`);

    if (freeTao === 0) {
      console.log(
        `\n⚠️ WARNING: Multisig has 0 TAO. Transactions like 'addProxy' require adding a deposit to the reserved balance.`,
      );
      console.log(
        `You need to send TAO to this Multisig Address: ${multisigAddress} before it can act.`,
      );
    }
  } catch (error) {
    console.error('Error checking balance:', error);
  } finally {
    process.exit(0);
  }
}

multisigBalance();
