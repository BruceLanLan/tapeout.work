import { CURATED_TOOLS } from "./curated_ecosystem_seed.js";
import { ensureScheduledDomainFresh } from "./freshness.js";

// The curated tool directory is reviewed editorially but never re-probed for reachability
// on its own. This module is a status board, not a history log: one row per tool, always
// overwritten with the latest check, so the table never grows and never claims uptime history.
export const ECOSYSTEM_HEALTH_REFRESH_MINUTES = 60;
const ECOSYSTEM_HEALTH_PROBE_TIMEOUT_MS = 6000;

let ecosystemHealthSchemaReady;

export async function ensureEcosystemHealthSchema(env) {
  if (ecosystemHealthSchemaReady) return ecosystemHealthSchemaReady;
  ecosystemHealthSchemaReady = env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS ecosystem_tool_health (
      id TEXT PRIMARY KEY, url TEXT NOT NULL, status TEXT NOT NULL, http_status INTEGER,
      checked_at TEXT NOT NULL, response_ms INTEGER, error TEXT
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS ecosystem_health_sync_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, attempted_at TEXT NOT NULL, status TEXT NOT NULL,
      tool_count INTEGER, reachable_count INTEGER, unreachable_count INTEGER, error TEXT
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS ecosystem_health_sync_runs_attempted_idx ON ecosystem_health_sync_runs(attempted_at DESC)"),
  ]);
  return ecosystemHealthSchemaReady;
}

// A few catalog entries (e.g. this site's own API) store a site-relative URL like
// "/api/v1/catalog" rather than an absolute one, since that's the correct value for
// on-site links. fetch() inside a Worker has no page origin to resolve that against,
// so it must be resolved against this site's own origin before probing — otherwise
// the probe throws immediately and the entry is wrongly reported as unreachable.
const SELF_ORIGIN = "https://tapeout.work";
function resolveProbeUrl(url) { return new URL(url, SELF_ORIGIN).toString(); }

// Some sites 405/501 on HEAD, and a few refuse it with an outright connection error rather
// than a clean status code. Either case is retried once with GET before the tool is marked
// unreachable. `error` is only ever populated when the fetch itself threw (timeout, DNS
// failure, TLS failure, ...); a clean non-2xx/3xx response is "unreachable" with no error text.
export async function probeEcosystemTool(tool) {
  const startedAt = Date.now();
  const target = resolveProbeUrl(tool.url);
  let response, thrown = null;
  // cf: { cacheTtl: 0, cacheEverything: false } matches every other outbound fetch in this
  // repo (see fetchJsonWithTimeout in util.js) so a cached 200 at Cloudflare's edge can never
  // mask a currently-down origin on a feature whose whole job is detecting downness.
  try {
    response = await fetch(target, { method: "HEAD", redirect: "follow", cf: { cacheTtl: 0, cacheEverything: false }, signal: AbortSignal.timeout(ECOSYSTEM_HEALTH_PROBE_TIMEOUT_MS) });
    if (response.status === 405 || response.status === 501) {
      response = await fetch(target, { method: "GET", redirect: "follow", cf: { cacheTtl: 0, cacheEverything: false }, signal: AbortSignal.timeout(ECOSYSTEM_HEALTH_PROBE_TIMEOUT_MS) });
    }
  } catch (headError) {
    try {
      response = await fetch(target, { method: "GET", redirect: "follow", cf: { cacheTtl: 0, cacheEverything: false }, signal: AbortSignal.timeout(ECOSYSTEM_HEALTH_PROBE_TIMEOUT_MS) });
    } catch (getError) {
      thrown = getError;
    }
  }
  const responseMs = Date.now() - startedAt;
  if (thrown) return { id: tool.id, url: tool.url, status: "unreachable", http_status: null, response_ms: responseMs, error: thrown?.message || String(thrown) };
  const reachable = response.status >= 200 && response.status < 400;
  return { id: tool.id, url: tool.url, status: reachable ? "reachable" : "unreachable", http_status: response.status, response_ms: responseMs, error: null };
}

export async function recordEcosystemHealthRun(env, row) {
  await env.DB.prepare("INSERT INTO ecosystem_health_sync_runs (attempted_at, status, tool_count, reachable_count, unreachable_count, error) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(row.attempted_at, row.status, row.tool_count ?? null, row.reachable_count ?? null, row.unreachable_count ?? null, row.error ? String(row.error).slice(0, 500) : null).run();
}

export async function syncEcosystemHealth(env) {
  await ensureEcosystemHealthSchema(env);
  const attemptedAt = new Date().toISOString();
  try {
    const outcomes = await Promise.allSettled(CURATED_TOOLS.map(tool => probeEcosystemTool(tool)));
    const rows = outcomes.map((outcome, index) => outcome.status === "fulfilled" ? outcome.value : { id: CURATED_TOOLS[index].id, url: CURATED_TOOLS[index].url, status: "unreachable", http_status: null, response_ms: null, error: outcome.reason?.message || String(outcome.reason) });
    const statements = rows.map(row => env.DB.prepare(`INSERT INTO ecosystem_tool_health (id, url, status, http_status, checked_at, response_ms, error) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET url = excluded.url, status = excluded.status, http_status = excluded.http_status, checked_at = excluded.checked_at, response_ms = excluded.response_ms, error = excluded.error`)
      .bind(row.id, row.url, row.status, row.http_status, attemptedAt, row.response_ms, row.error));
    for (let index = 0; index < statements.length; index += 50) await env.DB.batch(statements.slice(index, index + 50));
    const reachableCount = rows.filter(row => row.status === "reachable").length, unreachableCount = rows.filter(row => row.status === "unreachable").length;
    const healthStatus = unreachableCount === 0 ? "healthy" : reachableCount === 0 ? "error" : "degraded";
    // The stored run status feeds ensureScheduledDomainFresh's freshness gate, where only the
    // literal string "error" triggers a 2-minute retry backoff instead of the normal 60-minute
    // wait (see needsFreshnessRecovery in freshness.js). A probe pass that completed and wrote
    // its results is a successful collection even if every external site happened to be
    // unreachable that round (e.g. a shared egress/CDN blip) -- that is exactly the case the
    // 60-minute politeness gate exists to protect, not a reason to hammer 16+ external sites
    // again five minutes later. "error" is reserved for the catch below: a genuine failure to
    // complete the collection at all (schema/D1 failure), which does warrant a fast retry.
    await recordEcosystemHealthRun(env, { attempted_at: attemptedAt, status: "ok", tool_count: rows.length, reachable_count: reachableCount, unreachable_count: unreachableCount });
    return { status: healthStatus, attempted_at: attemptedAt, tool_count: rows.length, reachable_count: reachableCount, unreachable_count: unreachableCount };
  } catch (error) {
    await recordEcosystemHealthRun(env, { attempted_at: attemptedAt, status: "error", error: error?.message || String(error) });
    return { status: "error", attempted_at: attemptedAt, error: error?.message || String(error) };
  }
}

export async function ensureEcosystemHealthFresh(env) {
  return ensureScheduledDomainFresh({
    key: "ecosystem_tool_health", env, prepare: () => ensureEcosystemHealthSchema(env),
    latestRun: () => env.DB.prepare("SELECT attempted_at, status FROM ecosystem_health_sync_runs ORDER BY id DESC LIMIT 1").first(),
    sync: syncEcosystemHealth, maxAgeMinutes: ECOSYSTEM_HEALTH_REFRESH_MINUTES,
  });
}

export async function ecosystemToolHealthOverview(env) {
  await ensureEcosystemHealthSchema(env);
  // ensureEcosystemHealthFresh only needs to block a request when it actually triggers a
  // background probe pass (rare, since the 5-minute cron keeps this warm via the 60-minute
  // gate); in the common case it runs alongside the reads below instead of gating them.
  const [, healthResult, run] = await Promise.all([
    ensureEcosystemHealthFresh(env),
    env.DB.prepare("SELECT id, status, http_status, response_ms, checked_at, error FROM ecosystem_tool_health").all(),
    env.DB.prepare("SELECT attempted_at, status FROM ecosystem_health_sync_runs ORDER BY id DESC LIMIT 1").first(),
  ]);
  const healthById = new Map(healthResult.results.map(row => [row.id, row]));
  const tools = CURATED_TOOLS.map(tool => {
    const health = healthById.get(tool.id);
    return {
      id: tool.id, title_en: tool.title_en, title_zh: tool.title_zh, url: tool.url, category: tool.category, tier: tool.tier,
      status: health ? health.status : "pending", http_status: health ? health.http_status : null,
      response_ms: health ? health.response_ms : null, checked_at: health ? health.checked_at : null, error: health ? health.error : null,
    };
  });
  const reachableCount = tools.filter(tool => tool.status === "reachable").length, unreachableCount = tools.filter(tool => tool.status === "unreachable").length;
  const status = tools.every(tool => tool.status === "pending") ? "pending" : unreachableCount === 0 ? "healthy" : reachableCount === 0 ? "error" : "degraded";
  return {
    status, checked_at: run?.attempted_at || null, source_type: "self_probed",
    scope: "HEAD (falling back to GET) reachability probe of each catalog entry's own URL, run at most once per 60 minutes per tool. This measures only whether the URL currently responds; it is not uptime history, content correctness, or an endorsement of the linked tool.",
    freshness_policy: `Checked at most every ${ECOSYSTEM_HEALTH_REFRESH_MINUTES} minutes on the shared 5-minute scheduled cycle. A tool never checked yet reports status "pending" rather than a fabricated result.`,
    tools,
  };
}
