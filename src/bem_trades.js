import { BEM_GECKO_TRADES_URL, BEM_PRICE_PAIR_ADDRESS, BEM_TOKEN_ADDRESS } from "./constants.js";
import { fetchJsonWithTimeout } from "./util.js";
import { ensureScheduledDomainFresh } from "./freshness.js";

// $BEM large trades & market signals: third-party aggregated executed-trade records for
// one specific BEM/USDT pool (GeckoTerminal's keyless /trades endpoint, most recent 300).
// Deliberately isolated from Registry, Airdrop, mining and price paths, same as the rest
// of the bem_* domain. Every row is idempotently keyed on GeckoTerminal's own trade id
// (which already encodes block, tx hash and log ordering), so repeatedly re-fetching an
// overlapping 300-trade window across syncs only ever adds genuinely new trades and
// gradually builds a longer observed history than any single fetch returns.
export const BEM_TRADES_REFRESH_MINUTES = 10;
const BEM_TRADES_HEALTH_MINUTES = 20;
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

let bemTradeSchemaReady;

export async function ensureBemTradeSchema(env) {
  if (bemTradeSchemaReady) return bemTradeSchemaReady;
  bemTradeSchemaReady = env.DB.batch([
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
  ]);
  return bemTradeSchemaReady;
}

function bemTradeNumber(value) { const number = Number(value); return Number.isFinite(number) ? number : null; }

// Only GeckoTerminal's own well-formed rows are kept; a malformed entry is skipped rather
// than aborting the whole sync or being coerced into a fabricated number.
function normalizeTrade(item) {
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
  };
}

export async function syncBemTrades(env) {
  await ensureBemTradeSchema(env);
  const attemptedAt = new Date().toISOString();
  try {
    const payload = await fetchJsonWithTimeout(BEM_GECKO_TRADES_URL);
    const items = Array.isArray(payload?.data) ? payload.data : [];
    if (!items.length) throw new Error("GeckoTerminal trades response has no data rows");
    const rows = items.map(normalizeTrade).filter(Boolean);
    let newTradeCount = 0;
    for (let index = 0; index < rows.length; index += 50) {
      const chunk = rows.slice(index, index + 50);
      const results = await env.DB.batch(chunk.map(row => env.DB.prepare(`INSERT OR IGNORE INTO bem_trades
        (id, tx_hash, block_number, block_timestamp, kind, volume_usd, price_usd, tx_from_address, observed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(row.id, row.tx_hash, row.block_number, row.block_timestamp, row.kind, row.volume_usd, row.price_usd, row.tx_from_address, attemptedAt)));
      newTradeCount += results.reduce((sum, result) => sum + Number(result?.meta?.changes || 0), 0);
    }
    const status = newTradeCount > 0 ? "updated" : "no_change";
    await env.DB.prepare("INSERT INTO bem_trades_sync_runs (attempted_at, status, fetched_count, new_trade_count, error) VALUES (?, ?, ?, ?, NULL)")
      .bind(attemptedAt, status, rows.length, newTradeCount).run();
    return { status, attempted_at: attemptedAt, fetched_count: rows.length, new_trade_count: newTradeCount };
  } catch (error) {
    await env.DB.prepare("INSERT INTO bem_trades_sync_runs (attempted_at, status, fetched_count, new_trade_count, error) VALUES (?, 'error', NULL, NULL, ?)")
      .bind(attemptedAt, String(error?.message || error).slice(0, 500)).run();
    return { status: "error", attempted_at: attemptedAt, error: error?.message || String(error) };
  }
}

export async function ensureBemTradesFresh(env) {
  return ensureScheduledDomainFresh({
    key: "bem_trades", env, prepare: () => ensureBemTradeSchema(env),
    latestRun: () => env.DB.prepare("SELECT attempted_at, status FROM bem_trades_sync_runs ORDER BY id DESC LIMIT 1").first(),
    sync: syncBemTrades, maxAgeMinutes: BEM_TRADES_REFRESH_MINUTES,
  });
}

// Mirrors bem.js's bemFreshness convention: a transient collection error never flips a
// response that still has real stored data to "error" — it degrades to "stale" (last
// verified data, delayed refresh). "error" is reserved for having nothing to show at all.
function bemTradesFreshness(latestRun, latestSuccessRun, hasData) {
  const anchor = latestSuccessRun?.attempted_at || null;
  const ageMinutes = anchor ? Math.max(0, Math.round((Date.now() - Date.parse(anchor)) / 60000)) : null;
  const status = !hasData
    ? (latestRun?.status === "error" ? "error" : "pending")
    : (latestRun?.status === "error" || ageMinutes === null || ageMinutes > BEM_TRADES_HEALTH_MINUTES ? "stale" : "healthy");
  return { status, age_minutes: ageMinutes, checked_at: anchor, last_run: latestRun || null };
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

export async function bemTradesOverview(env) {
  await ensureBemTradeSchema(env);
  await ensureBemTradesFresh(env);
  const [windowResult, totalRow, latestRun, latestSuccessRun] = await Promise.all([
    env.DB.prepare(`SELECT id, tx_hash, block_number, block_timestamp, kind, volume_usd, price_usd, tx_from_address FROM bem_trades ORDER BY block_timestamp DESC, id DESC LIMIT ${BEM_TRADES_WINDOW_CAP}`).all(),
    env.DB.prepare("SELECT COUNT(*) AS total FROM bem_trades").first(),
    env.DB.prepare("SELECT attempted_at, status, fetched_count, new_trade_count, error FROM bem_trades_sync_runs ORDER BY id DESC LIMIT 1").first(),
    env.DB.prepare("SELECT attempted_at, status FROM bem_trades_sync_runs WHERE status IN ('updated','no_change') ORDER BY id DESC LIMIT 1").first(),
  ]);
  const rows = windowResult.results || [];
  const freshness = bemTradesFreshness(latestRun, latestSuccessRun, rows.length > 0);
  const totalStoredCount = Number(totalRow?.total || 0);
  const boundary = "Third-party aggregated DEX trade data for one specific BEM/USDT pool on PancakeSwap (BSC), sourced from GeckoTerminal's public trades feed. This is not a complete record of all BEM transfers across the chain, not official TapeOut protocol data, and not a trading signal or recommendation. Wallet addresses are public on-chain data and are never attributed to a real-world identity.";
  if (!rows.length) {
    return {
      status: freshness.status, source: { url: BEM_GECKO_TRADES_URL, pair_address: BEM_PRICE_PAIR_ADDRESS.toLowerCase(), provider: "GeckoTerminal (public trades feed)", freshness },
      window: { earliest_block_timestamp: null, latest_block_timestamp: null, trade_count: 0, total_stored_count: totalStoredCount, capped: false },
      threshold: null, large_trades: [], flow: { buy_count: 0, sell_count: 0, buy_volume_usd: 0, sell_volume_usd: 0, net_flow_usd: 0 },
      methodology: "No trade has been observed yet for this pool.", boundary,
    };
  }
  const volumesAscending = rows.map(row => row.volume_usd).filter(value => Number.isFinite(value)).sort((a, b) => a - b);
  const percentileValue = percentile(volumesAscending, BEM_LARGE_TRADE_PERCENTILE);
  const thresholdUsd = Math.max(percentileValue ?? 0, BEM_LARGE_TRADE_FLOOR_USD);
  const largeTrades = rows.filter(row => Number.isFinite(row.volume_usd) && row.volume_usd >= thresholdUsd).slice(0, LARGE_TRADES_LIMIT).map(row => ({
    tx_hash: row.tx_hash, block_timestamp: row.block_timestamp, kind: row.kind, volume_usd: row.volume_usd, price_usd: row.price_usd,
    from_address: truncateAddress(row.tx_from_address), bscscan_url: `https://bscscan.com/tx/${row.tx_hash}`,
  }));
  const buys = rows.filter(row => row.kind === "buy"), sells = rows.filter(row => row.kind === "sell");
  const sum = list => list.reduce((total, row) => total + (Number.isFinite(row.volume_usd) ? row.volume_usd : 0), 0);
  const buyVolumeUsd = sum(buys), sellVolumeUsd = sum(sells);
  return {
    status: freshness.status,
    source: { url: BEM_GECKO_TRADES_URL, pair_address: BEM_PRICE_PAIR_ADDRESS.toLowerCase(), provider: "GeckoTerminal (public trades feed)", freshness },
    window: {
      earliest_block_timestamp: rows.at(-1).block_timestamp, latest_block_timestamp: rows[0].block_timestamp,
      trade_count: rows.length, total_stored_count: totalStoredCount, capped: totalStoredCount > rows.length,
    },
    threshold: {
      usd: Math.round(thresholdUsd * 100) / 100, percentile: BEM_LARGE_TRADE_PERCENTILE, floor_usd: BEM_LARGE_TRADE_FLOOR_USD,
      method: `The greater of the ${BEM_LARGE_TRADE_PERCENTILE}th percentile trade size and a $${BEM_LARGE_TRADE_FLOOR_USD} floor, computed over the ${rows.length} most recently stored trades for this pool. The floor exists so a quiet window with only small trades never has its biggest trade relabeled "large".`,
    },
    large_trades: largeTrades,
    flow: {
      buy_count: buys.length, sell_count: sells.length,
      buy_volume_usd: Math.round(buyVolumeUsd * 100) / 100, sell_volume_usd: Math.round(sellVolumeUsd * 100) / 100,
      net_flow_usd: Math.round((buyVolumeUsd - sellVolumeUsd) * 100) / 100,
    },
    methodology: `Large trades are flagged, not predicted: any trade at or above the computed threshold within the stored window above. "Buy" means USDT swapped for BEM; "sell" means BEM swapped for USDT, per GeckoTerminal's own trade classification.`,
    boundary,
  };
}
