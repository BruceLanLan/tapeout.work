import { readFile } from 'node:fs/promises';

const base = process.argv[2] || 'http://127.0.0.1:8820';
// worker.js was split into domain modules: the transistor-candle sync/schema/health
// functions now live in official_assets.js, the API route lives in router.js, and
// only the runScheduledSync "transistor_candles" job label remains in worker.js.
const [workerPart, officialAssetsPart, routerPart] = await Promise.all([
  readFile(new URL('../src/worker.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/official_assets.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/router.js', import.meta.url), 'utf8'),
]);
const source = `${workerPart}\n${officialAssetsPart}\n${routerPart}`;
const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../public/learning.css', import.meta.url), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(`Transistor candle contract failed: ${message}`); };
for (const token of [
  'TRANSISTOR_CANDLE_PROVIDER', 'TRANSISTOR_CANDLE_REFRESH_MINUTES = 5', 'TRANSISTOR_CANDLE_HEALTH_MINUTES = 15',
  'OFFICIAL_TRANSISTOR_CANDLE_ASSETS', 'ensureTransistorCandleSchema', 'syncTransistorCandles', 'officialTransistorCandles',
  'transistorCandlesHealth', 'empty time buckets are not backfilled', 'third_party', 'await prepare("transistor_candles"',
  '"/api/v1/official-assets/candles"', 'transistor_candles'
]) assert(source.includes(token), `worker missing ${token}`);
for (const token of ['id="transistor-candle-chart"','data-transistor-candle-asset="nand"','data-transistor-candle-asset="latch"','id="transistor-candle-interval"','id="transistor-candle-range"']) assert(html.includes(token), `HTML missing ${token}`);
for (const token of ['loadTransistorCandles','transistorCandleByKey','candleBoundary:','candleNoTrades:']) assert(app.includes(token), `app missing ${token}`);
for (const token of ['.transistor-candle-section','.transistor-candle-chart','.transistor-candle-asset.is-active','html[dir="rtl"] .transistor-candle-boundary']) assert(css.includes(token), `CSS missing ${token}`);

const getJson = async path => {
  const response = await fetch(`${base}${path}`);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
};
const checks = [];
for (const project of ['behemoth','tapeout','genesis']) for (const asset of ['nand','latch']) {
  const payload = await getJson(`/api/v1/official-assets/candles?project=${project}&asset=${asset}&interval=1h&range=24h`);
  assert(payload.source?.tier === 'third_party', `${project}/${asset} must stay third party`);
  assert(payload.filters?.project === project && payload.filters?.asset === asset && payload.filters?.interval === '1h' && payload.filters?.timezone === 'UTC', `${project}/${asset} filters`);
  assert(payload.asset?.token_id === (asset === 'nand' ? 0 : 1), `${project}/${asset} tokenId mapping`);
  assert(typeof payload.boundary === 'string' && /not an official price/i.test(payload.boundary), `${project}/${asset} non-official boundary`);
  for (const candle of payload.candles || []) {
    const open = BigInt(candle.open_wei), high = BigInt(candle.high_wei), low = BigInt(candle.low_wei), close = BigInt(candle.close_wei);
    assert(low <= open && low <= close && high >= open && high >= close, `${project}/${asset} OHLC invariant`);
    assert(candle.trade_count > 0 && candle.has_trades === true, `${project}/${asset} must not invent empty candle`);
  }
  checks.push({ project, asset, status: payload.status, candles: payload.candles?.length || 0, trades: payload.health?.archived_trade_count || 0 });
}
const healthResponse = await fetch(`${base}/api/v1/data-health`);
let healthStatus = 'local-core-health-unavailable';
if (healthResponse.ok) {
  const health = await healthResponse.json();
  assert(health.transistor_candles?.tier === 'third_party' && Array.isArray(health.transistor_candles.assets) && health.transistor_candles.assets.length === 6, 'data-health third-party candle asset coverage');
  healthStatus = health.transistor_candles.status;
} else if (!/127\.0\.0\.1|localhost/.test(base)) {
  throw new Error(`/api/v1/data-health: HTTP ${healthResponse.status}`);
}
console.log(JSON.stringify({ status: 'pass', checks, health: healthStatus }, null, 2));
