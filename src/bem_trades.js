import {
  BEM_GECKO_TRADES_URL, BEM_GECKO_POOLS_URL, bemGeckoPoolTradesUrl, BEM_PRICE_PAIR_ADDRESS, BEM_TOKEN_ADDRESS,
  BEM_LEGACY_POOL_ID, BEM_LEGACY_POOL_DEX_ID, BEM_LEGACY_POOL_LABEL,
} from "./constants.js";
import { fetchJsonWithTimeout } from "./util.js";
import { ensureScheduledDomainFresh } from "./freshness.js";

// $BEM large trades & market signals: third-party aggregated executed-trade records across
// every BEM pool on BSC worth tracking (GeckoTerminal's keyless /trades endpoint, most recent
// 300 per pool). Deliberately isolated from Registry, Airdrop, mining and price paths, same as
// the rest of the bem_* domain. Every row is idempotently keyed on GeckoTerminal's own trade id
// (which already encodes block, tx hash and log index, so it is unique network-wide regardless
// of which pool it was fetched from), so repeatedly re-fetching an overlapping 300-trade window
// across syncs only ever adds genuinely new trades.
//
// Pool coverage is NOT hardcoded. GeckoTerminal's token-pools listing is polled periodically
// (see BEM_POOL_DISCOVERY_REFRESH_MINUTES) to discover every pool that actually exists for the
// BEM token; pools are ranked by 24h volume and the top ones covering ~99% of observed volume
// (capped at BEM_TRADES_POOL_CAP) become "tracked". GeckoTerminal throttles bursts of requests
// from shared Cloudflare egress IPs with HTTP 429 even with the documented headers below, so
// trades are never fetched for all tracked pools at once: a persisted round-robin cursor pulls
// only BEM_TRADES_POOLS_PER_TICK pools per sync tick, spaced apart, so the full tracked set is
// refreshed gradually across several ticks instead of bursting.
export const BEM_TRADES_REFRESH_MINUTES = 10;
const BEM_TRADES_HEALTH_MINUTES = 20;
// Pool discovery changes far more slowly than trade flow (pools rarely appear/disappear, and
// 24h volume ranking only needs to be recomputed a few times a day).
export const BEM_POOL_DISCOVERY_REFRESH_MINUTES = 240;
const BEM_POOL_DISCOVERY_HEALTH_MINUTES = 600;
// Coverage target and hard cap for the tracked-pool set: keep adding pools by descending 24h
// volume until cumulative coverage reaches this share of total observed volume, but never track
// more than the cap regardless of remaining coverage (rate-limit ceiling, not a data judgment).
const BEM_TRADES_COVERAGE_TARGET = 0.99;
export const BEM_TRADES_POOL_CAP = 8;
// How many tracked pools get their trades refreshed per sync tick, and how long to wait between
// each one within a tick. Both exist purely to avoid bursting GeckoTerminal's rate limiter.
// Measured on production, not guessed: a single pool fetch per tick from
// Cloudflare's shared egress IPs succeeds, while three fetches 1.2s apart in one
// tick had ALL THREE rejected with HTTP 429 — the discovery call shares the same
// quota. One pool per tick means a full rotation of the tracked set takes
// trackedCount ticks (~70 minutes for 7 pools), which is well inside what a
// large-trade panel needs given every fetch returns the last 300 trades and
// windows overlap heavily.
export const BEM_TRADES_POOLS_PER_TICK = 1;
const BEM_TRADES_POOL_DELAY_MS = 1500;
// Bounds both the percentile computation and the disclosed "window" to the most recently
// stored trades, so a threshold computed months from now is never silently diluted by (or
// claims coverage over) the monitor's entire lifetime history.
const BEM_TRADES_WINDOW_CAP = 1500;
const BEM_LARGE_TRADE_PERCENTILE = 95;
// A dead-quiet window (few, tiny trades) must not promote a $3 trade to "large" just
// because it happens to be the biggest one seen; this floor is a deliberately modest
// absolute backstop under the percentile, not a claim about what is economically large.
const BEM_LARGE_TRADE_FLOOR_USD = 100;
const LARGE_TRADES_LIMIT = 20;
// bem_trades had no retention at all, so it grew without bound while every read
// scanned the newest BEM_TRADES_WINDOW_CAP rows of it. Fourteen days comfortably
// outlives the disclosed window and leaves room to widen it later, and matches
// the retention precedent already set for raw trade rows in official_assets.js.
const BEM_TRADES_RETENTION_DAYS = 14;

let bemTradeSchemaReady;

async function ensureColumn(env, table, column, type) {
  try {
    await env.DB.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`).run();
  } catch (error) {
    // D1/SQLite has no "ADD COLUMN IF NOT EXISTS"; a duplicate-column error just means an
    // earlier isolate already migrated this table, which is the expected steady state.
    if (!/duplicate column/i.test(String(error?.message || error))) throw error;
  }
}

export async function ensureBemTradeSchema(env) {
  if (bemTradeSchemaReady) return bemTradeSchemaReady;
  bemTradeSchemaReady = (async () => {
    await env.DB.batch([
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS bem_trades (
        id TEXT PRIMARY KEY, tx_hash TEXT NOT NULL, block_number INTEGER, block_timestamp TEXT NOT NULL,
        kind TEXT NOT NULL, volume_usd REAL, price_usd REAL, tx_from_address TEXT, observed_at TEXT NOT NULL
      )`),
      env.DB.prepare("CREATE INDEX IF NOT EXISTS bem_trades_block_timestamp_idx ON bem_trades(block_timestamp DESC)"),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS bem_trades_sync_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT, attempted_at TEXT NOT NULL, status TEXT NOT NULL,
        fetched_count INTEGER, new_trade_count INTEGER, error TEXT
      )`),
      env.DB.prepare("CREATE INDEX IF NOT EXISTS bem_trades_sync_runs_attempted_idx ON bem_trades_sync_runs(attempted_at DESC)"),
      // Every BSC pool GeckoTerminal has ever reported for the BEM token, refreshed by
      // discoverBemPools. `tracked` marks the subset selected for round-robin trade sync.
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS bem_pools (
        pool_id TEXT PRIMARY KEY, dex_id TEXT NOT NULL, pair_label TEXT NOT NULL,
        volume_24h_usd REAL, reserve_usd REAL, rank INTEGER, tracked INTEGER NOT NULL DEFAULT 0,
        coverage_share REAL, first_seen TEXT NOT NULL, last_seen TEXT NOT NULL
      )`),
      env.DB.prepare("CREATE INDEX IF NOT EXISTS bem_pools_tracked_rank_idx ON bem_pools(tracked DESC, rank ASC)"),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS bem_pool_discovery_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT, attempted_at TEXT NOT NULL, status TEXT NOT NULL,
        pool_count INTEGER, tracked_count INTEGER, total_volume_24h_usd REAL, tracked_volume_24h_usd REAL,
        coverage_pct REAL, error TEXT
      )`),
      env.DB.prepare("CREATE INDEX IF NOT EXISTS bem_pool_discovery_runs_attempted_idx ON bem_pool_discovery_runs(attempted_at DESC)"),
      // Per-pool trade-sync outcomes, so one pool's 429/error is independently visible and
      // never mistaken for the health of the whole tracked set.
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS bem_pool_sync_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT, attempted_at TEXT NOT NULL, pool_id TEXT NOT NULL, status TEXT NOT NULL,
        fetched_count INTEGER, new_trade_count INTEGER, error TEXT
      )`),
      env.DB.prepare("CREATE INDEX IF NOT EXISTS bem_pool_sync_runs_pool_idx ON bem_pool_sync_runs(pool_id, id DESC)"),
      // The window aggregate, computed once per sync rather than once per reader.
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS bem_trades_summary (
        id INTEGER PRIMARY KEY CHECK (id = 1), computed_at TEXT NOT NULL, payload TEXT NOT NULL
      )`),
      // Single-row persisted cursor for the round-robin trade sync.
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS bem_trade_cursor (
        id INTEGER PRIMARY KEY CHECK (id = 1), next_offset INTEGER NOT NULL DEFAULT 0, updated_at TEXT
      )`),
    ]);
    // Migrate the pre-existing single-pool bem_trades table to carry pool attribution.
    // Guarded so re-running against an already-migrated table is a no-op.
    await ensureColumn(env, "bem_trades", "pool_id", "TEXT");
    await ensureColumn(env, "bem_trades", "pair_label", "TEXT");
    await ensureColumn(env, "bem_trades", "dex_id", "TEXT");
    await env.DB.prepare("CREATE INDEX IF NOT EXISTS bem_trades_pool_idx ON bem_trades(pool_id)").run();
    // Every row collected before multi-pool tracking existed came from the single legacy
    // BEM/USDT pool this monitor originally hardcoded; backfill that known attribution once
    // so old and new rows are equally queryable, instead of leaving history unlabeled.
    await env.DB.prepare("UPDATE bem_trades SET pool_id = ?, pair_label = ?, dex_id = ? WHERE pool_id IS NULL")
      .bind(BEM_LEGACY_POOL_ID, BEM_LEGACY_POOL_LABEL, BEM_LEGACY_POOL_DEX_ID).run();
  })();
  return bemTradeSchemaReady;
}

function bemTradeNumber(value) { const number = Number(value); return Number.isFinite(number) ? number : null; }
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Only GeckoTerminal's own well-formed rows are kept; a malformed entry is skipped rather
// than aborting the whole sync or being coerced into a fabricated number.
function normalizeTrade(item, pool) {
  const attributes = item?.attributes;
  const id = String(item?.id || "").trim();
  const txHash = String(attributes?.tx_hash || "").trim();
  const kind = String(attributes?.kind || "").trim().toLowerCase();
  const blockTimestamp = String(attributes?.block_timestamp || "").trim();
  if (!id || !txHash || !blockTimestamp || !["buy", "sell"].includes(kind)) return null;
  const fromToken = String(attributes?.from_token_address || "").toLowerCase();
  const toToken = String(attributes?.to_token_address || "").toLowerCase();
  let priceUsd = null;
  if (fromToken === BEM_TOKEN_ADDRESS) priceUsd = bemTradeNumber(attributes.price_from_in_usd);
  else if (toToken === BEM_TOKEN_ADDRESS) priceUsd = bemTradeNumber(attributes.price_to_in_usd);
  else return null; // Not actually a BEM-side leg of this pool's trade; never guess a price.
  const volumeUsd = bemTradeNumber(attributes.volume_in_usd);
  if (volumeUsd === null) return null;
  return {
    id, tx_hash: txHash, block_number: Number.isFinite(Number(attributes.block_number)) ? Number(attributes.block_number) : null,
    block_timestamp: blockTimestamp, kind, volume_usd: volumeUsd, price_usd: priceUsd,
    tx_from_address: String(attributes.tx_from_address || "").toLowerCase() || null,
    pool_id: pool.pool_id, pair_label: pool.pair_label, dex_id: pool.dex_id,
  };
}

// GeckoTerminal pool "addresses" are not always 0x+40-hex contract addresses — some DEXes
// (pancakeswap-infinity-clmm, uniswap-v4-bsc) report 64-hex-char pool ids instead — so this
// never assumes a fixed length or format, it only trims and lowercases.
function normalizePool(item) {
  const attributes = item?.attributes;
  const poolId = String(attributes?.address || "").trim().toLowerCase();
  const dexId = String(item?.relationships?.dex?.data?.id || "").trim();
  const pairLabel = String(attributes?.name || "").trim();
  const volume24hUsd = bemTradeNumber(attributes?.volume_usd?.h24);
  const reserveUsd = bemTradeNumber(attributes?.reserve_in_usd);
  if (!poolId || !dexId || !pairLabel || volume24hUsd === null) return null;
  return { pool_id: poolId, dex_id: dexId, pair_label: pairLabel, volume_24h_usd: volume24hUsd, reserve_usd: reserveUsd };
}

async function recordPoolDiscoveryRun(env, row) {
  await env.DB.prepare(`INSERT INTO bem_pool_discovery_runs
    (attempted_at, status, pool_count, tracked_count, total_volume_24h_usd, tracked_volume_24h_usd, coverage_pct, error)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(row.attempted_at, row.status, row.pool_count ?? null, row.tracked_count ?? null, row.total_volume_24h_usd ?? null,
      row.tracked_volume_24h_usd ?? null, row.coverage_pct ?? null, row.error ? String(row.error).slice(0, 500) : null).run();
}

// Fetches the live list of every BEM pool GeckoTerminal has indexed on BSC, ranks it by 24h
// volume, and selects the tracked subset by walking that ranking until cumulative coverage
// reaches BEM_TRADES_COVERAGE_TARGET (or the hard cap is hit). The full discovered list is
// stored either way, so untracked pools remain visible (never silently dropped) even though
// their trades are not fetched.
// GeckoTerminal's keyless feed is rate-limited per source IP, and Cloudflare
// Workers egress from a pool of shared addresses used by everyone else too, so a
// 429 here says almost nothing about our own request rate — it is whichever
// shared address this attempt happened to leave from. Measured on production:
// only ~16% of single-attempt ticks succeeded, and one pool lost ten consecutive
// attempts while the same URL returned 200 instantly from a residential IP.
// Retrying gives the request another draw. Attempts are few and widely spaced,
// so this stays polite: a rejected request costs the provider almost nothing,
// and we never retry a genuine error response.
const GECKO_HEADERS = { accept: "application/json;version=20230302", "user-agent": "tapeout.work-research/1.0 (+https://tapeout.work)" };
const GECKO_MAX_ATTEMPTS = 3;
const GECKO_RETRY_DELAY_MS = 2500;
export async function fetchGecko(url) {
  let lastError;
  for (let attempt = 1; attempt <= GECKO_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await fetchJsonWithTimeout(url, { headers: GECKO_HEADERS });
    } catch (error) {
      lastError = error;
      // Only a throttle is worth another draw; a 404 or a malformed body will not
      // become correct by asking again.
      if (!/\b429\b/.test(String(error?.message || error))) throw error;
      if (attempt < GECKO_MAX_ATTEMPTS) await sleep(GECKO_RETRY_DELAY_MS * attempt);
    }
  }
  throw lastError;
}

export async function discoverBemPools(env) {
  await ensureBemTradeSchema(env);
  const attemptedAt = new Date().toISOString();
  try {
    const payload = await fetchGecko(BEM_GECKO_POOLS_URL);
    const items = Array.isArray(payload?.data) ? payload.data : [];
    if (!items.length) throw new Error("GeckoTerminal pools response has no data rows");
    const pools = items.map(normalizePool).filter(Boolean);
    if (!pools.length) throw new Error("GeckoTerminal pools response had no usable rows");
    pools.sort((a, b) => b.volume_24h_usd - a.volume_24h_usd);
    const totalVolume = pools.reduce((sum, pool) => sum + pool.volume_24h_usd, 0);
    const trackedPools = [];
    let cumulative = 0;
    for (const pool of pools) {
      if (trackedPools.length >= BEM_TRADES_POOL_CAP) break;
      const coverageSoFar = totalVolume > 0 ? cumulative / totalVolume : 0;
      if (trackedPools.length > 0 && coverageSoFar >= BEM_TRADES_COVERAGE_TARGET) break;
      trackedPools.push(pool);
      cumulative += pool.volume_24h_usd;
    }
    const trackedIds = new Set(trackedPools.map(pool => pool.pool_id));
    const trackedVolume = trackedPools.reduce((sum, pool) => sum + pool.volume_24h_usd, 0);
    const coveragePct = totalVolume > 0 ? Math.round((trackedVolume / totalVolume) * 10000) / 100 : null;
    const statements = pools.map((pool, index) => env.DB.prepare(`INSERT INTO bem_pools
        (pool_id, dex_id, pair_label, volume_24h_usd, reserve_usd, rank, tracked, coverage_share, first_seen, last_seen)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(pool_id) DO UPDATE SET dex_id = excluded.dex_id, pair_label = excluded.pair_label,
          volume_24h_usd = excluded.volume_24h_usd, reserve_usd = excluded.reserve_usd, rank = excluded.rank,
          tracked = excluded.tracked, coverage_share = excluded.coverage_share, last_seen = excluded.last_seen`)
      .bind(pool.pool_id, pool.dex_id, pool.pair_label, pool.volume_24h_usd, pool.reserve_usd, index + 1,
        trackedIds.has(pool.pool_id) ? 1 : 0, totalVolume > 0 ? pool.volume_24h_usd / totalVolume : null, attemptedAt, attemptedAt));
    for (let index = 0; index < statements.length; index += 50) await env.DB.batch(statements.slice(index, index + 50));
    const row = { attempted_at: attemptedAt, status: "updated", pool_count: pools.length, tracked_count: trackedPools.length, total_volume_24h_usd: totalVolume, tracked_volume_24h_usd: trackedVolume, coverage_pct: coveragePct };
    await recordPoolDiscoveryRun(env, row);
    return row;
  } catch (error) {
    const row = { attempted_at: attemptedAt, status: "error", error: error?.message || String(error) };
    await recordPoolDiscoveryRun(env, row);
    return row;
  }
}

export async function ensureBemPoolDiscoveryFresh(env) {
  return ensureScheduledDomainFresh({
    key: "bem_pool_discovery", env, prepare: () => ensureBemTradeSchema(env),
    latestRun: () => env.DB.prepare("SELECT attempted_at, status FROM bem_pool_discovery_runs ORDER BY id DESC LIMIT 1").first(),
    sync: discoverBemPools, maxAgeMinutes: BEM_POOL_DISCOVERY_REFRESH_MINUTES,
  });
}

async function recordPoolSyncRun(env, row) {
  await env.DB.prepare("INSERT INTO bem_pool_sync_runs (attempted_at, pool_id, status, fetched_count, new_trade_count, error) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(row.attempted_at, row.pool_id, row.status, row.fetched_count ?? null, row.new_trade_count ?? null, row.error ? String(row.error).slice(0, 500) : null).run();
}

// Fetches and stores trades for exactly one pool. Any failure (429, timeout, malformed
// payload) is caught and recorded against this pool alone — it must never abort the tick or
// touch another pool's rows.
async function syncBemTradesForPool(env, pool, attemptedAt) {
  try {
    const payload = await fetchGecko(bemGeckoPoolTradesUrl(pool.pool_id));
    const items = Array.isArray(payload?.data) ? payload.data : [];
    if (!items.length) throw new Error("GeckoTerminal trades response has no data rows");
    const rows = items.map(item => normalizeTrade(item, pool)).filter(Boolean);
    let newTradeCount = 0;
    for (let index = 0; index < rows.length; index += 50) {
      const chunk = rows.slice(index, index + 50);
      const results = await env.DB.batch(chunk.map(row => env.DB.prepare(`INSERT OR IGNORE INTO bem_trades
        (id, tx_hash, block_number, block_timestamp, kind, volume_usd, price_usd, tx_from_address, observed_at, pool_id, pair_label, dex_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(row.id, row.tx_hash, row.block_number, row.block_timestamp, row.kind, row.volume_usd, row.price_usd, row.tx_from_address, attemptedAt, row.pool_id, row.pair_label, row.dex_id)));
      newTradeCount += results.reduce((sum, result) => sum + Number(result?.meta?.changes || 0), 0);
    }
    const status = newTradeCount > 0 ? "updated" : "no_change";
    const result = { pool_id: pool.pool_id, status, fetched_count: rows.length, new_trade_count: newTradeCount };
    await recordPoolSyncRun(env, { attempted_at: attemptedAt, ...result });
    return result;
  } catch (error) {
    const result = { pool_id: pool.pool_id, status: "error", fetched_count: 0, new_trade_count: 0, error: error?.message || String(error) };
    await recordPoolSyncRun(env, { attempted_at: attemptedAt, ...result });
    return result;
  }
}

// One round-robin tick: advances a persisted cursor through the tracked-pool list and syncs
// only BEM_TRADES_POOLS_PER_TICK of them, spaced apart, so a full rotation never bursts
// GeckoTerminal. A 429 or error on one pool is isolated to that pool's own outcome and never
// aborts the tick or touches another pool's stored trades.
export async function syncBemTrades(env) {
  await ensureBemTradeSchema(env);
  const attemptedAt = new Date().toISOString();
  const tracked = (await env.DB.prepare("SELECT pool_id, dex_id, pair_label FROM bem_pools WHERE tracked = 1 ORDER BY rank ASC").all()).results || [];
  if (!tracked.length) {
    const message = "No tracked BEM pool is known yet; pool discovery has not completed successfully.";
    await env.DB.prepare("INSERT INTO bem_trades_sync_runs (attempted_at, status, fetched_count, new_trade_count, error) VALUES (?, 'error', NULL, NULL, ?)").bind(attemptedAt, message).run();
    return { status: "error", attempted_at: attemptedAt, error: message };
  }
  const batchSize = Math.min(BEM_TRADES_POOLS_PER_TICK, tracked.length);
  const cursorRow = await env.DB.prepare("SELECT next_offset FROM bem_trade_cursor WHERE id = 1").first();
  const offset = ((Number(cursorRow?.next_offset) || 0) % tracked.length + tracked.length) % tracked.length;
  const cursorBatch = Array.from({ length: batchSize }, (_, index) => tracked[(offset + index) % tracked.length]);
  // A pool that has never landed a single trade contributes nothing to the
  // aggregate, so it jumps the queue until it does. Blind round-robin meant one
  // unlucky pool — 12% of observed volume — sat empty through ten rotations,
  // waiting a full cycle between attempts while pools that already had data
  // took their turns. Once it succeeds it rejoins the normal rotation, so this
  // cannot starve the others.
  const emptyRow = await env.DB.prepare(`SELECT p.pool_id FROM bem_pools p
      WHERE p.tracked = 1 AND NOT EXISTS (SELECT 1 FROM bem_trades t WHERE t.pool_id = p.pool_id)
      ORDER BY p.rank ASC LIMIT 1`).first();
  const emptyPool = emptyRow ? tracked.find(pool => pool.pool_id === emptyRow.pool_id) : null;
  const batch = emptyPool && !cursorBatch.some(pool => pool.pool_id === emptyPool.pool_id)
    ? [emptyPool, ...cursorBatch.slice(0, Math.max(0, batchSize - 1))]
    : cursorBatch;

  const poolOutcomes = [];
  for (let index = 0; index < batch.length; index++) {
    if (index > 0) await sleep(BEM_TRADES_POOL_DELAY_MS);
    poolOutcomes.push(await syncBemTradesForPool(env, batch[index], attemptedAt));
  }
  await env.DB.prepare(`INSERT INTO bem_trade_cursor (id, next_offset, updated_at) VALUES (1, ?, ?)
      ON CONFLICT(id) DO UPDATE SET next_offset = excluded.next_offset, updated_at = excluded.updated_at`)
    .bind((offset + batchSize) % tracked.length, attemptedAt).run();

  const failed = poolOutcomes.filter(outcome => outcome.status === "error");
  const succeeded = poolOutcomes.filter(outcome => outcome.status !== "error");
  const fetchedCount = succeeded.reduce((sum, outcome) => sum + outcome.fetched_count, 0);
  const newTradeCount = succeeded.reduce((sum, outcome) => sum + outcome.new_trade_count, 0);
  const status = failed.length === poolOutcomes.length ? "error" : failed.length ? "partial" : newTradeCount > 0 ? "updated" : "no_change";
  const error = failed.length ? failed.map(outcome => `${outcome.pool_id}: ${outcome.error}`).join(" | ").slice(0, 500) : null;
  await env.DB.prepare("INSERT INTO bem_trades_sync_runs (attempted_at, status, fetched_count, new_trade_count, error) VALUES (?, ?, ?, ?, ?)")
    .bind(attemptedAt, status, fetchedCount, newTradeCount, error).run();
  await recomputeBemTradesSummary(env, attemptedAt);
  const retentionBefore = new Date(Date.now() - BEM_TRADES_RETENTION_DAYS * 86400000).toISOString();
  await env.DB.prepare("DELETE FROM bem_trades WHERE block_timestamp < ?").bind(retentionBefore).run();
  // Per-pool run logs are diagnostics, not evidence anyone reads back historically;
  // only the newest rows per pool are ever queried, so they get pruned too.
  await env.DB.prepare("DELETE FROM bem_pool_sync_runs WHERE attempted_at < ?").bind(retentionBefore).run();
  await env.DB.prepare("DELETE FROM bem_trades_sync_runs WHERE attempted_at < ?").bind(retentionBefore).run();
  return { status, attempted_at: attemptedAt, fetched_count: fetchedCount, new_trade_count: newTradeCount, pools: poolOutcomes };
}

export async function ensureBemTradesFresh(env) {
  // Pool discovery is gated independently on its own (much longer) cadence, so this only
  // actually re-fetches the pools listing a few times a day; every other tick it is a no-op
  // read of the latest discovery run.
  await ensureBemPoolDiscoveryFresh(env);
  // The shared default retries a failing domain every two minutes, which for a
  // third party that is rejecting us means asking a saturated rate limiter the
  // same question twelve times an hour and being refused every time. Back off as
  // consecutive failures accumulate: still prompt after a blip, deliberately
  // sparse once it is clear the provider is not serving us right now. A single
  // success resets it, because the streak query only counts the newest runs.
  const recent = await env.DB.prepare("SELECT status FROM bem_trades_sync_runs ORDER BY id DESC LIMIT 8").all();
  let consecutiveFailures = 0;
  for (const row of recent.results || []) { if (row.status !== "error") break; consecutiveFailures += 1; }
  // Capped at half an hour rather than a full one. Measured success is ~13% per
  // draw, so with three retries per attempt a 30-minute ceiling gives roughly a
  // 57% chance of landing a refresh within the hour against 34% at 60 minutes —
  // while still asking only about six times an hour, which is nothing for the
  // provider. Backing off is about not hammering a limiter that is refusing us,
  // not about going quiet.
  const errorBackoffMinutes = consecutiveFailures >= 6 ? 30 : consecutiveFailures >= 3 ? 20 : consecutiveFailures >= 1 ? 10 : 2;
  return ensureScheduledDomainFresh({
    key: "bem_trades", env, prepare: () => ensureBemTradeSchema(env),
    latestRun: () => env.DB.prepare("SELECT attempted_at, status FROM bem_trades_sync_runs ORDER BY id DESC LIMIT 1").first(),
    sync: syncBemTrades, maxAgeMinutes: BEM_TRADES_REFRESH_MINUTES, errorBackoffMinutes,
  });
}

// A transient collection error never flips a response that still has real stored data
// to "error"; "error" is reserved for having nothing to show at all. Unlike the price
// feed, staleness here is judged by data age alone: pools are fetched round-robin from
// a rate-limited upstream, so the most recent attempt is an error most of the time
// even while the stored window is an hour old and perfectly usable — calling that
// "stale" was true of the attempt, not of the data. The failed attempt is still
// reported, separately, as last_attempt_failed.
function bemTradesFreshness(latestRun, latestSuccessRun, hasData) {
  const anchor = latestSuccessRun?.attempted_at || null;
  const ageMinutes = anchor ? Math.max(0, Math.round((Date.now() - Date.parse(anchor)) / 60000)) : null;
  const status = !hasData
    ? (latestRun?.status === "error" ? "error" : "pending")
    : (ageMinutes === null || ageMinutes > BEM_TRADES_HEALTH_MINUTES ? "stale" : "healthy");
  return { status, age_minutes: ageMinutes, checked_at: anchor, last_attempt_failed: latestRun?.status === "error", last_run: latestRun || null };
}

// Per-pool freshness for the coverage block. Each tracked pool is only actually re-fetched
// once every full round-robin rotation (tracked_count / BEM_TRADES_POOLS_PER_TICK ticks), so
// its own staleness threshold is scaled to that cadence instead of reusing the fleet-wide one
// — otherwise every pool but the most-recently-fetched would be misreported as stale.
function bemPoolFreshness(latestRun, latestSuccessRun, trackedCount) {
  const cycleTicks = Math.max(1, Math.ceil(trackedCount / BEM_TRADES_POOLS_PER_TICK));
  const healthMinutes = cycleTicks * BEM_TRADES_REFRESH_MINUTES + BEM_TRADES_HEALTH_MINUTES;
  const anchor = latestSuccessRun?.attempted_at || null;
  const ageMinutes = anchor ? Math.max(0, Math.round((Date.now() - Date.parse(anchor)) / 60000)) : null;
  const status = !anchor
    ? (latestRun?.status === "error" ? "error" : "pending")
    : (ageMinutes > healthMinutes ? "stale" : "healthy");
  return { status, age_minutes: ageMinutes, checked_at: anchor, last_status: latestRun?.status || null, last_error: latestRun?.status === "error" ? latestRun?.error || null : null };
}

// Nearest-rank percentile over an ascending-sorted array; null on an empty input rather
// than a fabricated zero.
function percentile(sortedAscending, p) {
  if (!sortedAscending.length) return null;
  const index = Math.min(sortedAscending.length - 1, Math.floor((p / 100) * sortedAscending.length));
  return sortedAscending[index];
}

function truncateAddress(address) {
  if (!address || address.length < 14) return address || null;
  return `${address.slice(0, 8)}…${address.slice(-4)}`;
}

async function bemPoolCoverage(env) {
  const [trackedResult, poolCountRow, trackedCountRow, discoveryRun] = await Promise.all([
    env.DB.prepare("SELECT pool_id, dex_id, pair_label, volume_24h_usd, reserve_usd, rank, coverage_share, last_seen FROM bem_pools WHERE tracked = 1 ORDER BY rank ASC").all(),
    env.DB.prepare("SELECT COUNT(*) AS total FROM bem_pools").first(),
    env.DB.prepare("SELECT COUNT(*) AS total FROM bem_pools WHERE tracked = 1").first(),
    env.DB.prepare("SELECT attempted_at, status, pool_count, tracked_count, total_volume_24h_usd, tracked_volume_24h_usd, coverage_pct, error FROM bem_pool_discovery_runs ORDER BY id DESC LIMIT 1").first(),
  ]);
  const trackedPools = trackedResult.results || [];
  const totalPoolCount = Number(poolCountRow?.total || 0);
  const trackedPoolCount = Number(trackedCountRow?.total || 0);
  // Three grouped queries instead of three per pool. The per-pool loop was an N+1
  // that cost this endpoint 829ms in production at seven pools; the work is the
  // same for the database either way, but it is one round trip per fact rather
  // than one per pool per fact.
  const [latestRunRows, latestSuccessRows, storedRows] = await Promise.all([
    env.DB.prepare(`SELECT r.pool_id, r.attempted_at, r.status, r.error FROM bem_pool_sync_runs r
      JOIN (SELECT pool_id, MAX(id) AS id FROM bem_pool_sync_runs GROUP BY pool_id) latest
      ON latest.id = r.id`).all(),
    env.DB.prepare(`SELECT r.pool_id, r.attempted_at, r.status FROM bem_pool_sync_runs r
      JOIN (SELECT pool_id, MAX(id) AS id FROM bem_pool_sync_runs WHERE status IN ('updated','no_change') GROUP BY pool_id) latest
      ON latest.id = r.id`).all(),
    // Published so a reader can confirm for themselves that this really is a
    // multi-pool aggregate, instead of taking the coverage percentage on faith.
    env.DB.prepare("SELECT pool_id, COUNT(*) AS n, MAX(block_timestamp) AS latest FROM bem_trades WHERE pool_id IS NOT NULL GROUP BY pool_id").all(),
  ]);
  const byPool = rows => new Map((rows.results || []).map(row => [row.pool_id, row]));
  const latestRunByPool = byPool(latestRunRows), latestSuccessByPool = byPool(latestSuccessRows), storedByPool = byPool(storedRows);
  const pools = trackedPools.map(pool => {
    const latestRun = latestRunByPool.get(pool.pool_id) || null;
    const latestSuccessRun = latestSuccessByPool.get(pool.pool_id) || null;
    const storedRow = storedByPool.get(pool.pool_id) || null;
    return {
      pool_id: pool.pool_id, pair_label: pool.pair_label, dex_id: pool.dex_id, rank: pool.rank,
      volume_24h_usd: pool.volume_24h_usd, reserve_usd: pool.reserve_usd,
      share_of_total_volume: pool.coverage_share, bscscan_pool_url: /^0x[a-f0-9]{40}$/.test(pool.pool_id) ? `https://bscscan.com/address/${pool.pool_id}` : null,
      stored_trade_count: Number(storedRow?.n || 0), latest_stored_trade_at: storedRow?.latest || null,
      trades_url: bemGeckoPoolTradesUrl(pool.pool_id), freshness: bemPoolFreshness(latestRun, latestSuccessRun, trackedPoolCount),
    };
  });
  return {
    policy: `Pools are ranked by 24h volume from GeckoTerminal's public token-pools listing and tracked, in descending order, until cumulative coverage reaches ~${Math.round(BEM_TRADES_COVERAGE_TARGET * 100)}% of total observed 24h BEM volume, capped at ${BEM_TRADES_POOL_CAP} pools regardless of remaining coverage. This list is recomputed from live data on a schedule (never hardcoded). A persisted round-robin cursor fetches trades for ${BEM_TRADES_POOLS_PER_TICK} tracked pools per ~${BEM_TRADES_REFRESH_MINUTES}-minute tick — GeckoTerminal's keyless feed throttles bursts of requests, so pools are refreshed gradually across ticks rather than all at once.`,
    discovery: { last_checked_at: discoveryRun?.attempted_at || null, status: discoveryRun?.status || null, source_url: BEM_GECKO_POOLS_URL, error: discoveryRun?.status === "error" ? discoveryRun?.error || null : null },
    total_pools_observed: totalPoolCount, tracked_pool_count: trackedPoolCount, untracked_pool_count: Math.max(0, totalPoolCount - trackedPoolCount),
    total_volume_24h_usd: discoveryRun?.total_volume_24h_usd ?? null, tracked_volume_24h_usd: discoveryRun?.tracked_volume_24h_usd ?? null,
    coverage_pct: discoveryRun?.coverage_pct ?? null, pools,
  };
}

// Pure: the same arithmetic the read path used to run inline, extracted so it can
// run once per sync over the window instead of once per reader. Rows come in
// newest-first.
export function buildBemTradesWindow(rows, totalStoredCount, trackedPoolCount) {
  if (!rows.length) {
    return {
      empty: true,
      window: { earliest_block_timestamp: null, latest_block_timestamp: null, trade_count: 0, total_stored_count: totalStoredCount, capped: false },
      threshold: null, large_trades: [],
      flow: { buy_count: 0, sell_count: 0, buy_volume_usd: 0, sell_volume_usd: 0, net_flow_usd: 0 },
    };
  }
  const volumesAscending = rows.map(row => row.volume_usd).filter(value => Number.isFinite(value)).sort((a, b) => a - b);
  const percentileValue = percentile(volumesAscending, BEM_LARGE_TRADE_PERCENTILE);
  const thresholdUsd = Math.max(percentileValue ?? 0, BEM_LARGE_TRADE_FLOOR_USD);
  // Ranked by size, not recency. Taking the newest N above the threshold returned
  // the largest trades from whichever pools the round-robin happened to refresh
  // most recently, which is an artifact of our own sync schedule, not the market.
  const largeTrades = rows.filter(row => Number.isFinite(row.volume_usd) && row.volume_usd >= thresholdUsd)
    .sort((a, b) => b.volume_usd - a.volume_usd)
    .slice(0, LARGE_TRADES_LIMIT).map(row => ({
      tx_hash: row.tx_hash, block_timestamp: row.block_timestamp, kind: row.kind, volume_usd: row.volume_usd, price_usd: row.price_usd,
      from_address: truncateAddress(row.tx_from_address), bscscan_url: `https://bscscan.com/tx/${row.tx_hash}`,
      pair_label: row.pair_label || null, dex: row.dex_id || null,
    }));
  const buys = rows.filter(row => row.kind === "buy"), sells = rows.filter(row => row.kind === "sell");
  const sum = list => list.reduce((total, row) => total + (Number.isFinite(row.volume_usd) ? row.volume_usd : 0), 0);
  const buyVolumeUsd = sum(buys), sellVolumeUsd = sum(sells);
  return {
    empty: false,
    window: {
      earliest_block_timestamp: rows.at(-1).block_timestamp, latest_block_timestamp: rows[0].block_timestamp,
      trade_count: rows.length, total_stored_count: totalStoredCount, capped: totalStoredCount > rows.length,
    },
    threshold: {
      usd: Math.round(thresholdUsd * 100) / 100, percentile: BEM_LARGE_TRADE_PERCENTILE, floor_usd: BEM_LARGE_TRADE_FLOOR_USD,
      method: `The greater of the ${BEM_LARGE_TRADE_PERCENTILE}th percentile trade size and a ${BEM_LARGE_TRADE_FLOOR_USD} floor, computed over the ${rows.length} most recently stored trades aggregated across all ${trackedPoolCount} tracked pools. The floor exists so a quiet window with only small trades never has its biggest trade relabeled "large".`,
    },
    large_trades: largeTrades,
    flow: {
      buy_count: buys.length, sell_count: sells.length,
      buy_volume_usd: Math.round(buyVolumeUsd * 100) / 100, sell_volume_usd: Math.round(sellVolumeUsd * 100) / 100,
      net_flow_usd: Math.round((buyVolumeUsd - sellVolumeUsd) * 100) / 100,
    },
  };
}

// Reads the window once, per sync, and stores what a reader needs. Recomputing this
// on every request meant scanning BEM_TRADES_WINDOW_CAP rows per page load, which is
// what exhausted this account's daily D1 row-read allowance and took every
// database-backed endpoint down with it.
export async function recomputeBemTradesSummary(env, computedAt = new Date().toISOString(), trackedPoolCount = null) {
  const [windowResult, totalRow] = await Promise.all([
    env.DB.prepare(`SELECT tx_hash, block_timestamp, kind, volume_usd, price_usd, tx_from_address, pair_label, dex_id FROM bem_trades ORDER BY block_timestamp DESC, id DESC LIMIT ${BEM_TRADES_WINDOW_CAP}`).all(),
    env.DB.prepare("SELECT COUNT(*) AS total FROM bem_trades").first(),
  ]);
  let pools = trackedPoolCount;
  if (pools === null) {
    const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM bem_pools WHERE tracked = 1").first();
    pools = Number(row?.n || 0);
  }
  const payload = buildBemTradesWindow(windowResult.results || [], Number(totalRow?.total || 0), pools);
  await env.DB.prepare("INSERT INTO bem_trades_summary (id, computed_at, payload) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET computed_at=excluded.computed_at, payload=excluded.payload")
    .bind(computedAt, JSON.stringify(payload)).run();
  return payload;
}

export async function bemTradesOverview(env) {
  await ensureBemTradeSchema(env);
  // Cold-start self-heal only. The five-minute cron keeps this domain fresh; letting
  // a reader's request drive the upstream fetch made some page loads wait ~2s on
  // GeckoTerminal. Once any trade is stored, a request never triggers a network sync.
  const seeded = await env.DB.prepare("SELECT 1 AS seeded FROM bem_trades LIMIT 1").first();
  if (!seeded) await ensureBemTradesFresh(env);
  // One stored aggregate instead of a window scan per request.
  const [summaryRow, latestRun, latestSuccessRun, coverage] = await Promise.all([
    env.DB.prepare("SELECT computed_at, payload FROM bem_trades_summary WHERE id = 1").first(),
    env.DB.prepare("SELECT attempted_at, status, fetched_count, new_trade_count, error FROM bem_trades_sync_runs ORDER BY id DESC LIMIT 1").first(),
    env.DB.prepare("SELECT attempted_at, status FROM bem_trades_sync_runs WHERE status IN ('updated','no_change','partial') ORDER BY id DESC LIMIT 1").first(),
    bemPoolCoverage(env),
  ]);
  let summary = null;
  try { summary = summaryRow?.payload ? JSON.parse(summaryRow.payload) : null; } catch { summary = null; }
  // Absent only until the first sync after this shipped; built here once so the
  // endpoint never answers with an empty window it has not actually checked.
  if (!summary) summary = await recomputeBemTradesSummary(env, new Date().toISOString(), coverage.tracked_pool_count);
  const freshness = bemTradesFreshness(latestRun, latestSuccessRun, !summary.empty);
  const coveragePctDisplay = coverage.coverage_pct !== null ? `${coverage.coverage_pct}%` : "an unknown share of";
  const boundary = `Third-party aggregated DEX trade data for ${coverage.tracked_pool_count} BEM pool${coverage.tracked_pool_count === 1 ? "" : "s"} on BNB Smart Chain (of ${coverage.total_pools_observed} pool${coverage.total_pools_observed === 1 ? "" : "s"} GeckoTerminal currently lists for this token), sourced from GeckoTerminal's public trades feed. Tracked pools are the highest-volume pools covering approximately ${coveragePctDisplay} of observed 24h BEM trading volume; the remaining ${coverage.untracked_pool_count} known pool${coverage.untracked_pool_count === 1 ? "" : "s"} are not tracked and ${coverage.untracked_pool_count === 1 ? "its" : "their"} trades are not reflected here. This is not a complete record of all BEM transfers across the chain, not official TapeOut protocol data, and not a trading signal or recommendation. Wallet addresses are public on-chain data and are never attributed to a real-world identity.`;
  // Highest-volume tracked pool, kept as the legacy single source fields; the full
  // multi-pool picture lives in the coverage block.
  const primaryPool = coverage.pools[0] || null;
  const source = {
    url: primaryPool ? bemGeckoPoolTradesUrl(primaryPool.pool_id) : BEM_GECKO_TRADES_URL,
    pair_address: primaryPool ? primaryPool.pool_id : BEM_PRICE_PAIR_ADDRESS.toLowerCase(),
    pools_source_url: BEM_GECKO_POOLS_URL, provider: "GeckoTerminal (public trades feed)", tracked_pool_count: coverage.tracked_pool_count, freshness,
  };
  const base = {
    status: freshness.status, source, window: summary.window, threshold: summary.threshold,
    large_trades: summary.large_trades, flow: summary.flow, coverage, boundary,
    // When the aggregate was derived, which is not the same instant as when the
    // trades were fetched; a reader comparing timestamps should see both.
    summary_computed_at: summaryRow?.computed_at ?? null,
  };
  if (summary.empty) return { ...base, methodology: "No trade has been observed yet across any tracked pool." };
  return {
    ...base,
    methodology: `Large trades are flagged, not predicted: any trade at or above the computed threshold within the stored window above, aggregated across every tracked pool. "Buy" means quote token swapped for BEM; "sell" means BEM swapped for the quote token, per GeckoTerminal's own trade classification. Each trade's pair_label and dex identify which pool it came from.`,
  };
}
