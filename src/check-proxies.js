import { ApiPromise, WsProvider } from '@polkadot/api';
import { validateEnv } from './validate-env.js';
import { generateMultisigAddress } from './generate-multisig-address.js';

async function checkProxies() {
  const { rpcUrl, signatories, threshold, stakingProxyAddress } = validateEnv();
  // Using the exact multisig address from your logs
  // const address = '5Hb7JBfsh46utWHxxQWt22GgSVfxeuybHBKm81re9c621TD7'; // signatory A
  // const address = '5DEphwPnXfDFPgppSSB97m8c8hFi32iUSqXiDachAC12QDMp'; // multisig

  const address = generateMultisigAddress(signatories, threshold);
  console.log(`Checking proxies for Multisig Address: ${address}`);
  console.log(`Expected Proxy Address: ${stakingProxyAddress}`);

  const provider = new WsProvider(rpcUrl);
  const api = await ApiPromise.create({ provider });

  try {
    const proxyQueryResult = await api.query.proxy.proxies(address);

    const [proxies, balance] = proxyQueryResult;
    console.log(`Found ${proxies.length} proxies. Reserve balance: ${balance.toHuman()}`);

    if (proxies.length > 0) {
      proxies.forEach((proxy, index) => {
        console.log(`\nProxy #${index + 1}:`);
        console.log(`- Delegate (The Proxy): ${proxy.delegate.toString()}`);
        console.log(`- Type: ${proxy.proxyType.toString()}`);
        console.log(`- Delay: ${proxy.delay.toString()}`);
      });

      const isOurProxyListed = proxies.some((p) => p.delegate.toString() === stakingProxyAddress);

      console.log(`\nIs expected proxy in the list? ${isOurProxyListed ? '✅ YES' : '❌ NO'}`);
    } else {
      console.log('No proxies found for this multisig account.');
    }
  } catch (error) {
    console.error('Error checking proxies:', error);
  } finally {
    process.exit(0);
  }
}

checkProxies();
