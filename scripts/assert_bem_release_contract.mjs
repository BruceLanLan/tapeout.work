import { readFile } from 'node:fs/promises';
import path from 'node:path';

const work = process.argv[2];
if (!work) throw new Error('Usage: node scripts/assert_bem_release_contract.mjs <response-dir>');
const load = async name => JSON.parse(await readFile(path.join(work, name), 'utf8'));
const fail = message => { throw new Error(`BEM contract failed: ${message}`); };
const acceptableSnapshotState = value => ['healthy', 'stale'].includes(value);

const [overview, price, tasks, tasksPage2, algorithm, health] = await Promise.all([
  load('bem-overview.json'), load('bem-price.json'), load('bem-tasks.json'), load('bem-tasks-page2.json'), load('bem-algorithm.json'), load('health.json'),
]);

if (!overview.metrics || !acceptableSnapshotState(overview.status)) fail('mining overview must expose a verified or stale last-success snapshot');
for (const key of ['current_rate_raw', 'daily_emission_bem', 'miner_count', 'total_verif_weight', 'total_unver_weight', 'total_mined_bem', 'total_forgone_bem']) {
  if (overview.metrics[key] === undefined || overview.metrics[key] === null || overview.metrics[key] === '0') fail(`mining metric ${key} is absent or false-zero`);
}
if (overview.contracts?.chain_id !== 56 || !String(overview.contracts?.mining || '').startsWith('0x')) fail('mining contract provenance is incomplete');
if (!Array.isArray(overview.recent_events)) fail('mining overview must expose a bounded recent-event array, including an empty array for scoped RPC fallback');
if (overview.provider === 'official_public_snapshot' && overview.recent_events.length < 1) fail('official mining snapshot must expose a bounded recent public fabrication flow');
if (overview.recent_events.some(event => event.author || event.owner || event.wallet)) fail('recent public fabrication flow may not expose or infer owner identity');
for (let index = 1; index < overview.recent_events.length; index += 1) if (Number(overview.recent_events[index - 1].block || 0) < Number(overview.recent_events[index].block || 0)) fail('recent public fabrication flow must be newest-first');
if (!price.pair || price.pair.base_symbol !== 'BEM' || price.source?.aggregation !== 'third_party') fail('price must disclose a third-party BEM-base pair');
if (!price.warning?.toLowerCase().includes('not investment advice')) fail('price risk boundary is missing');
if (!price.source?.endpoint || typeof price.source?.fallback_used !== 'boolean') fail('price source must disclose endpoint and fallback use');
if (!String(price.source?.selection || '').startsWith('verified_pair')) fail('price must select the verified BEM/USDT pair before any broad aggregation fallback');
if (!price.source?.source_checked_at || !Array.isArray(price.source?.cross_sources) || !price.source.cross_sources.some(source => source.pair_address === price.pair.address)) fail('price must disclose the verified-pair check time and cross-source diagnostics');
if (!['within_expected_range', 'divergent'].includes(price.source?.cross_source_status)) fail('price must disclose cross-source status rather than silently accepting a discrepancy');
if (!acceptableSnapshotState(price.status)) fail('price must expose last-success freshness rather than a zero fallback');
for (const page of [tasks, tasksPage2]) {
  if (page.page_size !== 10 || page.items?.length !== 10 || page.total < 10) fail('taskbank must return exactly ten rows on populated default pages');
  if (!acceptableSnapshotState(page.status)) fail('taskbank must expose last-success freshness');
  if (JSON.stringify(page).match(/"owners"|"owner_address"|"wallet"/i)) fail('taskbank response may not disclose miner ownership mappings');
}
if (tasks.page !== 1 || tasksPage2.page !== 2 || tasks.items[0]?.id === tasksPage2.items[0]?.id) fail('taskbook pagination does not advance');
if (tasks.meta?.total !== 306 || tasks.meta?.onchain !== 267 || !tasks.items.every(item => Object.prototype.hasOwnProperty.call(item, 'onchain'))) fail('taskbank official metadata or onchain fields are incomplete');
for (const key of ['total_nand', 'total_latch', 'onchain_gates', 'max_run_gas', 'trivial_count', 'offchain_count']) if (tasks.meta?.[key] === undefined || tasks.meta?.[key] === null) fail(`taskbank engineering metadata ${key} is incomplete`);
if (!algorithm.formulae?.some(formula => formula.includes('C = A')) || !algorithm.boundaries?.length) fail('algorithm endpoint lacks public formulae or interpretation boundaries');
if (!health.registry?.last_run || !['healthy', 'stale'].includes(health.registry.status) || typeof health.registry.check_age_minutes !== 'number') fail('Registry health must disclose a successful or stale last snapshot with an explicit check age');
if (!health.airdrop?.observed_at || !['healthy', 'stale'].includes(health.airdrop.status)) fail('Airdrop health must retain a successful snapshot and explicit freshness');
for (const key of ['mining', 'taskbank', 'miner_index', 'price']) {
  if (!health.bem?.[key] || !['healthy', 'stale', 'pending', 'error'].includes(health.bem[key].status)) fail(`data-health missing bem.${key}`);
}
if (health.bem.taskbank?.status === 'healthy' && (!health.bem.taskbank.checked_at || !health.bem.taskbank.snapshot_observed_at)) fail('hash-deduplicated taskbank health must disclose both the recent successful check and last data-change snapshot');
if (!health.bem.taskbank?.freshness_policy?.includes('most recent successful fetch')) fail('taskbank health must explain hash-deduplicated freshness semantics');
if (!health.bem.price?.note?.toLowerCase().includes('not an official price')) fail('health must explicitly state that third-party price is not official');
if (!health.bem.price?.freshness_policy?.includes('verified BEM/USDT pair <=2m')) fail('price health must document verified-pair priority and the short market freshness threshold');
console.log('PASS: $BEM API contract assertions completed');
