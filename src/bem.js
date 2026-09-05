import {
  BEM_STATS_URL, BEM_TASKBANK_URL, BEM_MINERS_URL, BEM_RPC_URL, BEM_MINING_ADDRESS, BEM_LENS_ADDRESS, BEM_TOKEN_ADDRESS,
  BEM_PRICE_URL, BEM_PRICE_PAIR_ADDRESS, BEM_PRICE_PAIR_URL, BEM_GECKO_POOL_URL, BEM_PRICE_PROVIDER, BEM_CHAIN_ID, BEM_DECIMALS,
  BEM_POD_URL,
} from "./constants.js";
import { sha256, toBigInt, fetchJsonWithTimeout } from "./util.js";
import { ensureScheduledDomainFresh } from "./freshness.js";

let bemSchemaReady;

const BEM_HEALTH_MINUTES = 12;
export const BEM_PRICE_HEALTH_MINUTES = 2;
export const BEM_PRICE_REFRESH_MINUTES = 1;
const BEM_CATALOG_HEALTH_MINUTES = 24 * 60;
const BEM_RPC_METRICS = [
  ["totalVerifWeight", "0xef6aff46"], ["totalUnverWeight", "0x63967742"], ["currentRate", "0xf9f8bdb7"],
  ["minerCount", "0x6d1da431"], ["verifMinerCount", "0xcb29bf7d"], ["unverifiedBps", "0xd8d56ffb"],
  ["totalForgone", "0xcf6f282c"], ["totalMined", "0x5556db65"], ["taskCount", "0xb6cb58a5"],
];
export { BEM_RPC_METRICS };

export async function ensureBemSchema(env) {
  if (!bemSchemaReady) bemSchemaReady = env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS bem_mining_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT, observed_at TEXT NOT NULL, source_generated_at TEXT,
      source_hash TEXT NOT NULL, provider TEXT NOT NULL, block_number INTEGER, raw_json TEXT NOT NULL,
      total_verif_weight TEXT, total_unver_weight TEXT, current_rate TEXT, miner_count INTEGER,
      verif_miner_count INTEGER, unverified_bps INTEGER, total_forgone TEXT, total_mined TEXT,
      task_count INTEGER, tasks_frozen INTEGER
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS bem_mining_snapshots_observed_idx ON bem_mining_snapshots(observed_at DESC)"),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS bem_mining_sync_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, attempted_at TEXT NOT NULL, status TEXT NOT NULL, provider TEXT,
      source_generated_at TEXT, source_hash TEXT, error TEXT
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS bem_mining_sync_runs_attempted_idx ON bem_mining_sync_runs(attempted_at DESC)"),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS bem_catalog_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT, observed_at TEXT NOT NULL, source_hash TEXT NOT NULL,
      task_count INTEGER NOT NULL, raw_taskbank_json TEXT NOT NULL
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS bem_catalog_snapshots_observed_idx ON bem_catalog_snapshots(observed_at DESC)"),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS bem_miner_index_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT, observed_at TEXT NOT NULL, source_hash TEXT NOT NULL,
      source_generated_at TEXT, block_number INTEGER, miner_index_count INTEGER NOT NULL,
      owner_count INTEGER NOT NULL, cpu_counts_json TEXT NOT NULL
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS bem_miner_index_snapshots_observed_idx ON bem_miner_index_snapshots(observed_at DESC)"),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS bem_leaderboard_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT, observed_at TEXT NOT NULL, source_hash TEXT NOT NULL,
      source_generated_at TEXT, block_number INTEGER, total_circuit_count INTEGER NOT NULL,
      top10_wallet_share_pct REAL, top_wallets_json TEXT NOT NULL, top_tasks_json TEXT NOT NULL
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS bem_leaderboard_snapshots_observed_idx ON bem_leaderboard_snapshots(observed_at DESC)"),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS bem_catalog_sync_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, attempted_at TEXT NOT NULL, status TEXT NOT NULL,
      taskbank_hash TEXT, miners_hash TEXT, error TEXT
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS bem_catalog_sync_runs_attempted_idx ON bem_catalog_sync_runs(attempted_at DESC)"),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS bem_price_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT, observed_at TEXT NOT NULL, source_hash TEXT NOT NULL,
      provider TEXT NOT NULL, pair_address TEXT NOT NULL, raw_json TEXT NOT NULL, price_usd TEXT,
      quote_symbol TEXT, liquidity_usd REAL, volume_h24 REAL, price_change_h24 REAL, buys_h24 INTEGER, sells_h24 INTEGER
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS bem_price_snapshots_observed_idx ON bem_price_snapshots(observed_at DESC)"),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS bem_price_sync_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, attempted_at TEXT NOT NULL, status TEXT NOT NULL,
      provider TEXT, pair_address TEXT, error TEXT
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS bem_price_sync_runs_attempted_idx ON bem_price_sync_runs(attempted_at DESC)"),
  ]);
  return bemSchemaReady;
}

export async function ensureBemMiningFresh(env) {
  return ensureScheduledDomainFresh({ key: "bem_mining", env, prepare: () => ensureBemSchema(env), latestRun: () => env.DB.prepare("SELECT attempted_at, status FROM bem_mining_sync_runs ORDER BY id DESC LIMIT 1").first(), sync: syncBemMining, maxAgeMinutes: 6 });
}
export async function ensureBemPriceFresh(env) {
  return ensureScheduledDomainFresh({ key: "bem_price", env, prepare: () => ensureBemSchema(env), latestRun: () => env.DB.prepare("SELECT attempted_at, status FROM bem_price_sync_runs ORDER BY id DESC LIMIT 1").first(), sync: syncBemPrice, maxAgeMinutes: BEM_PRICE_REFRESH_MINUTES, });
}

function bemDecimal(value, decimals = BEM_DECIMALS) {
  const raw = toBigInt(value), base = 10n ** decimals, whole = raw / base, fraction = String(raw % base).padStart(Number(decimals), "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : String(whole);
}

function bemRequired(payload, key) {
  if (payload?.[key] === undefined || payload?.[key] === null || payload?.[key] === "") throw new Error(`BEM source missing ${key}`);
  return String(payload[key]);
}

function normalizeBemStats(payload, provider) {
  if (Number(payload?.chainId) !== BEM_CHAIN_ID) throw new Error("BEM stats chainId is not BNB Chain 56");
  if (String(payload?.mining || "").toLowerCase() !== BEM_MINING_ADDRESS) throw new Error("BEM stats mining contract does not match official config");
  const metrics = {
    total_verif_weight: bemRequired(payload, "totalVerifWeight"), total_unver_weight: bemRequired(payload, "totalUnverWeight"),
    current_rate: bemRequired(payload, "currentRate"), miner_count: Number(bemRequired(payload, "minerCount")),
    verif_miner_count: Number(bemRequired(payload, "verifMinerCount")), unverified_bps: Number(bemRequired(payload, "unverifiedBps")),
    total_forgone: bemRequired(payload, "totalForgone"), total_mined: bemRequired(payload, "totalMined"),
    task_count: Number(bemRequired(payload, "taskCount")), tasks_frozen: payload?.tasksFrozen ? 1 : 0,
  };
  if (![metrics.miner_count, metrics.verif_miner_count, metrics.unverified_bps, metrics.task_count].every(Number.isFinite)) throw new Error("BEM stats has invalid numeric count");
  return { provider, source_generated_at: payload?.generatedAt || null, block_number: Number.isFinite(Number(payload?.block)) ? Number(payload.block) : null, metrics, raw: payload };
}

async function bemRpcFallback() {
  const body = BEM_RPC_METRICS.map(([name, data]) => ({ jsonrpc: "2.0", id: name, method: "eth_call", params: [{ to: BEM_MINING_ADDRESS, data }, "latest"] }));
  const payload = await fetchJsonWithTimeout(BEM_RPC_URL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }, 8000);
  if (!Array.isArray(payload)) throw new Error("BEM root RPC batch response is invalid");
  const results = new Map(payload.map(item => [item.id, item]));
  const decoded = {};
  for (const [name] of BEM_RPC_METRICS) {
    const item = results.get(name);
    if (!item?.result || item.error) throw new Error(`BEM root RPC ${name} failed: ${item?.error?.message || "missing result"}`);
    decoded[name] = BigInt(item.result).toString();
  }
  return normalizeBemStats({ chainId: BEM_CHAIN_ID, mining: BEM_MINING_ADDRESS, ...decoded, unverifiedBps: decoded.unverifiedBps }, "official_public_rpc");
}

export async function syncBemMining(env) {
  await ensureBemSchema(env);
  const attemptedAt = new Date().toISOString();
  try {
    let normalized;
    try {
      const payload = await fetchJsonWithTimeout(BEM_STATS_URL);
      normalized = normalizeBemStats(payload, "official_public_snapshot");
      const generatedAt = Date.parse(normalized.source_generated_at || "");
      if (!Number.isFinite(generatedAt) || Date.now() - generatedAt > 3 * 60 * 1000) throw new Error("BEM official stats snapshot is older than 180 seconds");
    } catch (primaryError) {
      normalized = await bemRpcFallback();
      normalized.raw = { ...normalized.raw, fallback_reason: String(primaryError?.message || primaryError).slice(0, 300) };
    }
    const sourceHash = await sha256(JSON.stringify(normalized.raw));
    const latest = await env.DB.prepare("SELECT source_hash, observed_at FROM bem_mining_snapshots ORDER BY id DESC LIMIT 1").first();
    const status = latest?.source_hash === sourceHash ? "no_change" : "updated";
    if (status === "updated") await env.DB.prepare(`INSERT INTO bem_mining_snapshots
      (observed_at, source_generated_at, source_hash, provider, block_number, raw_json, total_verif_weight, total_unver_weight, current_rate, miner_count, verif_miner_count, unverified_bps, total_forgone, total_mined, task_count, tasks_frozen)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(attemptedAt, normalized.source_generated_at, sourceHash, normalized.provider, normalized.block_number, JSON.stringify(normalized.raw), normalized.metrics.total_verif_weight, normalized.metrics.total_unver_weight, normalized.metrics.current_rate, normalized.metrics.miner_count, normalized.metrics.verif_miner_count, normalized.metrics.unverified_bps, normalized.metrics.total_forgone, normalized.metrics.total_mined, normalized.metrics.task_count, normalized.metrics.tasks_frozen).run();
    await env.DB.prepare("INSERT INTO bem_mining_sync_runs (attempted_at, status, provider, source_generated_at, source_hash, error) VALUES (?, ?, ?, ?, ?, NULL)").bind(attemptedAt, status, normalized.provider, normalized.source_generated_at, sourceHash).run();
    return { status, provider: normalized.provider, observed_at: status === "updated" ? attemptedAt : latest?.observed_at || attemptedAt };
  } catch (error) {
    await env.DB.prepare("INSERT INTO bem_mining_sync_runs (attempted_at, status, provider, source_generated_at, source_hash, error) VALUES (?, 'error', NULL, NULL, NULL, ?)").bind(attemptedAt, String(error?.message || error).slice(0, 500)).run();
    return { status: "error", error: error?.message || String(error) };
  }
}

function validBemTaskbank(payload) {
  if (!payload?.meta || !Array.isArray(payload?.tasks) || !Number.isFinite(Number(payload.meta.total)) || payload.tasks.length !== Number(payload.meta.total)) throw new Error("BEM taskbank is invalid");
  return payload;
}

function validBemMiners(payload) {
  if (!Number.isFinite(Number(payload?.count)) || !payload?.owners || typeof payload.owners !== "object") throw new Error("BEM miners index is invalid");
  return payload;
}

function bemMinerIndexSummary(miners) {
  const cpuCounts = {}, owners = Object.values(miners.owners || {});
  for (const list of owners) for (const miner of Array.isArray(list) ? list : []) {
    const key = String(miner?.cpu || "unknown"); cpuCounts[key] = (cpuCounts[key] || 0) + 1;
  }
  return { generated_at: miners.generatedAt || null, block_number: Number.isFinite(Number(miners.block)) ? Number(miners.block) : null, miner_index_count: Number(miners.count), owner_count: Object.keys(miners.owners || {}).length, cpu_counts: cpuCounts };
}

// Circuit-count-based leaderboard, computed directly from the official public
// miner index (owner -> circuit list). This is NOT the same as the protocol's
// H-weight formula (that needs per-circuit gates/depth/state data this index
// doesn't carry) — every field here is labeled "circuit count", never "weight"
// or "BEM/day", so it can never be mistaken for an official yield figure.
const LEADERBOARD_TOP_N = 30;
function computeMinerLeaderboard(miners) {
  const entries = Object.entries(miners.owners || {});
  let totalCircuitCount = 0;
  const walletRows = [], taskAgg = new Map();
  for (const [address, list] of entries) {
    const circuits = Array.isArray(list) ? list : [];
    if (!circuits.length) continue;
    totalCircuitCount += circuits.length;
    const processors = new Set(), tasks = new Set();
    for (const circuit of circuits) {
      processors.add(String(circuit?.cpu || "unknown"));
      tasks.add(circuit?.taskId ?? null);
      const taskKey = circuit?.taskId ?? "unknown";
      const bucket = taskAgg.get(taskKey) || { task_id: circuit?.taskId ?? null, circuit_count: 0, wallets: new Set() };
      bucket.circuit_count += 1; bucket.wallets.add(address);
      taskAgg.set(taskKey, bucket);
    }
    walletRows.push({ address, circuit_count: circuits.length, distinct_task_count: tasks.size, processors: [...processors].sort() });
  }
  walletRows.sort((left, right) => right.circuit_count - left.circuit_count);
  const top10Count = walletRows.slice(0, 10).reduce((sum, row) => sum + row.circuit_count, 0);
  const topWallets = walletRows.slice(0, LEADERBOARD_TOP_N);
  const topTasks = [...taskAgg.values()]
    .map(bucket => ({ task_id: bucket.task_id, circuit_count: bucket.circuit_count, distinct_wallet_count: bucket.wallets.size }))
    .sort((left, right) => right.circuit_count - left.circuit_count)
    .slice(0, LEADERBOARD_TOP_N);
  return {
    total_circuit_count: totalCircuitCount,
    top10_wallet_share_pct: totalCircuitCount > 0 ? Math.round((top10Count / totalCircuitCount) * 10000) / 100 : null,
    top_wallets: topWallets,
    top_tasks: topTasks,
  };
}

async function syncBemCatalog(env) {
  await ensureBemSchema(env);
  const attemptedAt = new Date().toISOString();
  try {
    // The official miners index is roughly 0.5 MB and can legitimately take longer than
    // the ordinary 8s API budget. Its isolated 15s cap never blocks Registry/Airdrop work.
    const [taskbank, miners] = await Promise.all([fetchJsonWithTimeout(BEM_TASKBANK_URL, {}, 10000), fetchJsonWithTimeout(BEM_MINERS_URL, {}, 15000)]);
    validBemTaskbank(taskbank); validBemMiners(miners);
    const taskbankHash = await sha256(JSON.stringify(taskbank)), minersHash = await sha256(JSON.stringify(miners));
    const [latestTaskbank, latestMiners] = await Promise.all([
      env.DB.prepare("SELECT source_hash, observed_at FROM bem_catalog_snapshots ORDER BY id DESC LIMIT 1").first(),
      env.DB.prepare("SELECT source_hash, observed_at FROM bem_miner_index_snapshots ORDER BY id DESC LIMIT 1").first(),
    ]);
    const taskbankChanged = latestTaskbank?.source_hash !== taskbankHash, minersChanged = latestMiners?.source_hash !== minersHash;
    if (taskbankChanged) await env.DB.prepare("INSERT INTO bem_catalog_snapshots (observed_at, source_hash, task_count, raw_taskbank_json) VALUES (?, ?, ?, ?)").bind(attemptedAt, taskbankHash, Number(taskbank.meta.total), JSON.stringify(taskbank)).run();
    if (minersChanged) {
      const summary = bemMinerIndexSummary(miners);
      await env.DB.prepare("INSERT INTO bem_miner_index_snapshots (observed_at, source_hash, source_generated_at, block_number, miner_index_count, owner_count, cpu_counts_json) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(attemptedAt, minersHash, summary.generated_at, summary.block_number, summary.miner_index_count, summary.owner_count, JSON.stringify(summary.cpu_counts)).run();
      const leaderboard = computeMinerLeaderboard(miners);
      await env.DB.prepare("INSERT INTO bem_leaderboard_snapshots (observed_at, source_hash, source_generated_at, block_number, total_circuit_count, top10_wallet_share_pct, top_wallets_json, top_tasks_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(attemptedAt, minersHash, summary.generated_at, summary.block_number, leaderboard.total_circuit_count, leaderboard.top10_wallet_share_pct, JSON.stringify(leaderboard.top_wallets), JSON.stringify(leaderboard.top_tasks)).run();
    }
    const status = taskbankChanged || minersChanged ? "updated" : "no_change";
    await env.DB.prepare("INSERT INTO bem_catalog_sync_runs (attempted_at, status, taskbank_hash, miners_hash, error) VALUES (?, ?, ?, ?, NULL)").bind(attemptedAt, status, taskbankHash, minersHash).run();
    return { status, observed_at: taskbankChanged ? attemptedAt : latestTaskbank?.observed_at || attemptedAt, miner_index_observed_at: minersChanged ? attemptedAt : latestMiners?.observed_at || attemptedAt };
  } catch (error) {
    await env.DB.prepare("INSERT INTO bem_catalog_sync_runs (attempted_at, status, taskbank_hash, miners_hash, error) VALUES (?, 'error', NULL, NULL, ?)").bind(attemptedAt, String(error?.message || error).slice(0, 500)).run();
    return { status: "error", error: error?.message || String(error) };
  }
}

function bemNumber(value) { const number = Number(value); return Number.isFinite(number) ? number : null; }

function selectBemPricePair(payload, { verifiedOnly = true } = {}) {
  const pairs = Array.isArray(payload?.pairs) ? payload.pairs : [];
  const candidates = pairs.filter(pair => pair?.chainId === "bsc" && String(pair?.baseToken?.address || "").toLowerCase() === BEM_TOKEN_ADDRESS && (bemNumber(pair?.liquidity?.usd) || 0) > 0 && pair?.pairAddress && pair?.priceUsd);
  const verified = candidates.find(pair => String(pair.pairAddress).toLowerCase() === BEM_PRICE_PAIR_ADDRESS.toLowerCase());
  if (verified) return verified;
  if (verifiedOnly) throw new Error("Verified BEM/USDT pair is missing from the market response");
  candidates.sort((left, right) => (bemNumber(right?.liquidity?.usd) || 0) - (bemNumber(left?.liquidity?.usd) || 0));
  if (!candidates.length) throw new Error("No eligible BEM base-token pair with positive liquidity");
  return candidates[0];
}

function crossSourcePrice(source, pair) {
  const price = bemNumber(pair?.priceUsd);
  return { source, price_usd: price, pair_address: String(pair?.pairAddress || "").toLowerCase() || null, liquidity_usd: bemNumber(pair?.liquidity?.usd) };
}

function crossSourceSpread(primary, secondary) {
  const left = bemNumber(primary?.price_usd), right = bemNumber(secondary?.price_usd);
  if (!(left > 0) || !(right > 0)) return null;
  return Math.abs(left - right) / left * 100;
}

function normalizeGeckoBemPair(payload) {
  const attributes = payload?.data?.attributes, baseId = String(payload?.data?.relationships?.base_token?.data?.id || "").toLowerCase();
  if (!attributes?.address || baseId !== `bsc_${BEM_TOKEN_ADDRESS}` || !attributes.base_token_price_usd || !attributes.reserve_in_usd) throw new Error("GeckoTerminal pool is not the verified BEM base-token pair");
  const trades = attributes.transactions?.h24 || {};
  return { pairAddress: String(attributes.address).toLowerCase(), dexId: "pancakeswap-v3", baseToken: { address: BEM_TOKEN_ADDRESS, symbol: "BEM" }, quoteToken: { symbol: "USDT" }, priceUsd: String(attributes.base_token_price_usd), liquidity: { usd: attributes.reserve_in_usd }, volume: { h24: attributes.volume_usd?.h24 }, priceChange: { h24: attributes.price_change_percentage?.h24 }, txns: { h24: { buys: trades.buys || 0, sells: trades.sells || 0 } }, url: `https://www.geckoterminal.com/bsc/pools/${BEM_PRICE_PAIR_ADDRESS}`, labels: ["third_party_fallback", "verified_pair"] };
}

async function fetchBemPricePayload() {
  // The exact BEM/USDT pool is the display source. Broad token aggregation may lag
  // or surface a different pool, so it is now only an independently visible check.
  const [directResult, geckoResult, tokenResult] = await Promise.allSettled([
    fetchJsonWithTimeout(BEM_PRICE_PAIR_URL),
    fetchJsonWithTimeout(BEM_GECKO_POOL_URL),
    fetchJsonWithTimeout(BEM_PRICE_URL),
  ]);
  const diagnostics = [];
  if (directResult.status === "fulfilled") {
    const pair = selectBemPricePair(directResult.value);
    diagnostics.push(crossSourcePrice("DexScreener verified pair", pair));
    if (geckoResult.status === "fulfilled") diagnostics.push(crossSourcePrice("GeckoTerminal verified pool", normalizeGeckoBemPair(geckoResult.value)));
    if (tokenResult.status === "fulfilled") {
      try { diagnostics.push(crossSourcePrice("DexScreener token aggregation", selectBemPricePair(tokenResult.value))); }
      catch (error) { diagnostics.push({ source: "DexScreener token aggregation", error: String(error?.message || error).slice(0, 220) }); }
    }
    const gecko = diagnostics.find(item => item.source === "GeckoTerminal verified pool");
    return { pair, endpoint: BEM_PRICE_PAIR_URL, fallback_reason: null, provider: "DexScreener (verified BEM/USDT pair)", selection: "verified_pair_primary", cross_sources: diagnostics, cross_source_spread_pct: crossSourceSpread(diagnostics[0], gecko) };
  }
  const directError = String(directResult.reason?.message || directResult.reason || "direct pair unavailable").slice(0, 220);
  if (geckoResult.status === "fulfilled") {
    const pair = normalizeGeckoBemPair(geckoResult.value);
    diagnostics.push(crossSourcePrice("GeckoTerminal verified pool", pair));
    if (tokenResult.status === "fulfilled") {
      try { diagnostics.push(crossSourcePrice("DexScreener token aggregation", selectBemPricePair(tokenResult.value))); }
      catch (error) { diagnostics.push({ source: "DexScreener token aggregation", error: String(error?.message || error).slice(0, 220) }); }
    }
    return { pair, endpoint: BEM_GECKO_POOL_URL, fallback_reason: directError, provider: "GeckoTerminal (verified BEM/USDT pool)", selection: "verified_pair_fallback", cross_sources: diagnostics, cross_source_spread_pct: crossSourceSpread(diagnostics[0], diagnostics[1]) };
  }
  if (tokenResult.status === "fulfilled") {
    const pair = selectBemPricePair(tokenResult.value);
    diagnostics.push(crossSourcePrice("DexScreener token aggregation", pair));
    return { pair, endpoint: BEM_PRICE_URL, fallback_reason: `${directError}; GeckoTerminal: ${String(geckoResult.reason?.message || geckoResult.reason || "unavailable").slice(0, 180)}`, provider: "DexScreener (verified pair from token aggregation)", selection: "verified_pair_last_fallback", cross_sources: diagnostics, cross_source_spread_pct: null };
  }
  throw new Error(`${directError}; GeckoTerminal: ${String(geckoResult.reason?.message || geckoResult.reason || "unavailable").slice(0, 180)}; token aggregation: ${String(tokenResult.reason?.message || tokenResult.reason || "unavailable").slice(0, 180)}`);
}

export async function syncBemPrice(env) {
  await ensureBemSchema(env);
  const attemptedAt = new Date().toISOString();
  try {
    const source = await fetchBemPricePayload(), pair = source.pair, raw = { pair, endpoint: source.endpoint, fallback_reason: source.fallback_reason, provider: source.provider, selection: source.selection, source_checked_at: attemptedAt, cross_sources: source.cross_sources, cross_source_spread_pct: source.cross_source_spread_pct }, sourceHash = await sha256(JSON.stringify({ ...raw, source_checked_at: null }));
    const latest = await env.DB.prepare("SELECT source_hash, observed_at FROM bem_price_snapshots ORDER BY id DESC LIMIT 1").first();
    const status = latest?.source_hash === sourceHash ? "no_change" : "updated";
    if (status === "updated") await env.DB.prepare(`INSERT INTO bem_price_snapshots
      (observed_at, source_hash, provider, pair_address, raw_json, price_usd, quote_symbol, liquidity_usd, volume_h24, price_change_h24, buys_h24, sells_h24)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(attemptedAt, sourceHash, source.provider || BEM_PRICE_PROVIDER, String(pair.pairAddress).toLowerCase(), JSON.stringify(raw), String(pair.priceUsd), pair?.quoteToken?.symbol || null, bemNumber(pair?.liquidity?.usd), bemNumber(pair?.volume?.h24), bemNumber(pair?.priceChange?.h24), Number(pair?.txns?.h24?.buys || 0), Number(pair?.txns?.h24?.sells || 0)).run();
    await env.DB.prepare("INSERT INTO bem_price_sync_runs (attempted_at, status, provider, pair_address, error) VALUES (?, ?, ?, ?, NULL)").bind(attemptedAt, status, source.provider || BEM_PRICE_PROVIDER, String(pair.pairAddress).toLowerCase()).run();
    return { status, provider: source.provider || BEM_PRICE_PROVIDER, pair_address: pair.pairAddress, endpoint: source.endpoint, observed_at: status === "updated" ? attemptedAt : latest?.observed_at || attemptedAt };
  } catch (error) {
    await env.DB.prepare("INSERT INTO bem_price_sync_runs (attempted_at, status, provider, pair_address, error) VALUES (?, 'error', ?, NULL, ?)").bind(attemptedAt, BEM_PRICE_PROVIDER, String(error?.message || error).slice(0, 500)).run();
    return { status: "error", error: error?.message || String(error) };
  }
}

function bemFreshness(snapshot, run, thresholdMinutes, lastSuccessRun = null) {
  // Snapshots are intentionally hash-deduplicated. When an official static source or
  // an unchanged market payload is fetched successfully, `observed_at` remains the
  // last data-change time; freshness must use the latest successful check instead.
  // The latest run is only the freshness anchor when it succeeded. When it failed, the
  // last success is an earlier row, and reading it off the latest run reported "we have
  // never successfully checked" for a source that had just been checked minutes ago —
  // constantly, since price fetches fail most of the time. Hence an explicit anchor.
  const lastSuccessAt = (run && ["updated", "no_change"].includes(run.status) ? run.attempted_at : null)
    || lastSuccessRun?.attempted_at || null;
  const freshnessAt = lastSuccessAt || snapshot?.observed_at || null;
  const ageMinutes = freshnessAt ? Math.max(0, Math.round((Date.now() - Date.parse(freshnessAt)) / 60000)) : null;
  // Staleness is a claim about the data, not about the last attempt. A failed fetch
  // over data still inside its window said "stale" about a figure that was fine —
  // and with third-party providers rate-limiting Cloudflare's shared egress (72% of
  // price fetches 429'd on 2026-09-04) that mislabel was the common case, not the
  // rare one. The failed attempt is still reported, next to the age, never merged
  // into it. Same correction bem_trades.js already made for the trade feed.
  const status = !snapshot ? (run?.status === "error" ? "error" : "pending") : (ageMinutes === null || ageMinutes > thresholdMinutes ? "stale" : "healthy");
  return { status, age_minutes: ageMinutes, checked_at: lastSuccessAt, snapshot_observed_at: snapshot?.observed_at || null, last_attempt_failed: run?.status === "error" };
}

export async function bemHealth(env) {
  await ensureBemSchema(env);
  const [miningSnapshot, miningRun, catalogSnapshot, minerIndexSnapshot, catalogRun, priceSnapshot, priceRun, miningSuccess, catalogSuccess, priceSuccess] = await Promise.all([
    env.DB.prepare("SELECT observed_at, provider, source_generated_at, block_number FROM bem_mining_snapshots ORDER BY id DESC LIMIT 1").first(),
    env.DB.prepare("SELECT attempted_at, status, provider, source_generated_at, error FROM bem_mining_sync_runs ORDER BY id DESC LIMIT 1").first(),
    env.DB.prepare("SELECT observed_at, task_count FROM bem_catalog_snapshots ORDER BY id DESC LIMIT 1").first(),
    env.DB.prepare("SELECT observed_at, source_generated_at, block_number, miner_index_count, owner_count, cpu_counts_json FROM bem_miner_index_snapshots ORDER BY id DESC LIMIT 1").first(),
    env.DB.prepare("SELECT attempted_at, status, error FROM bem_catalog_sync_runs ORDER BY id DESC LIMIT 1").first(),
    env.DB.prepare("SELECT observed_at, provider, pair_address, liquidity_usd FROM bem_price_snapshots ORDER BY id DESC LIMIT 1").first(),
    env.DB.prepare("SELECT attempted_at, status, provider, pair_address, error FROM bem_price_sync_runs ORDER BY id DESC LIMIT 1").first(),
    env.DB.prepare("SELECT attempted_at FROM bem_mining_sync_runs WHERE status IN ('updated', 'no_change') ORDER BY id DESC LIMIT 1").first(),
    env.DB.prepare("SELECT attempted_at FROM bem_catalog_sync_runs WHERE status IN ('updated', 'no_change') ORDER BY id DESC LIMIT 1").first(),
    env.DB.prepare("SELECT attempted_at FROM bem_price_sync_runs WHERE status IN ('updated', 'no_change') ORDER BY id DESC LIMIT 1").first(),
  ]);
  const mining = bemFreshness(miningSnapshot, miningRun, BEM_HEALTH_MINUTES, miningSuccess), catalog = bemFreshness(catalogSnapshot, catalogRun, BEM_CATALOG_HEALTH_MINUTES, catalogSuccess), minerIndex = bemFreshness(minerIndexSnapshot, catalogRun, BEM_HEALTH_MINUTES, catalogSuccess), price = bemFreshness(priceSnapshot, priceRun, BEM_PRICE_HEALTH_MINUTES, priceSuccess);
  return {
    mining: { ...mining, source: BEM_STATS_URL, fallback: BEM_RPC_URL, observed_at: miningSnapshot?.observed_at || null, provider: miningSnapshot?.provider || null, source_generated_at: miningSnapshot?.source_generated_at || null, last_run: miningRun || null, freshness_policy: "official snapshot <=180s at collection; public health <=12m; one root-RPC batch fallback" },
    taskbank: { ...catalog, source: BEM_TASKBANK_URL, observed_at: catalogSnapshot?.observed_at || null, task_count: catalogSnapshot?.task_count ?? null, last_run: catalogRun || null, freshness_policy: "official static catalog <=24h; hash-deduplicated snapshot; freshness is the most recent successful fetch" },
    miner_index: { ...minerIndex, source: BEM_MINERS_URL, observed_at: minerIndexSnapshot?.observed_at || null, source_generated_at: minerIndexSnapshot?.source_generated_at || null, block_number: minerIndexSnapshot?.block_number ?? null, miner_index_count: minerIndexSnapshot?.miner_index_count ?? null, owner_count: minerIndexSnapshot?.owner_count ?? null, cpu_counts: minerIndexSnapshot?.cpu_counts_json ? JSON.parse(minerIndexSnapshot.cpu_counts_json) : null, last_run: catalogRun || null, freshness_policy: "official miner index <=12m; hash-deduplicated public aggregate; freshness is the most recent successful fetch" },
    price: { ...price, source: BEM_PRICE_URL, fallback: [BEM_PRICE_PAIR_URL, BEM_GECKO_POOL_URL], observed_at: priceSnapshot?.observed_at || null, provider: priceSnapshot?.provider || BEM_PRICE_PROVIDER, pair_address: priceSnapshot?.pair_address || null, liquidity_usd: priceSnapshot?.liquidity_usd ?? null, last_run: priceRun || null, freshness_policy: "third-party verified BEM/USDT pair <=2m; direct pair first, GeckoTerminal verified-pool fallback, token aggregation as a cross-check only; hash-deduplicated last-success snapshot with freshness from the most recent successful fetch. These providers rate-limit Cloudflare's shared egress addresses, so the 2-minute target is missed often (measured 2026-09-04: 72% of fetches returned HTTP 429, median 7 minutes between successful ones) — the panel reports stale whenever it is, rather than widening the bar to stay green", note: "Third-party aggregated market data, not an official price. Early liquidity may be shallow and price highly volatile." },
  };
}

const LEADERBOARD_GROWTH_POINTS = 120;
export async function bemLeaderboardOverview(env) {
  await ensureBemSchema(env);
  const [snapshot, health, weightSeries, countSeries] = await Promise.all([
    env.DB.prepare("SELECT * FROM bem_leaderboard_snapshots ORDER BY id DESC LIMIT 1").first(),
    bemHealth(env),
    env.DB.prepare(`SELECT observed_at, total_verif_weight, total_unver_weight FROM bem_mining_snapshots ORDER BY id DESC LIMIT ${LEADERBOARD_GROWTH_POINTS}`).all(),
    env.DB.prepare(`SELECT observed_at, miner_index_count, owner_count FROM bem_miner_index_snapshots ORDER BY id DESC LIMIT ${LEADERBOARD_GROWTH_POINTS}`).all(),
  ]);
  if (!snapshot) return { status: health.miner_index.status, observed_at: null, source: health.miner_index, total_circuit_count: null, top10_wallet_share_pct: null, top_wallets: [], top_tasks: [], cpu_counts: null, growth: { weight: [], counts: [] } };
  return {
    status: health.miner_index.status,
    observed_at: snapshot.observed_at,
    source_generated_at: snapshot.source_generated_at,
    block_number: snapshot.block_number,
    source: { url: BEM_MINERS_URL, evidence_url: BEM_POD_URL, freshness: health.miner_index, methodology: "circuit-count based (owner -> circuit list from the official public miner index); not the protocol's H-weight formula, so figures here are never expressed as BEM/day or as an official yield share", inspiration: { note: "Chart selection informed by reviewing the community Dune dashboard below; all figures on this page are independently computed from tapeout.net's own public feeds, not copied or scraped from Dune.", dashboard: "https://dune.com/ekonomeest/tapeout-mining-intelligence", author: "@ekonomeest" } },
    total_circuit_count: snapshot.total_circuit_count,
    top10_wallet_share_pct: snapshot.top10_wallet_share_pct,
    cpu_counts: health.miner_index.cpu_counts,
    top_wallets: JSON.parse(snapshot.top_wallets_json),
    top_tasks: JSON.parse(snapshot.top_tasks_json),
    growth: {
      weight: (weightSeries.results || []).slice().reverse().map(row => ({ observed_at: row.observed_at, total_verif_weight: row.total_verif_weight, total_unver_weight: row.total_unver_weight })),
      counts: (countSeries.results || []).slice().reverse().map(row => ({ observed_at: row.observed_at, miner_index_count: row.miner_index_count, owner_count: row.owner_count })),
    },
  };
}

const TRENDING_WINDOW_HOURS = 24;
const TRENDING_TOP_N = 15;
// "Hot topics": which tasks/wallets grew fastest over the trailing window, computed
// purely from the deltas between two of our own already-stored top-30 snapshots.
// top_tasks/top_wallets are only ever the top 30 by circuit count at snapshot time,
// so an entry absent from the older snapshot might genuinely be new, or might simply
// have been outside the top 30 back then — we cannot tell those apart, so we say so
// explicitly (baseline_available: false) rather than ever claiming "brand new."
export async function bemTrendingOverview(env) {
  await ensureBemSchema(env);
  const latest = await env.DB.prepare("SELECT * FROM bem_leaderboard_snapshots ORDER BY id DESC LIMIT 1").first();
  if (!latest) return { status: "pending", window_hours: TRENDING_WINDOW_HOURS, latest_observed_at: null, baseline_observed_at: null, trending_tasks: [], trending_wallets: [] };
  const targetTime = new Date(Date.parse(latest.observed_at) - TRENDING_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
  const baseline = await env.DB.prepare("SELECT observed_at, top_wallets_json, top_tasks_json FROM bem_leaderboard_snapshots WHERE observed_at <= ? ORDER BY observed_at DESC LIMIT 1").bind(targetTime).first();
  const latestTasks = JSON.parse(latest.top_tasks_json), latestWallets = JSON.parse(latest.top_wallets_json);
  const baselineTaskMap = new Map((baseline ? JSON.parse(baseline.top_tasks_json) : []).map(row => [row.task_id, row]));
  const baselineWalletMap = new Map((baseline ? JSON.parse(baseline.top_wallets_json) : []).map(row => [row.address, row]));
  const rankByGrowth = (rows, keyOf, priorMap) => rows
    .map(row => { const prior = priorMap.get(keyOf(row)); return { ...row, circuit_count_change: prior ? row.circuit_count - prior.circuit_count : null, baseline_available: Boolean(prior) }; })
    .filter(row => row.baseline_available && row.circuit_count_change > 0)
    .sort((a, b) => b.circuit_count_change - a.circuit_count_change)
    .slice(0, TRENDING_TOP_N);
  return {
    status: baseline ? "healthy" : "insufficient_history",
    methodology: "Ranks entries already in our own top-30 circuit-count leaderboard (not a social/discussion metric) by how much their circuit count grew over the trailing window. An entry with no comparable baseline 24h ago is left out rather than being shown as a fabricated 0% or 100% change.",
    window_hours: TRENDING_WINDOW_HOURS,
    latest_observed_at: latest.observed_at,
    baseline_observed_at: baseline?.observed_at || null,
    trending_tasks: rankByGrowth(latestTasks, row => row.task_id, baselineTaskMap),
    trending_wallets: rankByGrowth(latestWallets, row => row.address, baselineWalletMap),
  };
}

export async function bemMiningOverview(env) {
  await ensureBemSchema(env);
  await ensureBemMiningFresh(env);
  const [snapshot, health] = await Promise.all([env.DB.prepare("SELECT * FROM bem_mining_snapshots ORDER BY id DESC LIMIT 1").first(), bemHealth(env)]);
  if (!snapshot) return { status: health.mining.status, observed_at: null, source: health.mining, contracts: { mining: BEM_MINING_ADDRESS, lens: BEM_LENS_ADDRESS, token: BEM_TOKEN_ADDRESS }, metrics: null };
  const raw = JSON.parse(snapshot.raw_json), rate = String(snapshot.current_rate || "0"), verifiedWeight = toBigInt(snapshot.total_verif_weight), unverifiedWeight = toBigInt(snapshot.total_unver_weight), totalWeight = verifiedWeight + unverifiedWeight;
  return {
    status: health.mining.status, observed_at: snapshot.observed_at, source_generated_at: snapshot.source_generated_at, provider: snapshot.provider, source: { primary: BEM_STATS_URL, fallback: BEM_RPC_URL, evidence_url: BEM_POD_URL, freshness: health.mining },
    contracts: { mining: BEM_MINING_ADDRESS, lens: BEM_LENS_ADDRESS, token: BEM_TOKEN_ADDRESS, chain_id: BEM_CHAIN_ID },
    metrics: { current_rate_raw: rate, current_rate_bem_per_second: bemDecimal(rate), daily_emission_raw: (toBigInt(rate) * 86400n).toString(), daily_emission_bem: bemDecimal(toBigInt(rate) * 86400n), miner_count: snapshot.miner_count, verified_miner_count: snapshot.verif_miner_count, verified_miner_share_pct: snapshot.miner_count > 0 ? Number(((BigInt(snapshot.verif_miner_count) * 10000n) / BigInt(snapshot.miner_count))) / 100 : null, verified_pool_pct: 100 - Number(snapshot.unverified_bps || 0) / 100, total_verif_weight: snapshot.total_verif_weight, total_unver_weight: snapshot.total_unver_weight, verified_weight_share_pct: totalWeight > 0n ? Number((verifiedWeight * 10000n) / totalWeight) / 100 : null, total_mined_raw: snapshot.total_mined, total_mined_bem: bemDecimal(snapshot.total_mined), total_forgone_raw: snapshot.total_forgone, total_forgone_bem: bemDecimal(snapshot.total_forgone), task_count: snapshot.task_count, tasks_frozen: Boolean(snapshot.tasks_frozen), block_number: snapshot.block_number },
    recent_events: (Array.isArray(raw?.events) ? raw.events : []).slice(-20).reverse().map(event => ({ block: event.block ?? null, cpu: event.cpu || null, circuits: event.circuits || null, circuit_id: event.circuitId ?? null, gates: event.gates ?? null, state_count: event.nState ?? null })),
  };
}

export async function bemCatalogSnapshot(env) {
  await ensureBemSchema(env);
  return await env.DB.prepare("SELECT * FROM bem_catalog_snapshots ORDER BY id DESC LIMIT 1").first();
}

function publicBemTaskbankMeta(meta = {}) {
  return { total: meta.total ?? null, onchain: meta.onchain ?? null, comb: meta.comb ?? null, seq: meta.seq ?? null, total_nand: meta.totalNand ?? null, total_latch: meta.totalLatch ?? null, onchain_nand: meta.onchainNand ?? null, onchain_latch: meta.onchainLatch ?? null, onchain_gates: meta.onchainGates ?? null, max_run_gas: meta.maxRunGas ?? null, trivial_count: Array.isArray(meta.trivial) ? meta.trivial.length : null, offchain_count: Array.isArray(meta.offchain) ? meta.offchain.length : null, groups: Array.isArray(meta.groups) ? meta.groups : [] };
}

export async function bemTasks(env, query) {
  const [snapshot, health] = await Promise.all([bemCatalogSnapshot(env), bemHealth(env)]);
  if (!snapshot) return { status: health.taskbank.status, observed_at: null, total: 0, page: 1, page_size: 10, page_count: 0, filters: Object.fromEntries(query), meta: null, items: [] };
  const taskbank = JSON.parse(snapshot.raw_taskbank_json), q = String(query.get("q") || "").trim().toLowerCase(), tier = String(query.get("tier") || "all"), kind = String(query.get("kind") || "all"), group = String(query.get("group") || "all"), onchain = String(query.get("onchain") || "all");
  const pageSize = Math.min(Math.max(Number(query.get("page_size") || 10), 1), 50), rows = (taskbank.tasks || []).filter(task => {
    const haystack = `${task.id} ${task.name || ""} ${task.group || ""} ${task.tier || ""}`.toLowerCase();
    return (!q || haystack.includes(q)) && (tier === "all" || task.tier === tier) && (kind === "all" || task.kind === kind) && (group === "all" || task.group === group) && (onchain === "all" || Boolean(task.onchain) === (onchain === "true"));
  }).sort((left, right) => Number(left.id) - Number(right.id));
  const pageCount = Math.ceil(rows.length / pageSize), page = Math.min(Math.max(Number(query.get("page") || 1), 1), Math.max(1, pageCount)), publicFields = task => ({ id: task.id, name: task.name, tier: task.tier, group: task.group, kind: task.kind, nIn: task.nIn, nOut: task.nOut, cycles: task.cycles, refGates: task.refGates, refNand: task.refNand, refLatch: task.refLatch, refDepth: task.refDepth, K: task.K, area: task.area, Cref: task.Cref, runGas: task.runGas, onchain: Boolean(task.onchain), trivial: task.trivial || null });
  return { status: health.taskbank.status, observed_at: snapshot.observed_at, source: { taskbank: BEM_TASKBANK_URL, miners: BEM_MINERS_URL, evidence_url: BEM_POD_URL, freshness: health.taskbank }, total: rows.length, page, page_size: pageSize, page_count: pageCount, filters: { q, tier, kind, group, onchain }, meta: publicBemTaskbankMeta(taskbank.meta), items: rows.slice((page - 1) * pageSize, page * pageSize).map(publicFields) };
}

export async function bemPriceOverview(env) {
  await ensureBemSchema(env);
  await ensureBemPriceFresh(env);
  const [snapshot, health] = await Promise.all([env.DB.prepare("SELECT * FROM bem_price_snapshots ORDER BY id DESC LIMIT 1").first(), bemHealth(env)]);
  if (!snapshot) return { status: health.price.status, observed_at: null, provider: BEM_PRICE_PROVIDER, source: health.price, pair: null, warning: "Third-party aggregated market data only. Early liquidity may be shallow and price highly volatile; not investment advice." };
  const raw = JSON.parse(snapshot.raw_json), pair = raw?.pair || raw;
  const crossSources = Array.isArray(raw?.cross_sources) ? raw.cross_sources : [];
  const spread = bemNumber(raw?.cross_source_spread_pct);
  return { status: health.price.status, observed_at: snapshot.observed_at, provider: snapshot.provider, source: { endpoint: raw?.endpoint || BEM_PRICE_URL, fallback_used: Boolean(raw?.fallback_reason), fallback_reason: raw?.fallback_reason || null, selection: raw?.selection || "legacy_aggregation", source_checked_at: health.price.checked_at || raw?.source_checked_at || snapshot.observed_at, freshness: health.price, aggregation: "third_party", cross_sources: crossSources, cross_source_spread_pct: spread, cross_source_status: spread !== null && spread > 12 ? "divergent" : "within_expected_range" }, pair: { address: snapshot.pair_address, dex: pair.dexId || null, labels: pair.labels || [], url: pair.url || null, base_symbol: pair?.baseToken?.symbol || "BEM", quote_symbol: snapshot.quote_symbol, quote_address: pair?.quoteToken?.address || null }, price_usd: snapshot.price_usd, liquidity_usd: snapshot.liquidity_usd, volume_h24: snapshot.volume_h24, price_change_h24: snapshot.price_change_h24, buys_h24: snapshot.buys_h24, sells_h24: snapshot.sells_h24, warning: "Third-party market data from a verified BEM/USDT pair. Cross-source differences can occur during volatile periods; this is not an official price and not investment advice." };
}

// terms/boundaries are this site's own explanatory copy (not upstream data),
// so they follow the same zh/en-canonical, English-for-every-other-locale
// pattern as learningLocalization/ecosystemLocalization — previously this
// endpoint had no locale parameter at all and returned Chinese unconditionally,
// so every non-Chinese interface (including English) saw Chinese prose here.
const BEM_ALGORITHM_COPY = {
  zh: {
    terms: { b_star: "本层真烧工本；n 为本层真烧 NAND，m 为本层真烧 LATCH。", A: "递归面积；g 为递归元件总数，s 为递归 LATCH 总数。", C: "成本；d 为递归穿透引用后的关键路径深度。", q: "相对参考成本的质量因子，经 1/Q 到 Q 截断。", H: "算力；设计溢价 K_task·q 只给予最优首创，P 为处理器系数。" },
    boundaries: ["这是官网公开规则说明，不是收益预测。", "未由公开配置或链上读取验证的 λ、β、Q 数值不会被本 API 声称为确定事实。", "参考实现由官网描述为教科书级直接实现；题库字段是公开静态参考数据。", "组合题与时序题均来自同一题库；时序题从全零状态起跑并逐拍比对。"],
  },
  en: {
    terms: { b_star: "Real burn cost for this layer; n is NAND actually burned here, m is LATCH actually burned here.", A: "Recursive area; g is total recursive element count, s is total recursive LATCH count.", C: "Cost; d is the critical-path depth after recursing through references.", q: "Quality factor relative to the reference cost, clamped between 1/Q and Q.", H: "Mining weight; the design premium K_task·q is granted only to the current best original holder, P is the processor coefficient." },
    boundaries: ["This is a reading of publicly disclosed official rules, not an income forecast.", "λ, β and Q values not verified against public configuration or on-chain reads are not asserted as fact by this API.", "The reference implementation is described by the official site as a textbook-direct implementation; taskbank fields are public static reference data.", "Combinational and sequential tasks share one taskbank; sequential tasks start from an all-zero state and are compared cycle by cycle."],
  },
};
export async function bemAlgorithm(env, locale = "en") {
  const [snapshot, health] = await Promise.all([bemCatalogSnapshot(env), bemHealth(env)]), taskbank = snapshot ? JSON.parse(snapshot.raw_taskbank_json) : null;
  const copy = BEM_ALGORITHM_COPY[locale === "zh" ? "zh" : "en"];
  return { status: health.taskbank.status, source_type: "official_public_rules", observed_at: snapshot?.observed_at || null, source_urls: [BEM_POD_URL, BEM_TASKBANK_URL], formulae: ["b* = n + λ·m", "A = g + λ·s", "C = A · max(d,1)^β", "q = clamp(C_ref / C, 1/Q, Q)", "H = (b* + K_task·q) × P"], terms: copy.terms, boundaries: copy.boundaries, taskbank_meta: publicBemTaskbankMeta(taskbank?.meta), source: health.taskbank };
}

export async function syncBemObserved(env, { includePrice = true } = {}) {
  const jobs = [syncBemMining(env), syncBemCatalog(env)];
  if (includePrice) jobs.push(syncBemPrice(env));
  const outcomes = await Promise.allSettled(jobs);
  const mining = outcomes[0], catalog = outcomes[1], price = includePrice ? outcomes[2] : null;
  return {
    mining: mining.status === "fulfilled" ? mining.value : { status: "error", error: String(mining.reason) },
    catalog: catalog.status === "fulfilled" ? catalog.value : { status: "error", error: String(catalog.reason) },
    price: price ? (price.status === "fulfilled" ? price.value : { status: "error", error: String(price.reason) }) : { status: "scheduled_separately" },
  };
}
