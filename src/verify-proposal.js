import { ApiPromise, WsProvider } from '@polkadot/api';
import { generateMultisigAddress } from './generate-multisig-address.js';
import { validateEnv } from './validate-env.js';

async function verifyProposal() {
  const { rpcUrl, threshold, signatories, stakingProxyAddress } = validateEnv();
  const multisigAddress = generateMultisigAddress(signatories, threshold);
  
  const provider = new WsProvider(rpcUrl);
  const api = await ApiPromise.create({ provider });
  
  const addProxyCall = api.tx.proxy.addProxy(stakingProxyAddress, 'Staking', 0);
  const callHash = addProxyCall.method.hash.toHex();
  
  console.log(`\nChecking Proposal for Multisig: ${multisigAddress}`);
  console.log(`Call Hash we are looking for: ${callHash}`);
  
  const multisigEntries = await api.query.multisig.multisigs(multisigAddress, callHash);
  
  if (multisigEntries.isEmpty) {
    console.log('❌ No proposal active for this hash.');
    
    // Let's check ALL active proposals for this multisig
    const allEntries = await api.query.multisig.multisigs.entries(multisigAddress);
    console.log(`\nFound ${allEntries.length} total active proposals for this multisig:`);
    allEntries.forEach(([key, value]) => {
      const activeCallHash = key.args[1].toHex();
      const info = value.unwrap();
      console.log(`- Hash: ${activeCallHash}`);
      console.log(`  Approvals: ${info.approvals.map(a => a.toString()).join(', ')}`);
    });
  } else {
    console.log('✅ Proposal IS active!');
    console.log(multisigEntries.unwrap().toHuman());
  }
  
  process.exit(0);
}

verifyProposal();
