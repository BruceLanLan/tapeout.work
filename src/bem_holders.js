import { BSC_CHAIN_ID, BSC_LOGS_RPC_SECRET, BEM_TOKEN_ADDRESS } from "./constants.js";
import { hexToNumber, hexToBigInt, topicAddress, dataWord, toBigInt } from "./util.js";
import { rpc, marketRpcUrl } from "./market.js";
import { fetchGecko } from "./bem_trades.js";
import { BSC_ARCHIVE_RPC_SECRET } from "./constants.js";
const holdersRpcUrl = env => String(env[BSC_ARCHIVE_RPC_SECRET] || "").trim();

// The archive provider stopped answering Cloudflare's egress entirely on 2026-09-05 —
// 90 consecutive timeouts over seven hours, while the same endpoint answered instantly
// from a laptop — and the census froze because even eth_blockNumber went through it.
// An archive node is only needed to reach *history*; once the census is caught up it
// scans near the chain head, which the market provider already serves for the Circuit
// Market feed. So try archive first and fall back to it. A window the fallback refuses
// as an archive request still fails the tick, which is the honest outcome: that gap
// genuinely needs an archive node, and the backfill script is how it gets closed.
//
// Retrying a provider that is simply down, once per window, wastes the tick's budget on
// round-trips whose answer is already known — so a run remembers it. Only unavailability
// counts: a provider that answers "this range needs an archive node" or "range extends
// beyond head" is working fine and may well serve the next, newer window.
const PROVIDER_UNAVAILABLE = /timed out|-32002|HTTP 5\d\d|HTTP 429|network|fetch failed/i;
async function holdersRpc(env, method, params, down = null) {
  const endpoints = [...new Set([holdersRpcUrl(env), marketRpcUrl(env)].filter(Boolean))];
  let lastError = null;
  for (const endpoint of endpoints) {
    if (down?.has(endpoint)) continue;
    try { return await rpc(env, method, params, endpoint); }
    catch (error) {
      lastError = error;
      if (down && PROVIDER_UNAVAILABLE.test(String(error?.message || error))) down.add(endpoint);
    }
  }
  throw lastError || new Error("no RPC endpoint is configured for the holder census");
}

// keccak256("Transfer(address,address,uint256)")
const BEM_TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const BEM_HOLDER_CONFIRMATIONS = 12;
// Launch-day Transfer bursts can exceed a provider's per-request log cap; a
// 1000-block window keeps each eth_getLogs answer small so no single window
// can wedge the checkpoint, while ten windows per run still clear the genesis
// backfill in roughly a day at the five-minute cron cadence.
// bloXroute answered 5,000-block windows from this machine but timed out (-32002)
// or 502ed on them from Cloudflare egress; 2,000 blocks is what it sustains there.
const BEM_HOLDER_LOG_WINDOW = 2000;
// Three windows per tick: the archive node answers a 2,000-block window in ~20s
// from Cloudflare egress, the chain adds ~400 blocks per five-minute tick, and a
// cron invocation should not spend minutes in one domain. The historical backlog
// is filled once from a machine with a faster path (scripts/backfill_bem_holders.mjs).
const BEM_HOLDER_LOG_WINDOWS_PER_RUN = 3;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
// Estimated $BEM token deployment block, derived (2026-08-31) from a measured
// public-RPC anchor: block 116708167 = 2026-08-18T18:57:27Z and an observed
// ~0.45 s/block rate, projected back to 2026-08-15T00:00:00Z — hours before the
// protocol's Day 1 Saturday-night launch window (see PROTOCOL_TIME_BASIS) —
// giving ~115980756, rounded down for margin. DexScreener bounds the deploy at
// or before pair creation 2026-08-21T13:58:28Z. If the estimate is ever too
// late, negative balances appear (surfaced as negative_balance_count below);
// tighten this to the real first-Transfer block once BSC_ARCHIVE_RPC_URL is live.
// Block 116,716,506 is 2026-08-18T20:00Z on BSC (timestamps read from the chain);
// the official halving countdown puts emission start at 2026-08-18T21:15:32Z, and
// bloXroute returned no BEM Transfer in 116.70M–117.00M. Starting a little earlier
// than the first possible mint costs a few empty windows and nothing else.
const BEM_TOKEN_GENESIS_ESTIMATE_BLOCK = 116700000;
// A run can record "ok" every tick while the checkpoint itself stops moving —
// e.g. the cron stops firing, or every window keeps halving to the same range
// without covering new blocks. Once caught up to head the checkpoint should
// advance within roughly three 5-minute ticks; 90 minutes of silence means the
// census has actually stalled, not that this one provider call was slow.
const BEM_HOLDERS_HEALTH_MINUTES = 90;

let bemHoldersSchemaReady;

export async function ensureBemHoldersSchema(env) {
  if (!bemHoldersSchemaReady) {
    bemHoldersSchemaReady = env.DB.batch([
      env.DB.prepare("CREATE TABLE IF NOT EXISTS bem_holder_balances (address TEXT PRIMARY KEY, balance_wei TEXT NOT NULL, updated_at TEXT NOT NULL)"),
      env.DB.prepare("CREATE TABLE IF NOT EXISTS bem_holder_checkpoints (source_key TEXT PRIMARY KEY, block_number INTEGER NOT NULL, updated_at TEXT NOT NULL)"),
      env.DB.prepare("CREATE TABLE IF NOT EXISTS bem_holder_sync_runs (id INTEGER PRIMARY KEY AUTOINCREMENT, attempted_at TEXT NOT NULL, status TEXT NOT NULL, from_block INTEGER, to_block INTEGER, transfer_count INTEGER, error TEXT)"),
      env.DB.prepare("CREATE INDEX IF NOT EXISTS bem_holder_sync_runs_attempted_idx ON bem_holder_sync_runs(attempted_at DESC)"),
      // A third-party holder count (GeckoTerminal's token info) kept as one row: the
      // census is the on-chain answer, but it needs an archive provider and hours of
      // catch-up; this is available immediately and is labelled as what it is.
      env.DB.prepare("CREATE TABLE IF NOT EXISTS bem_holder_third_party (id INTEGER PRIMARY KEY, provider TEXT NOT NULL, holder_count INTEGER NOT NULL, distribution_json TEXT, source_updated_at TEXT, observed_at TEXT NOT NULL, error TEXT)"),
    ]);
  }
  return bemHoldersSchemaReady;
}

// Applies one scanned window's Transfer logs to the running balance table and
// advances the checkpoint in the same D1 batch, so a delta is never committed
// twice for the same block range. If a busy window ever needs more than one
// batch, the checkpoint rides in the final chunk; recovery from a partial
// window is: delete both bem_holder_checkpoints rows, delete all
// bem_holder_balances rows, and let the scan rebuild from genesis.
async function applyTransferWindow(env, logs, windowEnd, observedAt) {
  const deltas = new Map();
  for (const log of logs) {
    const from = topicAddress(log.topics?.[1]), to = topicAddress(log.topics?.[2]);
    const value = hexToBigInt(dataWord(log.data, 0));
    // The zero address is the mint/burn counterparty, never a real holder.
    if (from && from !== ZERO_ADDRESS) deltas.set(from, (deltas.get(from) ?? 0n) - value);
    if (to && to !== ZERO_ADDRESS) deltas.set(to, (deltas.get(to) ?? 0n) + value);
  }
  const addresses = [...deltas.keys()].filter(address => deltas.get(address) !== 0n);
  const balances = new Map();
  for (let index = 0; index < addresses.length; index += 90) {
    const chunk = addresses.slice(index, index + 90);
    const result = await env.DB.prepare(`SELECT address, balance_wei FROM bem_holder_balances WHERE address IN (${chunk.map(() => "?").join(",")})`).bind(...chunk).all();
    for (const row of result.results) balances.set(row.address, toBigInt(row.balance_wei));
  }
  const statements = addresses.map(address => env.DB.prepare("INSERT INTO bem_holder_balances (address, balance_wei, updated_at) VALUES (?, ?, ?) ON CONFLICT(address) DO UPDATE SET balance_wei=excluded.balance_wei, updated_at=excluded.updated_at")
    .bind(address, ((balances.get(address) ?? 0n) + deltas.get(address)).toString(), observedAt));
  statements.push(env.DB.prepare("INSERT INTO bem_holder_checkpoints (source_key, block_number, updated_at) VALUES ('bem_token_transfer', ?, ?) ON CONFLICT(source_key) DO UPDATE SET block_number=excluded.block_number, updated_at=excluded.updated_at").bind(windowEnd, observedAt));
  for (let index = 0; index < statements.length; index += 100) await env.DB.batch(statements.slice(index, index + 100));
  return addresses.length;
}

export async function syncBemHolders(env) {
  await ensureBemHoldersSchema(env);
  if (!holdersRpcUrl(env)) return { synced: false, status: "not_configured", transfers: 0 };
  // One "down provider" memo per run, shared by every RPC call the run makes.
  const downProviders = new Set();
  const latest = hexToNumber(await holdersRpc(env, "eth_blockNumber", [], downProviders));
  const finalized = Math.max(0, latest - BEM_HOLDER_CONFIRMATIONS);
  const checkpoint = await env.DB.prepare("SELECT block_number FROM bem_holder_checkpoints WHERE source_key = 'bem_token_transfer'").first();
  // Unlike market.js, a fresh scan is NOT clamped to recent blocks: a balance
  // census is only correct if every Transfer since token genesis is applied.
  const start = checkpoint ? Number(checkpoint.block_number) + 1 : BEM_TOKEN_GENESIS_ESTIMATE_BLOCK;
  if (start > finalized) return { from_block: start, to_block: finalized, transfers: 0, synced: false };
  const end = Math.min(finalized, start + (BEM_HOLDER_LOG_WINDOW * BEM_HOLDER_LOG_WINDOWS_PER_RUN) - 1);
  const observedAt = new Date().toISOString();
  if (!checkpoint) await env.DB.prepare("INSERT OR IGNORE INTO bem_holder_checkpoints (source_key, block_number, updated_at) VALUES ('bem_token_transfer_from', ?, ?)").bind(start, observedAt).run();
  let transferCount = 0, touchedAddresses = 0;
  let window = BEM_HOLDER_LOG_WINDOW;
  for (let from = start; from <= end;) {
    const to = Math.min(end, from + window - 1);
    let logs;
    try { logs = await holdersRpc(env, "eth_getLogs", [{ address: BEM_TOKEN_ADDRESS, topics: [BEM_TRANSFER_TOPIC], fromBlock: `0x${from.toString(16)}`, toBlock: `0x${to.toString(16)}` }], downProviders); }
    catch (error) {
      // The archive node times out (-32002) or 502s on ranges it finds heavy; halve
      // and retry the same range rather than fail the whole tick.
      if (window > 250 && /timed out|502|-32002/i.test(String(error?.message || error))) { window = Math.floor(window / 2); continue; }
      throw error;
    }
    transferCount += logs.length;
    touchedAddresses += await applyTransferWindow(env, logs, to, observedAt);
    from = to + 1;
  }
  return { from_block: start, to_block: end, transfers: transferCount, touched_addresses: touchedAddresses, synced: true };
}

export async function recordBemHoldersSync(env, { attemptedAt, status, fromBlock = null, toBlock = null, transferCount = null, error = null }) {
  await ensureBemHoldersSchema(env);
  await env.DB.prepare("INSERT INTO bem_holder_sync_runs (attempted_at, status, from_block, to_block, transfer_count, error) VALUES (?, ?, ?, ?, ?, ?)").bind(attemptedAt, status, fromBlock, toBlock, transferCount, error ? String(error).slice(0, 500) : null).run();
}

export async function syncBemHoldersObserved(env) {
  // Do not create a holder-scan audit write on every cron tick until the shared
  // archive-capable log provider (BSC_ARCHIVE_RPC_URL) exists.
  if (!holdersRpcUrl(env)) return { synced: false, status: "not_configured", transfers: 0 };
  const attemptedAt = new Date().toISOString();
  try {
    const result = await syncBemHolders(env);
    await recordBemHoldersSync(env, { attemptedAt, status: result.status || "ok", fromBlock: result.from_block, toBlock: result.to_block, transferCount: result.transfers });
    return result;
  } catch (error) {
    await recordBemHoldersSync(env, { attemptedAt, status: "error", error: error?.message || String(error) });
    return { synced: false, error: error?.message || String(error) };
  }
}

const GECKO_TOKEN_INFO_URL = `https://api.geckoterminal.com/api/v2/networks/bsc/tokens/${BEM_TOKEN_ADDRESS}/info`;
export async function syncBemHolderThirdParty(env) {
  await ensureBemHoldersSchema(env);
  const observedAt = new Date().toISOString();
  try {
    const payload = await fetchGecko(GECKO_TOKEN_INFO_URL);
    const holders = payload?.data?.attributes?.holders;
    const count = Number(holders?.count);
    if (!Number.isInteger(count) || count < 0) throw new Error("token info carried no holder count");
    await env.DB.prepare(`INSERT INTO bem_holder_third_party (id, provider, holder_count, distribution_json, source_updated_at, observed_at, error) VALUES (1, 'GeckoTerminal', ?, ?, ?, ?, NULL)
      ON CONFLICT(id) DO UPDATE SET holder_count=excluded.holder_count, distribution_json=excluded.distribution_json, source_updated_at=excluded.source_updated_at, observed_at=excluded.observed_at, error=NULL`)
      .bind(count, JSON.stringify(holders?.distribution_percentage ?? null), holders?.last_updated ?? null, observedAt).run();
    return { synced: true, holder_count: count };
  } catch (error) {
    // Keep the last good row; only note the failed attempt on it.
    console.warn(`bem holders third-party fetch failed: ${String(error?.message || error).slice(0, 200)}`);
    await env.DB.prepare("UPDATE bem_holder_third_party SET error = ? WHERE id = 1").bind(`${observedAt}: ${String(error?.message || error).slice(0, 200)}`).run().catch(() => {});
    return { synced: false, error: error?.message || String(error) };
  }
}

export async function bemHoldersOverview(env) {
  await ensureBemHoldersSchema(env);
  const [holderRow, negativeRow, checkpoint, startCheckpoint, latestSync, thirdParty] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS holder_count FROM bem_holder_balances WHERE balance_wei != '0'").first(),
    env.DB.prepare("SELECT COUNT(*) AS negative_count FROM bem_holder_balances WHERE balance_wei LIKE '-%'").first(),
    env.DB.prepare("SELECT block_number, updated_at FROM bem_holder_checkpoints WHERE source_key = 'bem_token_transfer'").first(),
    env.DB.prepare("SELECT block_number FROM bem_holder_checkpoints WHERE source_key = 'bem_token_transfer_from'").first(),
    env.DB.prepare("SELECT attempted_at, status, from_block, to_block, transfer_count, error FROM bem_holder_sync_runs ORDER BY id DESC LIMIT 1").first(),
    env.DB.prepare("SELECT provider, holder_count, distribution_json, source_updated_at, observed_at, error FROM bem_holder_third_party WHERE id = 1").first().catch(() => null),
  ]);
  const configured = Boolean(holdersRpcUrl(env));
  const checkpointAgeMinutes = checkpoint ? Math.max(0, Math.round((Date.now() - Date.parse(checkpoint.updated_at)) / 60000)) : null;
  const censusStatus = !configured ? "not_configured"
    : !checkpoint ? "pending"
    : latestSync?.status === "error" ? "error"
    : checkpointAgeMinutes != null && checkpointAgeMinutes > BEM_HOLDERS_HEALTH_MINUTES ? "stale"
    : "ok";
  // Headline status: the census when healthy, else the third-party figure when held.
  const status = censusStatus === "ok" ? "ok" : thirdParty?.holder_count != null ? "third_party" : censusStatus;
  return {
    source: "$BEM token ERC-20 Transfer logs (full balance census)",
    chain_id: BSC_CHAIN_ID,
    token_address: BEM_TOKEN_ADDRESS,
    status,
    census_status: censusStatus,
    // When both figures exist, say how far apart they are rather than making the
    // reader compare two numbers in different blocks of the response.
    reconciliation: checkpoint && thirdParty?.holder_count != null ? {
      census_count: Number(holderRow?.holder_count ?? 0), third_party_count: Number(thirdParty.holder_count),
      difference: Number(holderRow?.holder_count ?? 0) - Number(thirdParty.holder_count),
      note: censusStatus === "ok" ? "census is complete through coverage.through_block; a difference reflects the aggregator's own cut-off and counting rules"
        : censusStatus === "stale" ? "census scan has stalled (no new blocks scanned recently); its count is a lower bound frozen at coverage.updated_at, not caught up to chain head"
        : "census still catching up; its count is a lower bound until census_status is ok",
    } : null,
    third_party: thirdParty ? {
      provider: thirdParty.provider, holder_count: Number(thirdParty.holder_count),
      distribution_percentage: (() => { try { return JSON.parse(thirdParty.distribution_json || "null"); } catch { return null; } })(),
      source_updated_at: thirdParty.source_updated_at, observed_at: thirdParty.observed_at, last_error: thirdParty.error || null,
      boundary: "A third-party aggregator's holder count and top-holder distribution, stored from its public token-info endpoint; not an on-chain census by this site and not reconciled against one until the census catches up.",
    } : null,
    ...(configured ? {} : { note: `Holder counting replays every $BEM Transfer since token genesis, which needs an archive-capable BSC provider set as the ${BSC_ARCHIVE_RPC_SECRET} Worker secret (public non-archive nodes refuse historical eth_getLogs). Until one is configured no Transfer logs are scanned and no count is published — a partial scan would be a wrong number, not a lower bound.` }),
    holder_count: checkpoint ? Number(holderRow?.holder_count ?? 0) : null,
    // Nonzero means the genesis-block estimate started too late and missed early
    // mints; tighten BEM_TOKEN_GENESIS_ESTIMATE_BLOCK and rescan from genesis.
    negative_balance_count: Number(negativeRow?.negative_count ?? 0),
    latest_sync: latestSync || null,
    coverage: checkpoint ? { from_block: startCheckpoint?.block_number ?? null, through_block: checkpoint.block_number, updated_at: checkpoint.updated_at, checkpoint_age_minutes: checkpointAgeMinutes } : null,
    boundary: "Holder count reflects confirmed Transfer logs scanned through coverage.through_block only; while the incremental scan is still catching up to the chain head the count is a lower bound, not a final census. Addresses are public chain data and never identity-attributed.",
  };
}
