import { AIRDROP_ADDRESS, AIRDROP_GET_DROPS_SELECTOR, AIRDROP_OFFICIAL_URL } from "./constants.js";
import { sha256, toBigInt, hexWord, hexAddress } from "./util.js";
import { ensureScheduledDomainFresh } from "./freshness.js";

let airdropSchemaReady;

// Binance official dataseeds first: they tolerate anonymous eth_call far
// better than the aggregator gateways, which throttled all three previous
// providers simultaneously (HTTP 429, observed 2026-08-27) and left the
// Airdrop panel stale for an hour at a time.
export const AIRDROP_RPCS = [
  "https://bsc-dataseed.bnbchain.org",
  "https://bsc-dataseed.binance.org",
  "https://bsc-dataseed1.defibit.io",
  "https://bsc-dataseed1.ninicoin.io",
  "https://bsc.drpc.org",
  "https://bsc-rpc.publicnode.com",
  "https://1rpc.io/bnb",
];

export async function ensureAirdropSchema(env) {
  if (!airdropSchemaReady) airdropSchemaReady = env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS airdrop_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT, observed_at TEXT NOT NULL, source_hash TEXT NOT NULL UNIQUE,
      drop_count INTEGER NOT NULL, active_count INTEGER NOT NULL, cancelled_count INTEGER NOT NULL,
      remaining_total TEXT NOT NULL, claimed_total INTEGER NOT NULL, raw_json TEXT NOT NULL
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS airdrop_snapshots_observed_idx ON airdrop_snapshots(observed_at DESC)"),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS airdrop_sync_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, attempted_at TEXT NOT NULL, status TEXT NOT NULL,
      provider TEXT, drop_count INTEGER, error TEXT
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS airdrop_sync_runs_attempted_idx ON airdrop_sync_runs(attempted_at DESC)"),
  ]);
  return airdropSchemaReady;
}

export function decodeAirdropDrops(payload) {
  const idsOffset = Number(hexWord(payload, 0) / 32n), listOffset = Number(hexWord(payload, 1) / 32n);
  const idsCount = Number(hexWord(payload, idsOffset)), listCount = Number(hexWord(payload, listOffset));
  if (!Number.isSafeInteger(idsCount) || idsCount !== listCount || idsCount > 500) throw new Error("Invalid airdrop getDrops ABI result");
  const rows = [];
  for (let index = 0; index < listCount; index += 1) {
    const base = listOffset + 1 + index * 7;
    rows.push({ id: Number(hexWord(payload, idsOffset + 1 + index)), creator: hexAddress(payload, base), per_claim: hexWord(payload, base + 1).toString(), transistors: hexAddress(payload, base + 2), token_id: Number(hexWord(payload, base + 3)), cancelled: hexWord(payload, base + 4) !== 0n, remaining: hexWord(payload, base + 5).toString(), claimed_count: Number(hexWord(payload, base + 6)) });
  }
  return rows;
}

export async function airdropRpc(data) {
  const errors = [];
  // Rotate the starting provider per hour so successive cron runs spread
  // load instead of always exhausting the same provider's anonymous quota.
  const start = Math.floor(Date.now() / 3_600_000) % AIRDROP_RPCS.length;
  const ordered = [...AIRDROP_RPCS.slice(start), ...AIRDROP_RPCS.slice(0, start)];
  for (const provider of ordered) {
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 6000);
    try {
      const response = await fetch(provider, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: AIRDROP_ADDRESS, data }, "latest"] }), signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (payload.error || !payload.result) throw new Error(payload.error?.message || "Missing RPC result");
      return { provider, result: payload.result };
    } catch (error) { errors.push(`${provider}: ${error?.message || String(error)}`); }
    finally { clearTimeout(timeout); }
  }
  throw new Error(errors.join("; "));
}

export async function syncAirdrops(env) {
  await ensureAirdropSchema(env);
  const attemptedAt = new Date().toISOString();
  try {
    const { provider, result } = await airdropRpc(`${AIRDROP_GET_DROPS_SELECTOR}${"0".repeat(63)}1${"0".repeat(62)}64`);
    const items = decodeAirdropDrops(result), sourceHash = await sha256(JSON.stringify(items));
    const active = items.filter(item => !item.cancelled && toBigInt(item.remaining) > 0n), cancelled = items.filter(item => item.cancelled);
    const remainingTotal = items.reduce((sum, item) => sum + toBigInt(item.remaining), 0n), claimedTotal = items.reduce((sum, item) => sum + Number(item.claimed_count || 0), 0);
    const latest = await env.DB.prepare("SELECT source_hash, observed_at FROM airdrop_snapshots ORDER BY id DESC LIMIT 1").first();
    if (latest?.source_hash !== sourceHash) await env.DB.prepare("INSERT INTO airdrop_snapshots (observed_at, source_hash, drop_count, active_count, cancelled_count, remaining_total, claimed_total, raw_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(attemptedAt, sourceHash, items.length, active.length, cancelled.length, remainingTotal.toString(), claimedTotal, JSON.stringify(items)).run();
    await env.DB.prepare("INSERT INTO airdrop_sync_runs (attempted_at, status, provider, drop_count, error) VALUES (?, ?, ?, ?, NULL)").bind(attemptedAt, latest?.source_hash === sourceHash ? "no_change" : "updated", provider, items.length).run();
    return { status: latest?.source_hash === sourceHash ? "no_change" : "updated", provider, observed_at: latest?.source_hash === sourceHash ? latest.observed_at : attemptedAt, drop_count: items.length, active_count: active.length, cancelled_count: cancelled.length, remaining_total: remainingTotal.toString(), claimed_total: claimedTotal };
  } catch (error) {
    await env.DB.prepare("INSERT INTO airdrop_sync_runs (attempted_at, status, provider, drop_count, error) VALUES (?, 'error', NULL, NULL, ?)").bind(attemptedAt, String(error?.message || error).slice(0, 500)).run();
    return { status: "error", error: error?.message || String(error) };
  }
}

export async function ensureAirdropFresh(env) {
  return ensureScheduledDomainFresh({ key: "airdrop", env, prepare: () => ensureAirdropSchema(env), latestRun: () => env.DB.prepare("SELECT attempted_at, status FROM airdrop_sync_runs ORDER BY id DESC LIMIT 1").first(), sync: syncAirdropsObserved, maxAgeMinutes: 10 });
}

export async function airdropOverview(env) {
  await ensureAirdropSchema(env);
  // ensureAirdropFresh only needs to block when it actually triggers a background sync
  // (rare); otherwise it runs alongside the reads below instead of gating them sequentially.
  const [, snapshot, run, lastSuccess] = await Promise.all([
    ensureAirdropFresh(env),
    env.DB.prepare("SELECT observed_at, drop_count, active_count, cancelled_count, remaining_total, claimed_total, raw_json FROM airdrop_snapshots ORDER BY id DESC LIMIT 1").first(),
    env.DB.prepare("SELECT attempted_at, status, provider, drop_count, error FROM airdrop_sync_runs ORDER BY id DESC LIMIT 1").first(),
    // Freshness has to be anchored on the last run that actually succeeded. Reading it
    // off the last *attempt* would call the data fresh while every attempt for hours
    // had failed, so the old code compensated by forcing stale whenever the latest
    // attempt errored — which mislabelled data that was still well inside its window.
    // With a real last-success anchor, neither compensation is needed: age is the age
    // of data we actually hold, and a failed attempt is reported on its own.
    env.DB.prepare("SELECT attempted_at FROM airdrop_sync_runs WHERE status IN ('updated', 'no_change') ORDER BY id DESC LIMIT 1").first(),
  ]);
  const checkedAgeMinutes = lastSuccess?.attempted_at ? Math.max(0, Math.round((Date.now() - Date.parse(lastSuccess.attempted_at)) / 60000)) : null;
  const dataAgeMinutes = snapshot?.observed_at ? Math.max(0, Math.round((Date.now() - Date.parse(snapshot.observed_at)) / 60000)) : null;
  const status = !snapshot ? (run?.status === "error" ? "error" : "pending") : (checkedAgeMinutes === null || checkedAgeMinutes > 20 ? "stale" : "healthy");
  return { source: "TapeOut public Airdrop contract", contract: AIRDROP_ADDRESS, evidence_url: AIRDROP_OFFICIAL_URL, status, checked_at: lastSuccess?.attempted_at || null, observed_at: snapshot?.observed_at || null, age_minutes: checkedAgeMinutes, data_age_minutes: dataAgeMinutes, last_run: run || null, last_attempt_failed: run?.status === "error", ...(snapshot ? { drop_count: snapshot.drop_count, active_count: snapshot.active_count, cancelled_count: snapshot.cancelled_count, remaining_total: snapshot.remaining_total, claimed_total: snapshot.claimed_total, items: JSON.parse(snapshot.raw_json).slice(0, 20) } : {}) };
}

export async function syncAirdropsObserved(env) { return syncAirdrops(env); }
