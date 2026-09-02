import { OFFICIAL_THREE_PROJECTS, OFFICIAL_PROCESSOR_URL, OFFICIAL_TRANSISTOR_CANDLE_ASSETS } from "./constants.js";
import { toBigInt, fetchJsonWithTimeout, sha256 } from "./util.js";
import { ensureScheduledDomainFresh } from "./freshness.js";

// Address aggregation changes materially more slowly than BEM price. It refreshes independently
// every 30 minutes, remains readable from the last successful snapshot on failure, and is marked
// stale only after more than two expected windows have elapsed.
const OFFICIAL_CPU_STATS_URL = "https://tapeout.net/cpu-stats.json";
const OFFICIAL_MARKET_SNAPSHOT_URL = "https://tapeout.net/market.json";
export const OFFICIAL_ASSET_REFRESH_MINUTES = 30;
export const OFFICIAL_ASSET_HEALTH_MINUTES = 70;

// NAND/LATCH price candles are derived only from verified public third-party trade records.
// They never inherit the official status of the three underlying processors.
const TRANSISTOR_CANDLE_PROVIDER = "Firsto TapeOut public trade aggregation";
const TRANSISTOR_CANDLE_SOURCE_BASE = "https://api-tapeout.firsto.ai";
const TRANSISTOR_CANDLE_REFRESH_MINUTES = 5;
const TRANSISTOR_CANDLE_HEALTH_MINUTES = 15;
const TRANSISTOR_CANDLE_RAW_RETENTION_DAYS = 180;
const transistorCandleSourceUrl = asset => `${TRANSISTOR_CANDLE_SOURCE_BASE}/v1/market/${asset.transistor_address}/${asset.token_id}/overview?limit=100`;

let officialAssetSchemaReady, officialAssetBootstrapPromise, transistorCandleSchemaReady, transistorCandleBootstrapPromise;

export async function ensureOfficialAssetSchema(env) {
  if (officialAssetSchemaReady) return officialAssetSchemaReady;
  // CREATE TABLE is a write. When D1 refuses writes (daily limit), the schema step
  // fails — that must degrade reads, not kill them: the promise is cleared so a later
  // request retries, and readers fall back to the legacy tables meanwhile.
  officialAssetSchemaReady = env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS official_asset_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT, observed_at TEXT NOT NULL, cpu_generated_at TEXT, market_generated_at TEXT,
      source_block INTEGER, source_hash TEXT NOT NULL UNIQUE, raw_meta_json TEXT NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS official_asset_project_rows (
      snapshot_id INTEGER NOT NULL, project_key TEXT NOT NULL, project_name TEXT NOT NULL, processor_address TEXT NOT NULL,
      transistor_address TEXT NOT NULL, source_block INTEGER, holder_count INTEGER, minter_count INTEGER, cumulative_minted TEXT NOT NULL,
      open_bid_count INTEGER NOT NULL, PRIMARY KEY(snapshot_id, project_key)
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS official_asset_minter_rows (
      snapshot_id INTEGER NOT NULL, project_key TEXT NOT NULL, address TEXT NOT NULL, cumulative_minted TEXT NOT NULL,
      PRIMARY KEY(snapshot_id, project_key, address)
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS official_asset_open_bid_rows (
      snapshot_id INTEGER NOT NULL, project_key TEXT NOT NULL, order_id TEXT NOT NULL, buyer_address TEXT NOT NULL,
      token_id INTEGER NOT NULL, price_raw TEXT NOT NULL, remaining_raw TEXT NOT NULL,
      PRIMARY KEY(snapshot_id, project_key, order_id)
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS official_asset_sync_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, attempted_at TEXT NOT NULL, status TEXT NOT NULL, cpu_generated_at TEXT,
      market_generated_at TEXT, source_block INTEGER, project_count INTEGER, minter_address_count INTEGER, open_bid_count INTEGER, error TEXT
    )`),
    // Current-state tables, written as deltas. The per-snapshot row tables above
    // rewrote every minter (~1,000) and every open bid (~350) each time the source
    // hash moved — 49 times in one day, 65k rows, most of D1's free-tier daily write
    // budget — and took the site down at the limit. They are kept as history and no
    // longer written to; these hold the same information at a few dozen writes a day.
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS official_asset_minters_current (
      project_key TEXT NOT NULL, address TEXT NOT NULL, cumulative_minted TEXT NOT NULL, snapshot_id INTEGER NOT NULL,
      prev_cumulative_minted TEXT, prev_snapshot_id INTEGER, PRIMARY KEY(project_key, address)
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS official_asset_open_bids_current (
      project_key TEXT NOT NULL, order_id TEXT NOT NULL, buyer_address TEXT NOT NULL, token_id INTEGER NOT NULL,
      price_raw TEXT NOT NULL, remaining_raw TEXT NOT NULL, snapshot_id INTEGER NOT NULL, PRIMARY KEY(project_key, order_id)
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS official_asset_snapshots_observed_idx ON official_asset_snapshots(observed_at DESC)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS official_asset_minter_rows_snapshot_idx ON official_asset_minter_rows(snapshot_id, project_key)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS official_asset_open_bid_rows_snapshot_idx ON official_asset_open_bid_rows(snapshot_id, project_key)"),
  ]).catch(error => { officialAssetSchemaReady = null; console.warn(`official asset schema not applied: ${String(error?.message || error).slice(0, 160)}`); return null; });
  return officialAssetSchemaReady;
}

export function officialProjectFromContract(address) {
  const target = String(address || "").toLowerCase();
  return Object.values(OFFICIAL_THREE_PROJECTS).find(project => project.transistor_address === target) || null;
}

export function officialAssetNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export async function fetchOfficialThreeAssets() {
  const [cpuPayload, marketPayload] = await Promise.all([
    fetchJsonWithTimeout(OFFICIAL_CPU_STATS_URL, { cf: { cacheTtl: 0, cacheEverything: false } }, 10000),
    fetchJsonWithTimeout(OFFICIAL_MARKET_SNAPSHOT_URL, { cf: { cacheTtl: 0, cacheEverything: false } }, 10000),
  ]);
  if (!cpuPayload?.cpus || typeof cpuPayload.cpus !== "object") throw new Error("official cpu-stats payload lacks cpus");
  if (!Array.isArray(marketPayload?.openBids)) throw new Error("official market payload lacks openBids");
  const cpuRows = Object.values(cpuPayload.cpus);
  const projects = [];
  for (const project of Object.values(OFFICIAL_THREE_PROJECTS)) {
    const cpu = cpuRows.find(row => String(row?.address || "").toLowerCase() === project.processor_address && String(row?.transistors || "").toLowerCase() === project.transistor_address);
    if (!cpu) throw new Error(`official cpu-stats is missing ${project.name}`);
    const minters = (Array.isArray(cpu.minters) ? cpu.minters : []).map(row => ({ address: String(row?.addr || "").toLowerCase(), cumulative_minted: String(row?.amount ?? "") })).filter(row => /^0x[a-f0-9]{40}$/.test(row.address) && /^\d+$/.test(row.cumulative_minted));
    const openBids = marketPayload.openBids.filter(row => String(row?.transistors || "").toLowerCase() === project.transistor_address).map(row => ({ order_id: String(row?.id ?? ""), buyer_address: String(row?.buyer || "").toLowerCase(), token_id: officialAssetNumber(row?.tokenId), price_raw: String(row?.price ?? ""), remaining_raw: String(row?.remaining ?? "") })).filter(row => row.order_id && /^0x[a-f0-9]{40}$/.test(row.buyer_address) && Number.isInteger(row.token_id) && /^\d+$/.test(row.price_raw) && /^\d+$/.test(row.remaining_raw));
    const cumulativeMinted = minters.reduce((total, row) => total + toBigInt(row.cumulative_minted), 0n).toString();
    const holderCount = officialAssetNumber(cpu.holderCount), minterCount = officialAssetNumber(cpu.minterCount);
    if (holderCount === null || minterCount === null) throw new Error(`official cpu-stats has invalid aggregate counts for ${project.name}`);
    projects.push({ ...project, source_block: officialAssetNumber(cpu.lastBlock), holder_count: holderCount, minter_count: minterCount, cumulative_minted: cumulativeMinted, minters, open_bids: openBids });
  }
  const sourceBlock = Math.max(Number(marketPayload.lastBlock || 0), ...projects.map(project => Number(project.source_block || 0)));
  return { cpu_generated_at: typeof cpuPayload.generatedAt === "string" ? cpuPayload.generatedAt : null, market_generated_at: typeof marketPayload.generatedAt === "string" ? marketPayload.generatedAt : null, source_block: Number.isFinite(sourceBlock) && sourceBlock > 0 ? sourceBlock : null, projects, raw_meta: { cpu_stats_url: OFFICIAL_CPU_STATS_URL, market_url: OFFICIAL_MARKET_SNAPSHOT_URL, cpu_generated_at: cpuPayload.generatedAt || null, market_generated_at: marketPayload.generatedAt || null, source_block: sourceBlock || null } };
}

export async function recordOfficialAssetRun(env, row) {
  await env.DB.prepare("INSERT INTO official_asset_sync_runs (attempted_at, status, cpu_generated_at, market_generated_at, source_block, project_count, minter_address_count, open_bid_count, error) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(row.attempted_at, row.status, row.cpu_generated_at || null, row.market_generated_at || null, row.source_block || null, row.project_count ?? null, row.minter_address_count ?? null, row.open_bid_count ?? null, row.error ? String(row.error).slice(0, 500) : null).run();
}

export async function syncOfficialThreeAssets(env) {
  await ensureOfficialAssetSchema(env);
  const attemptedAt = new Date().toISOString();
  try {
    const source = await fetchOfficialThreeAssets();
    const fingerprint = source.projects.map(project => ({ key: project.key, holder_count: project.holder_count, minter_count: project.minter_count, cumulative_minted: project.cumulative_minted, minters: project.minters, open_bids: project.open_bids }));
    const sourceHash = await sha256(JSON.stringify(fingerprint));
    const latest = await env.DB.prepare("SELECT id, source_hash, observed_at FROM official_asset_snapshots ORDER BY id DESC LIMIT 1").first();
    const minterAddressCount = new Set(source.projects.flatMap(project => project.minters.map(row => row.address))).size;
    const openBidCount = source.projects.reduce((total, project) => total + project.open_bids.length, 0);
    if (latest?.source_hash === sourceHash) {
      await recordOfficialAssetRun(env, { attempted_at: attemptedAt, status: "no_change", ...source, project_count: source.projects.length, minter_address_count: minterAddressCount, open_bid_count: openBidCount });
      return { status: "no_change", observed_at: latest.observed_at };
    }
    const inserted = await env.DB.prepare("INSERT OR IGNORE INTO official_asset_snapshots (observed_at, cpu_generated_at, market_generated_at, source_block, source_hash, raw_meta_json) VALUES (?, ?, ?, ?, ?, ?)").bind(attemptedAt, source.cpu_generated_at, source.market_generated_at, source.source_block, sourceHash, JSON.stringify(source.raw_meta)).run();
    if (!Number(inserted.meta?.changes || 0)) {
      const concurrent = await env.DB.prepare("SELECT observed_at FROM official_asset_snapshots WHERE source_hash = ? LIMIT 1").bind(sourceHash).first();
      await recordOfficialAssetRun(env, { attempted_at: attemptedAt, status: "no_change", ...source, project_count: source.projects.length, minter_address_count: minterAddressCount, open_bid_count: openBidCount });
      return { status: "no_change", observed_at: concurrent?.observed_at || attemptedAt };
    }
    const snapshotId = inserted.meta.last_row_id;
    const statements = [];
    for (const project of source.projects) {
      statements.push(env.DB.prepare("INSERT INTO official_asset_project_rows (snapshot_id, project_key, project_name, processor_address, transistor_address, source_block, holder_count, minter_count, cumulative_minted, open_bid_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(snapshotId, project.key, project.name, project.processor_address, project.transistor_address, project.source_block, project.holder_count, project.minter_count, project.cumulative_minted, project.open_bids.length));
    }
    // Minters and bids: write only what changed against the current-state tables.
    const [currentMinters, currentBids] = await Promise.all([
      env.DB.prepare("SELECT project_key, address, cumulative_minted FROM official_asset_minters_current").all(),
      env.DB.prepare("SELECT project_key, order_id, price_raw, remaining_raw FROM official_asset_open_bids_current").all(),
    ]);
    const minterNow = new Map((currentMinters.results || []).map(r => [`${r.project_key}|${r.address}`, r]));
    const bidNow = new Map((currentBids.results || []).map(r => [`${r.project_key}|${r.order_id}`, r]));
    const seenBids = new Set();
    for (const project of source.projects) {
      for (const minter of project.minters) {
        const key = `${project.key}|${minter.address}`, prev = minterNow.get(key);
        if (prev && String(prev.cumulative_minted) === String(minter.cumulative_minted)) continue;
        statements.push(env.DB.prepare(`INSERT INTO official_asset_minters_current (project_key, address, cumulative_minted, snapshot_id, prev_cumulative_minted, prev_snapshot_id) VALUES (?, ?, ?, ?, NULL, NULL)
          ON CONFLICT(project_key, address) DO UPDATE SET prev_cumulative_minted=official_asset_minters_current.cumulative_minted, prev_snapshot_id=official_asset_minters_current.snapshot_id, cumulative_minted=excluded.cumulative_minted, snapshot_id=excluded.snapshot_id`)
          .bind(project.key, minter.address, minter.cumulative_minted, snapshotId));
      }
      for (const bid of project.open_bids) {
        const key = `${project.key}|${bid.order_id}`; seenBids.add(key);
        const prev = bidNow.get(key);
        if (prev && String(prev.remaining_raw) === String(bid.remaining_raw) && String(prev.price_raw) === String(bid.price_raw)) continue;
        statements.push(env.DB.prepare(`INSERT INTO official_asset_open_bids_current (project_key, order_id, buyer_address, token_id, price_raw, remaining_raw, snapshot_id) VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(project_key, order_id) DO UPDATE SET buyer_address=excluded.buyer_address, token_id=excluded.token_id, price_raw=excluded.price_raw, remaining_raw=excluded.remaining_raw, snapshot_id=excluded.snapshot_id`)
          .bind(project.key, bid.order_id, bid.buyer_address, bid.token_id, bid.price_raw, bid.remaining_raw, snapshotId));
      }
    }
    for (const key of bidNow.keys()) {
      if (seenBids.has(key)) continue;
      const [projectKey, orderId] = key.split("|");
      statements.push(env.DB.prepare("DELETE FROM official_asset_open_bids_current WHERE project_key = ? AND order_id = ?").bind(projectKey, orderId));
    }
    for (let index = 0; index < statements.length; index += 100) await env.DB.batch(statements.slice(index, index + 100));
    await recordOfficialAssetRun(env, { attempted_at: attemptedAt, status: "updated", ...source, project_count: source.projects.length, minter_address_count: minterAddressCount, open_bid_count: openBidCount });
    return { status: "updated", observed_at: attemptedAt };
  } catch (error) {
    await recordOfficialAssetRun(env, { attempted_at: attemptedAt, status: "error", error: error?.message || String(error) });
    return { status: "error", error: error?.message || String(error) };
  }
}

export function officialAssetFreshness(snapshot, run) {
  const freshnessAt = run && ["updated", "no_change"].includes(run.status) ? run.attempted_at : snapshot?.observed_at || null;
  const ageMinutes = freshnessAt ? Math.max(0, Math.round((Date.now() - Date.parse(freshnessAt)) / 60000)) : null;
  const status = !snapshot ? (run?.status === "error" ? "error" : "pending") : (run?.status === "error" || ageMinutes === null || ageMinutes > OFFICIAL_ASSET_HEALTH_MINUTES ? "stale" : "healthy");
  return { status, age_minutes: ageMinutes, checked_at: freshnessAt, snapshot_observed_at: snapshot?.observed_at || null };
}

export async function ensureOfficialAssetBootstrap(env) {
  await ensureOfficialAssetSchema(env);
  const existing = await env.DB.prepare("SELECT id FROM official_asset_snapshots ORDER BY id DESC LIMIT 1").first();
  if (existing) return existing;
  if (!officialAssetBootstrapPromise) officialAssetBootstrapPromise = syncOfficialThreeAssets(env).finally(() => { officialAssetBootstrapPromise = null; });
  await officialAssetBootstrapPromise;
  return env.DB.prepare("SELECT id FROM official_asset_snapshots ORDER BY id DESC LIMIT 1").first();
}

export async function ensureOfficialAssetsFresh(env) {
  return ensureScheduledDomainFresh({ key: "official_three_assets", env, prepare: () => ensureOfficialAssetSchema(env), latestRun: () => env.DB.prepare("SELECT attempted_at, status FROM official_asset_sync_runs ORDER BY id DESC LIMIT 1").first(), sync: syncOfficialThreeAssets, maxAgeMinutes: OFFICIAL_ASSET_REFRESH_MINUTES });
}

export async function officialAssetsHealth(env) {
  await ensureOfficialAssetSchema(env);
  // ensureOfficialAssetsFresh only needs to block a request when it actually triggers a
  // background sync (rare); in the common healthy case it is one more read against the
  // same tables below, so it runs alongside them instead of gating them sequentially.
  const [, snapshot, run] = await Promise.all([
    ensureOfficialAssetsFresh(env),
    env.DB.prepare("SELECT id, observed_at, cpu_generated_at, market_generated_at, source_block FROM official_asset_snapshots ORDER BY id DESC LIMIT 1").first(),
    env.DB.prepare("SELECT attempted_at, status, cpu_generated_at, market_generated_at, source_block, project_count, minter_address_count, open_bid_count, error FROM official_asset_sync_runs ORDER BY id DESC LIMIT 1").first(),
  ]);
  return { ...officialAssetFreshness(snapshot, run), source_type: "official_public_snapshots", sources: [OFFICIAL_CPU_STATS_URL, OFFICIAL_MARKET_SNAPSHOT_URL], scope: "Only TapeOut, Behemoth and Genesis CPU listed in the official public Processor configuration. CPU stats provide holder aggregates and cumulative minter addresses; market stats provide current public bids. Neither source is a full current per-address holder-balance census.", source_block: snapshot?.source_block || null, cpu_generated_at: snapshot?.cpu_generated_at || null, market_generated_at: snapshot?.market_generated_at || null, last_run: run || null, freshness_policy: "Checked independently every 30 minutes. The last successful snapshot remains available after source errors and becomes stale after 70 minutes; no missing source is represented as zero." };
}

export function officialProjectRowsByKey(rows) { return new Map(rows.map(row => [row.project_key, row])); }

export async function officialAssetOverview(env) {
  await ensureOfficialAssetSchema(env);
  // The common case already has a snapshot, so the existence-checking bootstrap query is
  // skipped and only run as a fallback on a genuine cold start (no snapshot row at all yet).
  let [snapshot, health] = await Promise.all([env.DB.prepare("SELECT * FROM official_asset_snapshots ORDER BY id DESC LIMIT 1").first(), officialAssetsHealth(env).catch(error => ({ status: "error", error: String(error?.message || error).slice(0, 200) }))]);
  if (!snapshot) {
    await ensureOfficialAssetBootstrap(env);
    [snapshot, health] = await Promise.all([env.DB.prepare("SELECT * FROM official_asset_snapshots ORDER BY id DESC LIMIT 1").first(), officialAssetsHealth(env).catch(error => ({ status: "error", error: String(error?.message || error).slice(0, 200) }))]);
  }
  const base = { status: health.status, source: { type: "official_public_snapshots", cpu_stats: OFFICIAL_CPU_STATS_URL, market: OFFICIAL_MARKET_SNAPSHOT_URL, freshness: health }, scope: health.scope, balance_boundary: "No public source used here provides a complete current address-by-address NAND/LATCH balance table. Cumulative minter addresses and open-bid addresses are separate observations and are never called current holders." };
  if (!snapshot) return { ...base, observed_at: null, comparison_snapshot_observed_at: null, projects: [] };
  // The prior snapshot's rows are fetched via a correlated subquery (rather than a separate
  // round trip that waits on the prior-snapshot-id lookup) so all three reads run concurrently.
  const [currentResult, prior, priorRowsResult] = await Promise.all([
    env.DB.prepare("SELECT project_key, project_name, processor_address, transistor_address, source_block, holder_count, minter_count, cumulative_minted, open_bid_count FROM official_asset_project_rows WHERE snapshot_id = ? ORDER BY project_key").bind(snapshot.id).all(),
    env.DB.prepare("SELECT id, observed_at FROM official_asset_snapshots WHERE id < ? ORDER BY id DESC LIMIT 1").bind(snapshot.id).first(),
    env.DB.prepare("SELECT project_key, holder_count, minter_count, cumulative_minted, open_bid_count FROM official_asset_project_rows WHERE snapshot_id = (SELECT id FROM official_asset_snapshots WHERE id < ? ORDER BY id DESC LIMIT 1)").bind(snapshot.id).all(),
  ]);
  const priorByKey = officialProjectRowsByKey(priorRowsResult.results);
  const projects = currentResult.results.map(row => {
    const previous = priorByKey.get(row.project_key);
    return { ...row, cumulative_minted: String(row.cumulative_minted), official_processor_url: OFFICIAL_PROCESSOR_URL(row.processor_address), bscscan_token_url: `https://bscscan.com/token/${row.transistor_address}`, change_from_previous_snapshot: previous ? { holder_count: Number(row.holder_count || 0) - Number(previous.holder_count || 0), minter_count: Number(row.minter_count || 0) - Number(previous.minter_count || 0), cumulative_minted: (toBigInt(row.cumulative_minted) - toBigInt(previous.cumulative_minted)).toString(), open_bid_count: Number(row.open_bid_count || 0) - Number(previous.open_bid_count || 0) } : null };
  });
  return { ...base, observed_at: snapshot.observed_at, comparison_snapshot_observed_at: prior?.observed_at || null, projects };
}

export function officialAddressGroup(rows, kind) {
  const groups = new Map();
  for (const row of rows) {
    const address = kind === "mints" ? row.address : row.buyer_address;
    const current = groups.get(address) || { address, project_breakdown: {}, cumulative_minted: 0n, open_bid_count: 0, nand_open_bid_remaining: 0n, latch_open_bid_remaining: 0n };
    const bucket = current.project_breakdown[row.project_key] || (current.project_breakdown[row.project_key] = kind === "mints" ? { cumulative_minted: "0" } : { open_bid_count: 0, nand_remaining: "0", latch_remaining: "0" });
    if (kind === "mints") { const amount = toBigInt(row.cumulative_minted); current.cumulative_minted += amount; bucket.cumulative_minted = (toBigInt(bucket.cumulative_minted) + amount).toString(); }
    else { const amount = toBigInt(row.remaining_raw); current.open_bid_count += 1; bucket.open_bid_count += 1; if (Number(row.token_id) === 0) { current.nand_open_bid_remaining += amount; bucket.nand_remaining = (toBigInt(bucket.nand_remaining) + amount).toString(); } else if (Number(row.token_id) === 1) { current.latch_open_bid_remaining += amount; bucket.latch_remaining = (toBigInt(bucket.latch_remaining) + amount).toString(); } }
    groups.set(address, current);
  }
  return [...groups.values()].map(group => kind === "mints" ? { address: group.address, project_breakdown: group.project_breakdown, cumulative_minted: group.cumulative_minted.toString() } : { address: group.address, project_breakdown: group.project_breakdown, open_bid_count: group.open_bid_count, nand_open_bid_remaining: group.nand_open_bid_remaining.toString(), latch_open_bid_remaining: group.latch_open_bid_remaining.toString() });
}

export async function officialAssetAddresses(env, query) {
  await ensureOfficialAssetSchema(env);
  const project = ["all", ...Object.keys(OFFICIAL_THREE_PROJECTS)].includes(query.get("project")) ? (query.get("project") || "all") : "all";
  const view = ["mints", "open_bids"].includes(query.get("view")) ? query.get("view") : "mints";
  const q = String(query.get("q") || "").trim().toLowerCase();
  const pageSize = Math.min(Math.max(Number(query.get("page_size") || 20), 1), 100), pageRequested = Math.max(Number(query.get("page") || 1), 1);
  // Same cold-start fallback as officialAssetOverview: skip the existence-checking bootstrap
  // query unless there truly is no snapshot yet.
  let [snapshot, health] = await Promise.all([env.DB.prepare("SELECT id, observed_at FROM official_asset_snapshots ORDER BY id DESC LIMIT 1").first(), officialAssetsHealth(env).catch(error => ({ status: "error", error: String(error?.message || error).slice(0, 200) }))]);
  if (!snapshot) {
    await ensureOfficialAssetBootstrap(env);
    [snapshot, health] = await Promise.all([env.DB.prepare("SELECT id, observed_at FROM official_asset_snapshots ORDER BY id DESC LIMIT 1").first(), officialAssetsHealth(env).catch(error => ({ status: "error", error: String(error?.message || error).slice(0, 200) }))]);
  }
  const base = { status: health.status, source: { type: "official_public_snapshots", cpu_stats: OFFICIAL_CPU_STATS_URL, market: OFFICIAL_MARKET_SNAPSHOT_URL, freshness: health }, scope: view === "mints" ? "Cumulative official CPU-stat mint addresses and source units. This is not current ownership or current NAND/LATCH balance." : "Current public market open-bid addresses and remaining order units. This is not current ownership or a completed trade.", filters: { project, view, q, page: pageRequested, page_size: pageSize }, current_balance_available: false };
  if (!snapshot) return { ...base, observed_at: null, comparison_snapshot_observed_at: null, total: 0, page_count: 0, items: [] };
  // Same correlated-subquery collapse as officialAssetOverview: the prior snapshot's rows are
  // fetched without first waiting on a separate prior-snapshot-id round trip.
  // Rows come from the current-state tables (see ensureOfficialAssetSchema). For mints,
  // the change since the previous snapshot is reconstructed per row: a row whose last
  // write is this snapshot moved by (current - previous value); a row last written
  // earlier did not move. Bids are a live order set whose removed orders leave no row
  // behind, so no per-address change is claimed for them.
  const [currentResult, prior] = await Promise.all([
    env.DB.prepare(view === "mints" ? "SELECT project_key, address, cumulative_minted, snapshot_id, prev_cumulative_minted FROM official_asset_minters_current" : "SELECT project_key, buyer_address, token_id, remaining_raw FROM official_asset_open_bids_current").all()
      .catch(() => ({ results: [] })), // table may not exist yet if the schema write was refused
    env.DB.prepare("SELECT id, observed_at FROM official_asset_snapshots WHERE id < ? ORDER BY id DESC LIMIT 1").bind(snapshot.id).first(),
  ]);
  // Until the first delta write lands (the current tables start empty on the deploy
  // that introduced them, and cannot even be created while D1 refuses writes), serve
  // the latest per-snapshot rows read-only.
  let sourceRows = currentResult.results;
  if (!sourceRows.length) {
    const legacy = await env.DB.prepare(view === "mints" ? "SELECT project_key, address, cumulative_minted, snapshot_id, NULL AS prev_cumulative_minted FROM official_asset_minter_rows WHERE snapshot_id = ?" : "SELECT project_key, buyer_address, token_id, remaining_raw FROM official_asset_open_bid_rows WHERE snapshot_id = ?").bind(snapshot.id).all();
    sourceRows = (legacy.results || []).map(row => view === "mints" ? { ...row, snapshot_id: -1 } : row);
  }
  let currentRows = sourceRows.filter(row => project === "all" || row.project_key === project);
  const movedAtLatest = new Map();
  if (view === "mints") for (const row of currentRows) {
    if (Number(row.snapshot_id) !== Number(snapshot.id)) continue;
    const delta = row.prev_cumulative_minted == null ? null : toBigInt(row.cumulative_minted) - toBigInt(row.prev_cumulative_minted);
    const acc = movedAtLatest.get(row.address) ?? { delta: 0n, isNew: false };
    if (delta === null) acc.isNew = true; else acc.delta += delta;
    movedAtLatest.set(row.address, acc);
  }
  let items = officialAddressGroup(currentRows, view);
  items = items.map(item => {
    let change = null;
    if (view === "mints") {
      const moved = movedAtLatest.get(item.address);
      change = !moved ? { cumulative_minted: "0" } : moved.isNew && moved.delta === 0n ? null : { cumulative_minted: moved.delta.toString() };
    }
    return { ...item, bscscan_address_url: `https://bscscan.com/address/${item.address}`, change_from_previous_snapshot: change };
  });
  if (q) items = items.filter(item => `${item.address} ${Object.keys(item.project_breakdown).join(" ")}`.toLowerCase().includes(q));
  items.sort((a, b) => view === "mints" ? (toBigInt(b.cumulative_minted) > toBigInt(a.cumulative_minted) ? 1 : toBigInt(b.cumulative_minted) < toBigInt(a.cumulative_minted) ? -1 : 0) : b.open_bid_count - a.open_bid_count || (toBigInt(b.nand_open_bid_remaining) > toBigInt(a.nand_open_bid_remaining) ? 1 : -1));
  items.forEach((item, index) => item.rank = index + 1);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize)), page = Math.min(pageRequested, pageCount);
  return { ...base, observed_at: snapshot.observed_at, comparison_snapshot_observed_at: prior?.observed_at || null, total: items.length, page, page_count: pageCount, items: items.slice((page - 1) * pageSize, page * pageSize) };
}

export async function ensureTransistorCandleSchema(env) {
  if (transistorCandleSchemaReady) return transistorCandleSchemaReady;
  transistorCandleSchemaReady = env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS transistor_candle_trade_rows (
      source TEXT NOT NULL, trade_id TEXT NOT NULL, project_key TEXT NOT NULL, asset_key TEXT NOT NULL, symbol TEXT NOT NULL,
      transistor_address TEXT NOT NULL, token_id INTEGER NOT NULL, transaction_hash TEXT NOT NULL, log_index INTEGER NOT NULL,
      block_number INTEGER, block_timestamp TEXT NOT NULL, price_wei TEXT NOT NULL, quantity TEXT NOT NULL, total_wei TEXT,
      fee_wei TEXT, observed_at TEXT NOT NULL, raw_meta_json TEXT NOT NULL, PRIMARY KEY(source, trade_id)
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS transistor_candle_trades_asset_time_idx ON transistor_candle_trade_rows(project_key, asset_key, block_timestamp ASC)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS transistor_candle_trades_observed_idx ON transistor_candle_trade_rows(observed_at DESC)"),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS transistor_candle_asset_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, attempted_at TEXT NOT NULL, project_key TEXT NOT NULL, asset_key TEXT NOT NULL,
      status TEXT NOT NULL, fetched_count INTEGER, accepted_count INTEGER, inserted_count INTEGER, source_as_of TEXT, error TEXT
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS transistor_candle_asset_runs_latest_idx ON transistor_candle_asset_runs(project_key, asset_key, id DESC)"),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS transistor_candle_sync_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, attempted_at TEXT NOT NULL, status TEXT NOT NULL, asset_count INTEGER NOT NULL,
      updated_assets INTEGER NOT NULL, no_change_assets INTEGER NOT NULL, failed_assets INTEGER NOT NULL, inserted_count INTEGER NOT NULL, error TEXT
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS transistor_candle_sync_runs_attempted_idx ON transistor_candle_sync_runs(attempted_at DESC)"),
  ]);
  return transistorCandleSchemaReady;
}

export function normalizedTransistorCandleTrade(row, asset, observedAt) {
  const transactionHash = String(row?.transactionHash || "").toLowerCase();
  const tradeId = String(row?.id || "").toLowerCase();
  const idParts = tradeId.split(":");
  const logIndex = Number(idParts.at(-1));
  const timestamp = String(row?.timestamp || "");
  const priceWei = String(row?.priceWei ?? ""), quantity = String(row?.quantity ?? ""), totalWei = String(row?.totalWei ?? ""), feeWei = String(row?.feeWei ?? "");
  const transistors = String(row?.transistors || "").toLowerCase();
  const tokenId = Number(row?.tokenId);
  const timestampMs = Date.parse(timestamp);
  if (!/^0x[a-f0-9]{64}$/.test(transactionHash) || !/^0x[a-f0-9]{64}:\d+$/.test(tradeId) || !Number.isInteger(logIndex) || logIndex < 0) return null;
  if (idParts[0] !== transactionHash || transistors !== asset.transistor_address || tokenId !== asset.token_id) return null;
  if (!Number.isFinite(timestampMs) || !/^\d+$/.test(priceWei) || !/^\d+$/.test(quantity) || !/^\d+$/.test(totalWei) || !/^\d+$/.test(feeWei)) return null;
  if (toBigInt(priceWei) <= 0n || toBigInt(quantity) <= 0n) return null;
  const blockNumber = Number(row?.blockNumber);
  return {
    source: TRANSISTOR_CANDLE_PROVIDER, trade_id: tradeId, project_key: asset.project_key, asset_key: asset.asset_key, symbol: asset.symbol,
    transistor_address: asset.transistor_address, token_id: asset.token_id, transaction_hash: transactionHash, log_index: logIndex,
    block_number: Number.isInteger(blockNumber) && blockNumber >= 0 ? blockNumber : null, block_timestamp: new Date(timestampMs).toISOString(),
    price_wei: priceWei, quantity, total_wei: totalWei, fee_wei: feeWei, observed_at: observedAt,
    raw_meta_json: JSON.stringify({ provider: "firsto", venue: String(row?.venue || ""), order_id: String(row?.orderId || ""), source_id: tradeId }),
  };
}

export async function fetchTransistorCandleTrades(asset, observedAt) {
  const payload = await fetchJsonWithTimeout(transistorCandleSourceUrl(asset), { cf: { cacheTtl: 0, cacheEverything: false } }, 10000);
  if (!Array.isArray(payload?.trades)) throw new Error(`${asset.project_key}/${asset.asset_key} source lacks trades`);
  const accepted = payload.trades.map(row => normalizedTransistorCandleTrade(row, asset, observedAt)).filter(Boolean);
  return { fetched_count: payload.trades.length, accepted, source_as_of: typeof payload?.asOf === "string" ? payload.asOf : null };
}

export async function recordTransistorCandleAssetRun(env, row) {
  await env.DB.prepare("INSERT INTO transistor_candle_asset_runs (attempted_at, project_key, asset_key, status, fetched_count, accepted_count, inserted_count, source_as_of, error) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(
    row.attempted_at, row.project_key, row.asset_key, row.status, row.fetched_count ?? null, row.accepted_count ?? null, row.inserted_count ?? null, row.source_as_of || null, row.error ? String(row.error).slice(0, 500) : null
  ).run();
}

export async function syncTransistorCandleAsset(env, asset, attemptedAt) {
  try {
    const source = await fetchTransistorCandleTrades(asset, attemptedAt);
    const statements = source.accepted.map(row => env.DB.prepare("INSERT OR IGNORE INTO transistor_candle_trade_rows (source, trade_id, project_key, asset_key, symbol, transistor_address, token_id, transaction_hash, log_index, block_number, block_timestamp, price_wei, quantity, total_wei, fee_wei, observed_at, raw_meta_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(
      row.source, row.trade_id, row.project_key, row.asset_key, row.symbol, row.transistor_address, row.token_id, row.transaction_hash, row.log_index, row.block_number, row.block_timestamp, row.price_wei, row.quantity, row.total_wei, row.fee_wei, row.observed_at, row.raw_meta_json
    ));
    let insertedCount = 0;
    for (let index = 0; index < statements.length; index += 80) {
      const results = await env.DB.batch(statements.slice(index, index + 80));
      insertedCount += results.reduce((total, result) => total + Number(result.meta?.changes || 0), 0);
    }
    const status = insertedCount > 0 ? "updated" : "no_change";
    await recordTransistorCandleAssetRun(env, { attempted_at: attemptedAt, project_key: asset.project_key, asset_key: asset.asset_key, status, fetched_count: source.fetched_count, accepted_count: source.accepted.length, inserted_count: insertedCount, source_as_of: source.source_as_of });
    return { asset, status, inserted_count: insertedCount, fetched_count: source.fetched_count, accepted_count: source.accepted.length };
  } catch (error) {
    await recordTransistorCandleAssetRun(env, { attempted_at: attemptedAt, project_key: asset.project_key, asset_key: asset.asset_key, status: "error", error: error?.message || String(error) });
    return { asset, status: "error", inserted_count: 0, error: error?.message || String(error) };
  }
}

export async function syncTransistorCandles(env) {
  await ensureTransistorCandleSchema(env);
  const attemptedAt = new Date().toISOString();
  const outcomes = await Promise.all(OFFICIAL_TRANSISTOR_CANDLE_ASSETS.map(asset => syncTransistorCandleAsset(env, asset, attemptedAt)));
  const updated = outcomes.filter(row => row.status === "updated"), unchanged = outcomes.filter(row => row.status === "no_change"), failed = outcomes.filter(row => row.status === "error");
  const status = failed.length === outcomes.length ? "error" : failed.length ? "partial" : updated.length ? "updated" : "no_change";
  const error = failed.length ? failed.map(row => `${row.asset.project_key}/${row.asset.asset_key}: ${row.error}`).join(" | ") : null;
  await env.DB.prepare("INSERT INTO transistor_candle_sync_runs (attempted_at, status, asset_count, updated_assets, no_change_assets, failed_assets, inserted_count, error) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(attemptedAt, status, outcomes.length, updated.length, unchanged.length, failed.length, updated.reduce((total, row) => total + row.inserted_count, 0), error ? error.slice(0, 1000) : null).run();
  const retentionBefore = new Date(Date.now() - TRANSISTOR_CANDLE_RAW_RETENTION_DAYS * 86400000).toISOString();
  await env.DB.prepare("DELETE FROM transistor_candle_trade_rows WHERE block_timestamp < ?").bind(retentionBefore).run();
  return { status, attempted_at: attemptedAt, outcomes };
}

export async function ensureTransistorCandlesFresh(env) {
  await ensureTransistorCandleSchema(env);
  const latest = await env.DB.prepare("SELECT attempted_at FROM transistor_candle_sync_runs ORDER BY id DESC LIMIT 1").first();
  const age = latest?.attempted_at ? (Date.now() - Date.parse(latest.attempted_at)) / 60000 : Infinity;
  if (age < TRANSISTOR_CANDLE_REFRESH_MINUTES) return;
  if (!transistorCandleBootstrapPromise) transistorCandleBootstrapPromise = syncTransistorCandles(env).finally(() => { transistorCandleBootstrapPromise = null; });
  await transistorCandleBootstrapPromise;
}

function bnbFromWei(value, digits = 8) {
  const raw = toBigInt(value), base = 10n ** 18n, whole = raw / base;
  const fraction = String(raw % base).padStart(18, "0").slice(0, digits).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : String(whole);
}

function transistorCandleConfig(query) {
  const project = Object.keys(OFFICIAL_THREE_PROJECTS).includes(query.get("project")) ? query.get("project") : "behemoth";
  const asset = ["nand", "latch"].includes(query.get("asset")) ? query.get("asset") : "nand";
  const interval = ["5m", "1h", "1d"].includes(query.get("interval")) ? query.get("interval") : "1h";
  const range = ["24h", "7d", "30d"].includes(query.get("range")) ? query.get("range") : "24h";
  const bucketMs = { "5m": 5 * 60000, "1h": 60 * 60000, "1d": 24 * 60 * 60000 }[interval];
  const rangeMs = { "24h": 24 * 60 * 60000, "7d": 7 * 24 * 60 * 60000, "30d": 30 * 24 * 60 * 60000 }[range];
  return { project, asset, interval, range, bucket_ms: bucketMs, range_ms: rangeMs };
}

async function transistorCandleHealth(env, config) {
  const [lastRun, lastSuccess, coverage] = await Promise.all([
    env.DB.prepare("SELECT attempted_at, status, fetched_count, accepted_count, inserted_count, source_as_of, error FROM transistor_candle_asset_runs WHERE project_key = ? AND asset_key = ? ORDER BY id DESC LIMIT 1").bind(config.project, config.asset).first(),
    env.DB.prepare("SELECT attempted_at, status FROM transistor_candle_asset_runs WHERE project_key = ? AND asset_key = ? AND status IN ('updated','no_change') ORDER BY id DESC LIMIT 1").bind(config.project, config.asset).first(),
    env.DB.prepare("SELECT MIN(block_timestamp) AS trade_history_from, MAX(block_timestamp) AS trade_history_to, MIN(observed_at) AS archived_from, MAX(observed_at) AS archived_to, COUNT(*) AS trade_count FROM transistor_candle_trade_rows WHERE project_key = ? AND asset_key = ?").bind(config.project, config.asset).first(),
  ]);
  const checkedAt = lastSuccess?.attempted_at || null, ageMinutes = checkedAt ? Math.max(0, Math.round((Date.now() - Date.parse(checkedAt)) / 60000)) : null;
  const baseStatus = !lastSuccess ? (lastRun?.status === "error" ? "error" : "pending") : ageMinutes > TRANSISTOR_CANDLE_HEALTH_MINUTES ? "stale" : lastRun?.status === "error" ? "degraded" : "healthy";
  return { status: baseStatus, age_minutes: ageMinutes, checked_at: checkedAt, latest_run: lastRun || null, trade_history_from: coverage?.trade_history_from || null, trade_history_to: coverage?.trade_history_to || null, archived_from: coverage?.archived_from || null, archived_to: coverage?.archived_to || null, archived_trade_count: Number(coverage?.trade_count || 0), freshness_policy: `Each of six assets is checked independently every ${TRANSISTOR_CANDLE_REFRESH_MINUTES} minutes. The last successful verified trade archive remains available after errors and is stale after ${TRANSISTOR_CANDLE_HEALTH_MINUTES} minutes; empty time buckets are not backfilled.` };
}

export async function transistorCandlesHealth(env) {
  await ensureTransistorCandleSchema(env);
  const assets = await Promise.all(OFFICIAL_TRANSISTOR_CANDLE_ASSETS.map(async asset => ({
    project: asset.project_key, asset: asset.asset_key, symbol: asset.symbol, ...(await transistorCandleHealth(env, { project: asset.project_key, asset: asset.asset_key })),
  })));
  const statuses = assets.map(item => item.status);
  const status = statuses.every(item => item === "healthy") ? "healthy" : statuses.every(item => item === "pending") ? "pending" : statuses.every(item => item === "error") ? "error" : statuses.some(item => ["error", "stale", "degraded"].includes(item)) ? "degraded" : "partial";
  return { status, tier: "third_party", provider: TRANSISTOR_CANDLE_PROVIDER, cadence: `every ${TRANSISTOR_CANDLE_REFRESH_MINUTES} minutes`, boundary: "Third-party public executed trades only; not an official price feed, complete market history or investment signal.", assets };
}

export async function officialTransistorCandles(env, query) {
  const config = transistorCandleConfig(query);
  await ensureTransistorCandlesFresh(env);
  const health = await transistorCandleHealth(env, config);
  const now = Date.now(), startMs = now - config.range_ms;
  const rows = (await env.DB.prepare("SELECT block_timestamp, price_wei, quantity, total_wei, transaction_hash, log_index FROM transistor_candle_trade_rows WHERE project_key = ? AND asset_key = ? AND block_timestamp >= ? ORDER BY block_timestamp ASC, block_number ASC, log_index ASC").bind(config.project, config.asset, new Date(startMs).toISOString()).all()).results;
  const buckets = new Map();
  for (const row of rows) {
    const timestamp = Date.parse(row.block_timestamp), bucketStart = Math.floor(timestamp / config.bucket_ms) * config.bucket_ms;
    const price = toBigInt(row.price_wei), quantity = toBigInt(row.quantity), total = toBigInt(row.total_wei || "0");
    const current = buckets.get(bucketStart) || { start_ms: bucketStart, open_wei: price, high_wei: price, low_wei: price, close_wei: price, volume_units: 0n, volume_wei: 0n, trade_count: 0 };
    current.high_wei = price > current.high_wei ? price : current.high_wei;
    current.low_wei = price < current.low_wei ? price : current.low_wei;
    current.close_wei = price;
    current.volume_units += quantity;
    current.volume_wei += total > 0n ? total : price * quantity;
    current.trade_count += 1;
    buckets.set(bucketStart, current);
  }
  const candles = [...buckets.values()].sort((a, b) => a.start_ms - b.start_ms).map(row => ({
    start_at: new Date(row.start_ms).toISOString(), end_at: new Date(row.start_ms + config.bucket_ms).toISOString(),
    open_wei: row.open_wei.toString(), high_wei: row.high_wei.toString(), low_wei: row.low_wei.toString(), close_wei: row.close_wei.toString(),
    open_bnb: bnbFromWei(row.open_wei), high_bnb: bnbFromWei(row.high_wei), low_bnb: bnbFromWei(row.low_wei), close_bnb: bnbFromWei(row.close_wei),
    volume_units: row.volume_units.toString(), volume_bnb: bnbFromWei(row.volume_wei), trade_count: row.trade_count, has_trades: true,
  }));
  const assetMeta = OFFICIAL_TRANSISTOR_CANDLE_ASSETS.find(item => item.project_key === config.project && item.asset_key === config.asset);
  return {
    status: health.status, source: { tier: "third_party", provider: TRANSISTOR_CANDLE_PROVIDER, source_url: transistorCandleSourceUrl(assetMeta), market_scope: "Public Firsto TapeOut trade aggregation. It is not an official TapeOut Protocol price feed or a complete all-venue market." },
    scope: "Only confirmed third-party public trade rows whose transistors contract and tokenId exactly match the TapeOut Intelligence official three-project configuration. Listings, offers, estimates and untraded time buckets are excluded.",
    boundary: "Candles aggregate executed third-party public trades in BNB. They are not an official price, valuation, current holder balance, investment recommendation or complete market history. Empty buckets are omitted rather than filled with a prior close.",
    filters: { project: config.project, asset: config.asset, interval: config.interval, range: config.range, timezone: "UTC" },
    asset: { project_name: assetMeta.project_name, symbol: assetMeta.symbol, token_id: assetMeta.token_id, transistor_address: assetMeta.transistor_address, bscscan_token_url: `https://bscscan.com/token/${assetMeta.transistor_address}` },
    health, candles,
  };
}
