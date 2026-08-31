import { readFile } from 'node:fs/promises';

const work = process.argv[2];
if (!work) throw new Error('Usage: node assert_airdrop_health_contract.mjs <review-workdir>');
const text = await readFile(`${work}/airdrop.json`, 'utf8');
const airdrop = JSON.parse(text);
for (const field of ['status', 'observed_at', 'checked_at', 'age_minutes', 'data_age_minutes', 'last_run']) {
  if (!(field in airdrop)) throw new Error(`Missing Airdrop health field: ${field}`);
}
if (airdrop.last_run?.status === 'no_change' && airdrop.status !== 'healthy') {
  throw new Error('A successful hash-unchanged Airdrop read must remain healthy');
}
if (airdrop.last_run?.status === 'no_change' && (!airdrop.checked_at || airdrop.age_minutes === null)) {
  throw new Error('A successful hash-unchanged Airdrop read must expose checked_at freshness');
}
console.log('PASS: Airdrop freshness contract assertions completed');
