import { readFile } from 'node:fs/promises';
import path from 'node:path';

const work = process.argv[2];
if (!work) throw new Error('Usage: node scripts/assert_bem_price_degradation.mjs <response-dir>');
const load = async name => JSON.parse(await readFile(path.join(work, name), 'utf8'));
const [before, degraded, health] = await Promise.all([load('price-before.json'), load('price-degraded.json'), load('health-degraded.json')]);
if (!before.price_usd || !degraded.price_usd || before.price_usd !== degraded.price_usd) throw new Error('Expected price last-success snapshot to survive a failed provider run');
if (degraded.status !== 'stale' || health.bem?.price?.status !== 'stale') throw new Error('Expected failed provider state to be explicit stale, not healthy or zero');
if (Number(degraded.liquidity_usd) <= 0 || !degraded.warning?.includes('Third-party')) throw new Error('Expected preserved price provenance and liquidity after provider failure');
console.log('PASS: $BEM price provider failure preserves the last-success snapshot as stale');
