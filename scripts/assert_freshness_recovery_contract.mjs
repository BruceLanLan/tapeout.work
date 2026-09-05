const base = String(process.argv[2] || '').replace(/\/$/, '');
if (!base) throw new Error('Usage: node scripts/assert_freshness_recovery_contract.mjs <base-url>');

const fail = message => { throw new Error(`Freshness recovery contract failed: ${message}`); };
async function get(path) {
  const response = await fetch(`${base}${path}`);
  const contentType = response.headers.get('content-type') || '';
  if (!response.ok || !contentType.includes('application/json')) fail(`${path} returned ${response.status} with ${contentType}`);
  return { body: await response.json(), cacheControl: response.headers.get('cache-control') || '' };
}

const [price, health, summary, analytics, daily, airdrop, official] = await Promise.all([
  get('/api/v1/bem/price'),
  get('/api/v1/data-health'),
  get('/api/summary'),
  get('/api/analytics'),
  get('/api/v1/daily-activity?range=1d&granularity=hour&timezone=Asia%2FShanghai'),
  get('/api/v1/airdrop-overview'),
  get('/api/v1/official-assets/health'),
]);

for (const [name, response] of Object.entries({ price, health, summary, analytics, daily, airdrop, official })) {
  if (!response.cacheControl.toLowerCase().includes('no-store')) fail(`${name} must not inherit a five-minute edge cache`);
}
if (!String(price.body.source?.selection || '').startsWith('verified_pair')) fail('price must expose verified-pair selection');
if (!price.body.source?.source_checked_at || !price.body.source?.freshness?.checked_at) fail('price must expose both source check and health check time');
if (!Array.isArray(price.body.source?.cross_sources) || !price.body.source.cross_sources.some(source => source.pair_address === price.body.pair?.address)) fail('price must include the selected verified pair in diagnostics');
if (!['within_expected_range', 'divergent'].includes(price.body.source?.cross_source_status)) fail('price must expose cross-source state');
if (!price.body.source?.freshness?.freshness_policy?.includes('<=2m')) fail('price must expose the two-minute market freshness policy');
if (!health.body.registry?.last_checked_at || !['healthy', 'stale'].includes(health.body.registry?.status)) fail('registry must retain explicit last-success freshness');
for (const [name, domain] of Object.entries({ airdrop: health.body.airdrop, bem_price: health.body.bem?.price, official_three: health.body.official_three_assets, community: health.body.community_processor_board })) {
  if (!domain || !['healthy', 'stale', 'pending', 'error'].includes(domain.status)) fail(`${name} is missing an explicit independent freshness state`);
  // A status alone let two domains ship a lie for a day: with the last attempt failed,
  // one reported no successful check had ever happened and the other stamped the data's
  // last-change time as its check time. Any domain holding a snapshot must be able to
  // say when it was really last checked, whatever the latest attempt did.
  if (domain.status !== 'pending' && !domain.checked_at) fail(`${name} reports status ${domain.status} but no checked_at, so it cannot say when it was last successfully checked`);
}
console.log('PASS: dynamic freshness, verified-pair priority and no-store contract');
