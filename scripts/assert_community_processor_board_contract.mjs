const base = (process.argv[2] || 'http://127.0.0.1:8797').replace(/\/$/, '');
async function responseFor(path) {
  const response = await fetch(`${base}${path}`);
  if (!response.ok) throw new Error(`${path} HTTP ${response.status}`);
  return response;
}
async function get(path) { return (await responseFor(path)).json(); }
function assert(condition, message) { if (!condition) throw new Error(message); }
const [healthResponse, addressesResponse, retired] = await Promise.all([
  responseFor('/api/v1/community/processor-health'),
  responseFor('/api/v1/community/processor-leaderboard?page=1&page_size=5'),
  get('/api/v1/community/processor-leaderboard?view=processors&asset_type=Behemoth&status=verified_pool&page=1&page_size=10'),
]);
const [health, addresses] = await Promise.all([healthResponse.json(), addressesResponse.json()]);
assert(healthResponse.headers.get('cache-control') === 'no-store', 'community health must not edge-cache an initial pending response');
assert(addressesResponse.headers.get('cache-control') === 'no-store', 'community board must not edge-cache an initial pending response');
assert(['healthy', 'stale', 'pending', 'error'].includes(health.status), 'health status must be explicit');
assert(health.source_type === 'community_estimate', 'source must remain community_estimate');
assert(health.source === 'https://tapeout.club/', 'source URL must remain explicit');
assert(addresses.source?.type === 'community_estimate', 'leaderboard must preserve community source type');
assert(/not an official/i.test(addresses.scope || ''), 'leaderboard scope must state non-official boundary');
assert(/not a complete transistor-holder census/i.test(addresses.scope || ''), 'leaderboard scope must state incomplete-holder boundary');
assert(Array.isArray(addresses.items), 'address items must be an array');
if (health.status === 'healthy') {
  assert(addresses.total > 0, 'healthy source must expose rows');
  assert(addresses.coverage?.leaderboard_wallet_rows > 0, 'coverage must expose source leaderboard wallet-row count');
  for (const item of addresses.items) {
    assert(/^0x[a-f0-9]{40}$/.test(item.address), 'address must be public full EVM address');
    assert(Number.isFinite(item.chain_weight), 'chain weight must be numeric');
    assert(!('identity' in item) && !('investor' in item) && !('official' in item), 'API must not infer identity or endorsement');
  }
}
// The old per-circuit view/asset_type/status filters were retired 2026-08-29 when
// TapeOut Club stopped publishing per-circuit rows; requesting them must not error,
// and the response must say plainly that they no longer do anything.
assert(Array.isArray(retired.retired_parameters?.names) && retired.retired_parameters.names.length > 0, 'requesting a retired filter must be acknowledged, not silently ignored');
console.log(JSON.stringify({ ok: true, base, health: health.status, addresses: addresses.total, retired_parameters: retired.retired_parameters?.names }, null, 2));
