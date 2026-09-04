import { fetchJsonWithTimeout, sha256 } from "./util.js";
import { ensureScheduledDomainFresh } from "./freshness.js";

// TapeOut Club is a public community estimator, not an official TapeOut data source.
// It never turns a listed address into an inferred real-world identity, LP, router or
// investor label.
//
// 2026-08-29: TapeOut Club rebuilt its site (Next.js). The old flow — scrape a signed,
// short-lived token out of the homepage HTML, then call data.json with that token —
// no longer works; the page carries no such token anymore. The new data.json needs no
// token at all, but it also dropped the per-circuit/per-holder board rows entirely:
// what used to be up to 600 individual rows is now a fixed top-N (currently ~30)
// wallet-aggregated leaderboard at addr.power, with a different field set (no more
// per-row asset_type/mining_status/circuit_id/first_claim/bstar_cost). The "processors"
// view and the asset_type/status filters are gone with it — see communityProcessorLeaderboard.
const TAPEOUT_CLUB_URL = "https://tapeout.club/";
const TAPEOUT_CLUB_DATA_URL = "https://tapeout.club/data.json";
const TAPEOUT_CLUB_HEALTH_MINUTES = 35;
const TAPEOUT_CLUB_MAX_WALLET_ROWS = 100;

let communityHolderSchemaReady;

export async function ensureCommunityHolderSchema(env) {
  if (!communityHolderSchemaReady) communityHolderSchemaReady = env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS community_processor_board_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT, observed_at TEXT NOT NULL, source_hash TEXT NOT NULL UNIQUE,
      source_generated_at TEXT, source_block INTEGER, source_total_processors INTEGER,
      source_eligible_processors INTEGER, source_mining_processors INTEGER,
      source_verified_weight TEXT, source_unverified_weight TEXT, board_count INTEGER NOT NULL,
      raw_meta_json TEXT NOT NULL
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS community_processor_board_snapshots_observed_idx ON community_processor_board_snapshots(observed_at DESC)"),
    // Frozen: TapeOut Club stopped publishing per-circuit rows on 2026-08-29 (see the
    // note above), so no new rows are ever written here again. Kept only so any
    // historical snapshot already stored stays queryable; never dropped or altered.
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS community_processor_board_rows (
      snapshot_id INTEGER NOT NULL, asset_type TEXT NOT NULL, circuit_id INTEGER NOT NULL,
      holder_address TEXT NOT NULL, mining_status TEXT NOT NULL, first_claim INTEGER NOT NULL,
      estimated_daily_bem REAL, chain_weight REAL, bstar_cost REAL,
      PRIMARY KEY (snapshot_id, asset_type, circuit_id)
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS community_processor_board_rows_snapshot_rank_idx ON community_processor_board_rows(snapshot_id, chain_weight DESC)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS community_processor_board_rows_snapshot_holder_idx ON community_processor_board_rows(snapshot_id, holder_address)"),
    // Replacement: TapeOut Club's own pre-aggregated top-wallet leaderboard (addr.power).
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS community_wallet_board_rows (
      snapshot_id INTEGER NOT NULL, holder_address TEXT NOT NULL, circuit_count INTEGER NOT NULL,
      behemoth_count INTEGER, tapeout_count INTEGER, chain_weight REAL,
      first_creator_seats INTEGER, estimated_daily_bem REAL, kind TEXT,
      PRIMARY KEY (snapshot_id, holder_address)
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS community_wallet_board_rows_snapshot_rank_idx ON community_wallet_board_rows(snapshot_id, chain_weight DESC)"),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS community_processor_board_sync_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, attempted_at TEXT NOT NULL, status TEXT NOT NULL,
      source_generated_at TEXT, source_block INTEGER, board_count INTEGER, address_count INTEGER, error TEXT
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS community_processor_board_sync_runs_attempted_idx ON community_processor_board_sync_runs(attempted_at DESC)"),
  ]);
  return communityHolderSchemaReady;
}

export function communityNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeCommunityBoard(payload) {
  const power = Array.isArray(payload?.addr?.power) ? payload.addr.power : null;
  if (!power || power.length === 0 || power.length > TAPEOUT_CLUB_MAX_WALLET_ROWS) throw new Error("TapeOut Club wallet leaderboard is missing or outside accepted size");
  const rows = power.map(raw => {
    const holder = String(raw?.addr || "").toLowerCase();
    return {
      holder_address: holder,
      circuit_count: Number.isFinite(Number(raw?.n)) ? Number(raw.n) : null,
      behemoth_count: Number.isFinite(Number(raw?.nB)) ? Number(raw.nB) : null,
      tapeout_count: Number.isFinite(Number(raw?.nT)) ? Number(raw.nT) : null,
      chain_weight: communityNumber(raw?.w),
      first_creator_seats: Number.isFinite(Number(raw?.seat)) ? Number(raw.seat) : 0,
      estimated_daily_bem: communityNumber(raw?.daily),
      kind: raw?.kind ? String(raw.kind).trim() || null : null,
    };
  }).filter(row => /^0x[a-f0-9]{40}$/.test(row.holder_address) && Number.isInteger(row.circuit_count) && row.circuit_count >= 0);
  if (rows.length === 0) throw new Error("TapeOut Club wallet leaderboard lacks valid public address rows");
  const meta = payload?.boardMeta || {}, gen = payload?.gen || {};
  return {
    rows,
    meta: {
      source_generated_at: typeof gen.tsText === "string" ? gen.tsText : null,
      source_block: Number.isFinite(Number(meta.block)) ? Number(meta.block) : null,
      source_total_processors: Number.isFinite(Number(meta.total)) ? Number(meta.total) : null,
      source_eligible_processors: Number.isFinite(Number(meta.elig)) ? Number(meta.elig) : null,
      source_mining_processors: Number.isFinite(Number(meta.nMine)) ? Number(meta.nMine) : null,
      source_verified_weight: meta.verTot == null ? null : String(meta.verTot),
      source_unverified_weight: meta.unvTot == null ? null : String(meta.unvTot),
      source_marked_stale: Boolean(gen.stale),
      source_frequency_minutes: Number(gen?.freq?.circuit || 0) || null,
    },
    raw_meta: { gen, boardMeta: meta }
  };
}

export async function fetchTapeoutClubBoard() {
  const payload = await fetchJsonWithTimeout(TAPEOUT_CLUB_DATA_URL, { headers: { accept: "application/json", "user-agent": "TapeOut-Intelligence/1.0 (+public-community-source-observer)" } }, 10000);
  return normalizeCommunityBoard(payload);
}

export async function recordCommunityBoardRun(env, { attemptedAt, status, sourceGeneratedAt = null, sourceBlock = null, boardCount = null, addressCount = null, error = null }) {
  await env.DB.prepare("INSERT INTO community_processor_board_sync_runs (attempted_at, status, source_generated_at, source_block, board_count, address_count, error) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(attemptedAt, status, sourceGeneratedAt, sourceBlock, boardCount, addressCount, error ? String(error).slice(0, 500) : null).run();
}

export async function syncCommunityProcessorBoard(env) {
  await ensureCommunityHolderSchema(env);
  const attemptedAt = new Date().toISOString();
  try {
    const board = await fetchTapeoutClubBoard();
    if (board.meta.source_marked_stale) throw new Error("TapeOut Club source marks its own board stale");
    const sourceHash = await sha256(JSON.stringify({ rows: board.rows, meta: board.meta }));
    const latest = await env.DB.prepare("SELECT id, source_hash, observed_at FROM community_processor_board_snapshots ORDER BY id DESC LIMIT 1").first();
    const addressCount = new Set(board.rows.map(row => row.holder_address)).size;
    if (latest?.source_hash === sourceHash) {
      await recordCommunityBoardRun(env, { attemptedAt, status: "no_change", sourceGeneratedAt: board.meta.source_generated_at, sourceBlock: board.meta.source_block, boardCount: board.rows.length, addressCount });
      return { status: "no_change", observed_at: latest.observed_at, board_count: board.rows.length, address_count: addressCount };
    }
    const result = await env.DB.prepare(`INSERT INTO community_processor_board_snapshots
      (observed_at, source_hash, source_generated_at, source_block, source_total_processors, source_eligible_processors, source_mining_processors, source_verified_weight, source_unverified_weight, board_count, raw_meta_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(attemptedAt, sourceHash, board.meta.source_generated_at, board.meta.source_block, board.meta.source_total_processors, board.meta.source_eligible_processors, board.meta.source_mining_processors, board.meta.source_verified_weight, board.meta.source_unverified_weight, board.rows.length, JSON.stringify(board.raw_meta)).run();
    const snapshotId = result.meta.last_row_id;
    const statements = board.rows.map(row => env.DB.prepare(`INSERT INTO community_wallet_board_rows
      (snapshot_id, holder_address, circuit_count, behemoth_count, tapeout_count, chain_weight, first_creator_seats, estimated_daily_bem, kind)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(snapshotId, row.holder_address, row.circuit_count, row.behemoth_count, row.tapeout_count, row.chain_weight, row.first_creator_seats, row.estimated_daily_bem, row.kind));
    for (let index = 0; index < statements.length; index += 100) await env.DB.batch(statements.slice(index, index + 100));
    await recordCommunityBoardRun(env, { attemptedAt, status: "updated", sourceGeneratedAt: board.meta.source_generated_at, sourceBlock: board.meta.source_block, boardCount: board.rows.length, addressCount });
    return { status: "updated", observed_at: attemptedAt, board_count: board.rows.length, address_count: addressCount };
  } catch (error) {
    await recordCommunityBoardRun(env, { attemptedAt, status: "error", error: error?.message || String(error) });
    return { status: "error", error: error?.message || String(error) };
  }
}

export async function ensureCommunityBoardFresh(env) {
  return ensureScheduledDomainFresh({ key: "community_processor_board", env, prepare: () => ensureCommunityHolderSchema(env), latestRun: () => env.DB.prepare("SELECT attempted_at, status FROM community_processor_board_sync_runs ORDER BY id DESC LIMIT 1").first(), sync: syncCommunityProcessorBoard, maxAgeMinutes: 30 });
}

export function communityFreshness(snapshot, run) {
  const lastSuccessAt = run && ["updated", "no_change"].includes(run.status) ? run.attempted_at : null;
  const freshnessAt = lastSuccessAt || snapshot?.observed_at || null;
  const ageMinutes = freshnessAt ? Math.max(0, Math.round((Date.now() - Date.parse(freshnessAt)) / 60000)) : null;
  // Staleness describes the data, not the last attempt — see the note in bem.js.
  const status = !snapshot ? (run?.status === "error" ? "error" : "pending") : (ageMinutes === null || ageMinutes > TAPEOUT_CLUB_HEALTH_MINUTES ? "stale" : "healthy");
  return { status, age_minutes: ageMinutes, checked_at: lastSuccessAt, snapshot_observed_at: snapshot?.observed_at || null, last_attempt_failed: run?.status === "error" };
}

export async function communityProcessorBoardHealth(env) {
  await ensureCommunityHolderSchema(env);
  // ensureCommunityBoardFresh only needs to block when it actually triggers a background sync
  // (rare); otherwise it runs alongside the reads below instead of gating them sequentially.
  const [, snapshot, run] = await Promise.all([
    ensureCommunityBoardFresh(env),
    env.DB.prepare("SELECT observed_at, source_generated_at, source_block, source_total_processors, source_eligible_processors, source_mining_processors, board_count FROM community_processor_board_snapshots ORDER BY id DESC LIMIT 1").first(),
    env.DB.prepare("SELECT attempted_at, status, source_generated_at, source_block, board_count, address_count, error FROM community_processor_board_sync_runs ORDER BY id DESC LIMIT 1").first(),
  ]);
  return { ...communityFreshness(snapshot, run), source_type: "community_estimate", source: TAPEOUT_CLUB_URL, source_data_route: "/data.json (public, no token required)", source_generated_at: snapshot?.source_generated_at || null, source_block: snapshot?.source_block ?? null, source_total_processors: snapshot?.source_total_processors ?? null, source_eligible_processors: snapshot?.source_eligible_processors ?? null, source_mining_processors: snapshot?.source_mining_processors ?? null, leaderboard_rows: snapshot?.board_count ?? null, last_run: run || null, freshness_policy: "Community source is checked on the platform schedule; last successful snapshot remains available if the source request fails or its response shape changes. It is stale after 35 minutes and never represented as official." };
}

export async function communityProcessorLeaderboard(env, query) {
  await ensureCommunityHolderSchema(env);
  const [snapshot, health] = await Promise.all([env.DB.prepare("SELECT * FROM community_processor_board_snapshots ORDER BY id DESC LIMIT 1").first(), communityProcessorBoardHealth(env)]);
  const pageSize = Math.min(Math.max(Number(query.get("page_size") || 20), 1), 100);
  const pageRequested = Math.max(Number(query.get("page") || 1), 1);
  const q = String(query.get("q") || "").trim().toLowerCase();
  // view/asset_type/status existed only while TapeOut Club published per-circuit rows
  // (retired 2026-08-29, see the note on TAPEOUT_CLUB_MAX_WALLET_ROWS). Requesting them
  // is not an error — they are just no longer meaningful — so callers are told plainly
  // rather than seeing them silently ignored.
  const requestedRetiredParams = ["view", "asset_type", "status"].filter(name => query.get(name) && query.get(name) !== "all");
  const base = { status: health.status, source: { type: "community_estimate", url: TAPEOUT_CLUB_URL, source_data_route: "/data.json (public, no token required)", freshness: health }, scope: "Source-selected public TapeOut Club wallet leaderboard (its own top-ranked wallets only, not a full census). It is not an official TapeOut API, not a complete transistor-holder census, and does not identify real-world owners, LPs, routers or investors.", filters: { q, page: pageRequested, page_size: pageSize }, ...(requestedRetiredParams.length ? { retired_parameters: { names: requestedRetiredParams, reason: "TapeOut Club stopped publishing per-circuit rows on 2026-08-29; only its own pre-aggregated top-wallet leaderboard is available now, so per-processor view/asset_type/status filtering no longer applies." } } : {}) };
  if (!snapshot) return { ...base, observed_at: null, comparison_snapshot_observed_at: null, coverage: null, total: 0, page_count: 0, items: [] };
  const [rowsResult, priorSnapshot] = await Promise.all([
    env.DB.prepare("SELECT holder_address, circuit_count, behemoth_count, tapeout_count, chain_weight, first_creator_seats, estimated_daily_bem, kind FROM community_wallet_board_rows WHERE snapshot_id = ?").bind(snapshot.id).all(),
    env.DB.prepare("SELECT id, observed_at FROM community_processor_board_snapshots WHERE id < ? ORDER BY id DESC LIMIT 1").bind(snapshot.id).first(),
  ]);
  let rows = rowsResult.results;
  let priorRows = [];
  if (priorSnapshot) priorRows = (await env.DB.prepare("SELECT holder_address, circuit_count, behemoth_count, tapeout_count, chain_weight, first_creator_seats, estimated_daily_bem, kind FROM community_wallet_board_rows WHERE snapshot_id = ?").bind(priorSnapshot.id).all()).results;
  const priorByAddress = new Map(priorRows.map(row => [row.holder_address, row]));
  const coverage = { source_reported_total_processors: snapshot.source_total_processors, source_reported_eligible_processors: snapshot.source_eligible_processors, source_reported_mining_processors: snapshot.source_mining_processors, leaderboard_wallet_rows: snapshot.board_count, source_block: snapshot.source_block, source_generated_at: snapshot.source_generated_at, limitation: "TapeOut Club now publishes only its own top-ranked wallet leaderboard (currently around 30 wallets), not every address with activity. Absence from this API is not evidence of zero ownership or zero activity, and ranks below the source's own cutoff are simply not visible anywhere." };
  let items = rows.map(row => {
    const prior = priorByAddress.get(row.holder_address);
    return {
      address: row.holder_address,
      circuit_count: row.circuit_count,
      behemoth_count: row.behemoth_count,
      tapeout_count: row.tapeout_count,
      chain_weight: row.chain_weight,
      first_creator_seats: row.first_creator_seats,
      estimated_daily_bem: row.estimated_daily_bem,
      kind: row.kind,
      rank: null,
      evidence_url: `${TAPEOUT_CLUB_URL}zh/research?view=power`,
      change_from_previous_snapshot: prior ? { circuit_count: row.circuit_count - prior.circuit_count, chain_weight: row.chain_weight != null && prior.chain_weight != null ? Number((row.chain_weight - prior.chain_weight).toFixed(4)) : null, estimated_daily_bem: row.estimated_daily_bem != null && prior.estimated_daily_bem != null ? Number((row.estimated_daily_bem - prior.estimated_daily_bem).toFixed(4)) : null } : null,
    };
  });
  if (q) items = items.filter(row => row.address.includes(q));
  items.sort((a, b) => Number(b.chain_weight || 0) - Number(a.chain_weight || 0) || Number(b.circuit_count || 0) - Number(a.circuit_count || 0));
  items.forEach((item, index) => { item.rank = index + 1; });
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize)), page = Math.min(pageRequested, pageCount);
  return { ...base, observed_at: snapshot.observed_at, comparison_snapshot_observed_at: priorSnapshot?.observed_at || null, coverage, total: items.length, page, page_count: pageCount, items: items.slice((page - 1) * pageSize, page * pageSize), warning: "estimated_daily_bem is a source-carried community estimate field, not a guaranteed return, price, valuation, trade volume or investment recommendation." };
}
