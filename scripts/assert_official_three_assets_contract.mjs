const base = (process.argv[2] || 'http://127.0.0.1:8799').replace(/\/$/, '');

async function get(path) {
  const response = await fetch(`${base}${path}`);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return { body: await response.json(), cacheControl: response.headers.get('cache-control') || '' };
}
function assert(condition, message) { if (!condition) throw new Error(message); }
function integerText(value) { return /^\d+$/.test(String(value)); }

const [overviewResponse, mintsResponse, bidsResponse, healthResponse] = await Promise.all([
  get('/api/v1/official-assets/overview'),
  get('/api/v1/official-assets/addresses?view=mints&project=all&page=1&page_size=10'),
  get('/api/v1/official-assets/addresses?view=open_bids&project=all&page=1&page_size=10'),
  get('/api/v1/official-assets/health'),
]);
const overview = overviewResponse.body, mints = mintsResponse.body, bids = bidsResponse.body, health = healthResponse.body;
for (const [name, response] of Object.entries({ overview: overviewResponse, mints: mintsResponse, bids: bidsResponse, health: healthResponse })) {
  assert(/no-store/i.test(response.cacheControl), `${name}: official snapshot response must not cache pending or stale state at the edge`);
}
assert(overview.source?.type === 'official_public_snapshots', 'overview must identify official public snapshot provenance');
assert(overview.source?.cpu_stats === 'https://tapeout.net/cpu-stats.json', 'overview must cite official CPU stats');
assert(overview.source?.market === 'https://tapeout.net/market.json', 'overview must cite official market snapshot');
assert(/complete current address-by-address NAND\/LATCH balance table/i.test(overview.balance_boundary || ''), 'overview must state current-balance limitation');
assert(Array.isArray(overview.projects) && overview.projects.length === 3, 'overview must contain exactly three official projects');
const expected = new Map([['tapeout', 'TapeOut'], ['behemoth', 'Behemoth'], ['genesis', 'Genesis CPU']]);
for (const project of overview.projects) {
  assert(expected.get(project.project_key) === project.project_name, `unexpected official project ${project.project_key}`);
  assert(/^0x[a-f0-9]{40}$/.test(project.processor_address), `${project.project_key}: invalid processor address`);
  assert(/^0x[a-f0-9]{40}$/.test(project.transistor_address), `${project.project_key}: invalid transistor address`);
  assert(Number.isInteger(Number(project.holder_count)) && Number(project.holder_count) >= 0, `${project.project_key}: invalid aggregate holder count`);
  assert(Number.isInteger(Number(project.minter_count)) && Number(project.minter_count) >= 0, `${project.project_key}: invalid aggregate minter count`);
  assert(integerText(project.cumulative_minted), `${project.project_key}: invalid cumulative mint unit`);
  assert(Number.isInteger(Number(project.open_bid_count)) && Number(project.open_bid_count) >= 0, `${project.project_key}: invalid open bid count`);
}
for (const [name, data, view] of [['mints', mints, 'mints'], ['bids', bids, 'open_bids']]) {
  assert(data.current_balance_available === false, `${name}: must not claim address-level current balances`);
  assert(data.filters?.view === view && data.filters?.project === 'all', `${name}: filter echo mismatch`);
  assert(data.source?.type === 'official_public_snapshots', `${name}: provenance mismatch`);
  assert(Array.isArray(data.items), `${name}: missing page items`);
  for (const item of data.items) {
    assert(/^0x[a-f0-9]{40}$/.test(item.address), `${name}: invalid public address`);
    assert(/^https:\/\/bscscan\.com\/address\/0x[a-f0-9]{40}$/.test(item.bscscan_address_url), `${name}: invalid explorer URL`);
    assert(item.project_breakdown && typeof item.project_breakdown === 'object', `${name}: missing project breakdown`);
    assert(Object.keys(item.project_breakdown).every(key => expected.has(key)), `${name}: non-official project leaked into aggregation`);
  }
}
for (const project of expected.keys()) {
  const response=await get(`/api/v1/official-assets/addresses?view=mints&project=${project}&page=1&page_size=10`), data=response.body;
  assert(/no-store/i.test(response.cacheControl), `${project}: filtered official response must bypass stale edge cache`);
  assert(data.current_balance_available === false, `${project}: must not claim address-level current balances`);
  assert(data.filters?.view === 'mints' && data.filters?.project === project, `${project}: filtered view echo mismatch`);
  assert(Array.isArray(data.items), `${project}: missing filtered page items`);
  for (const item of data.items) assert(Object.keys(item.project_breakdown || {}).every(key => key === project), `${project}: another project's address data leaked into its tab`);
}
assert(health.source_type === 'official_public_snapshots', 'health must retain official provenance');
assert(Array.isArray(health.sources) && health.sources.includes('https://tapeout.net/cpu-stats.json') && health.sources.includes('https://tapeout.net/market.json'), 'health must disclose official sources');
assert(/last successful snapshot/i.test(health.freshness_policy || ''), 'health must preserve last-success semantics');
console.log(JSON.stringify({ status: 'pass', source_status: overview.status, projects: overview.projects.map(project => project.project_key), mint_addresses: mints.total, open_bid_addresses: bids.total }, null, 2));
