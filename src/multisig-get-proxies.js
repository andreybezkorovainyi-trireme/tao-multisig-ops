import { ApiPromise, WsProvider } from '@polkadot/api';
import { generateMultisigAddress } from './multisig-generate-address.js';
import { Env } from './validate-env.js';

async function checkProxies() {
  const { rpcUrl, signatories, threshold, stakingProxyAddress } = Env;

  const address = generateMultisigAddress(signatories, threshold);
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
