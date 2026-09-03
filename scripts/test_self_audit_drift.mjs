// Deterministic tests for the drift-comparison semantics in src/self_audit.js.
//
// Each case here is a failure the first night of production data actually
// produced, so this file is the regression net for that night:
//   1. a re-review must clear the "changed since review" flag — the first
//      version re-queued two tools nine seconds after their human review;
//   2. drift after a review (with no newer review) must still be flagged;
//   3. a "structure" profile must ignore asset and heading churn (a newsroom's
//      headlines are its content) while still catching nav/title changes;
//   4. a "none" profile must never be fetched and must surface its stated reason.
//
// No network, no real D1: fetch is stubbed per-URL and the DB is a map that
// understands only the exact statements self_audit.js issues.
import { syncContentDrift, selfAuditOverview } from "../src/self_audit.js";
import { CURATED_TOOLS, CURATED_UPDATES } from "../src/curated_ecosystem_seed.js";

const rows = new Map(); // tool_id -> row object
const sourceRows = new Map(); // entry_id -> row object
const runs = [];
const fetched = [];

const UPSERT_COLS = ["tool_id", "url", "asset_fingerprint", "surface_fingerprint", "first_seen_at", "last_checked_at",
  "last_changed_at", "change_count", "surface_items", "last_surface_added", "last_surface_removed",
  "baseline_surface", "baseline_reviewed_at", "drift_profile"];
const NOTOK_COLS = ["tool_id", "url", "first_seen_at", "last_checked_at", "last_status", "last_error"];

const SRC_OK_COLS = ["entry_id", "kind", "url", "fingerprint", "first_seen_at", "last_checked_at", "last_changed_at", "change_count", "baseline_reviewed_at"];
const SRC_NOTOK_COLS = ["entry_id", "kind", "url", "first_seen_at", "last_checked_at", "last_status", "last_error"];
function applyStatement(sql, args) {
  if (sql.includes("self_audit_runs")) { runs.push(args); return; }
  if (sql.includes("ON CONFLICT(entry_id)")) {
    const cols = sql.includes("fingerprint,") ? SRC_OK_COLS : SRC_NOTOK_COLS;
    const incoming = Object.fromEntries(cols.map((c, i) => [c, args[i]]));
    const prev = sourceRows.get(incoming.entry_id) || {};
    if (cols === SRC_OK_COLS) sourceRows.set(incoming.entry_id, { ...prev, ...incoming, last_status: "ok", last_error: null });
    else sourceRows.set(incoming.entry_id, { ...prev, ...incoming, first_seen_at: prev.first_seen_at ?? incoming.first_seen_at });
    return;
  }
  if (sql.includes("ON CONFLICT(tool_id)")) {
    const cols = sql.includes("asset_fingerprint") ? UPSERT_COLS : NOTOK_COLS;
    const incoming = Object.fromEntries(cols.map((c, i) => [c, args[i]]));
    const prev = rows.get(incoming.tool_id) || {};
    if (cols === UPSERT_COLS) {
      rows.set(incoming.tool_id, { ...prev, ...incoming, last_status: "ok", last_error: null });
    } else {
      rows.set(incoming.tool_id, { ...prev, ...incoming, first_seen_at: prev.first_seen_at ?? incoming.first_seen_at });
    }
  }
}

const fakeDB = {
  prepare(sql) {
    return {
      bind(...args) {
        return {
          run: async () => { applyStatement(sql, args); return {}; },
          all: async () => ({ results: [] }),
          first: async () => null,
        };
      },
      run: async () => ({}),
      all: async () => sql.includes("FROM tool_content_fingerprints") ? { results: [...rows.values()] } : sql.includes("FROM source_content_fingerprints") ? { results: [...sourceRows.values()] } : { results: [] },
      first: async () => null,
      // batch receives already-bound statements; emulate via the closure below.
    };
  },
  async batch(statements) { for (const s of statements) await s.run(); return []; },
};
// prepare().bind() must return something batch() can run — patch bind to close over sql.
const realPrepare = fakeDB.prepare.bind(fakeDB);
fakeDB.prepare = sql => {
  const stmt = realPrepare(sql);
  const realBind = stmt.bind;
  stmt.bind = (...args) => ({ ...realBind(...args), run: async () => { applyStatement(sql, args); return {}; } });
  return stmt;
};
const env = { DB: fakeDB };

// --- controllable pages -----------------------------------------------------
const page = ({ script = "app.abc123.js", heading = "Hello", nav = "Home" }) =>
  `<html><head><title>Site</title><script src="/${script}"></script></head>
   <body><nav><a href="/">${nav}</a></nav><h2>${heading}</h2></body></html>`;
const pages = new Map(); // url prefix -> html
const posts = new Map(); // fxtwitter status id -> { status, body (string) }
globalThis.fetch = async (url) => {
  fetched.push(String(url));
  const fx = String(url).match(/api\.fxtwitter\.com\/i\/status\/(\d+)/);
  if (fx) {
    const p = posts.get(fx[1]) || { status: 200, body: JSON.stringify({ code: 200, tweet: { text: "default post", article: null } }) };
    return new Response(p.body, { status: p.status, headers: { "content-type": p.status === 500 ? "text/html" : "application/json" } });
  }
  const hit = [...pages.entries()].find(([prefix]) => String(url).startsWith(prefix));
  return new Response(hit ? hit[1] : page({}), { status: 200, headers: { "content-type": "text/html" } });
};

const fullTool = CURATED_TOOLS.find(t => t.id === "tool-bemotc");
const structureTool = CURATED_TOOLS.find(t => t.id === "tool-tapeout-daily");
const noneTool = CURATED_TOOLS.find(t => t.id === "tool-intelligence-api");
if (structureTool.drift_profile !== "structure" || noneTool.drift_profile !== "none") {
  throw new Error("FAIL precondition: seed drift profiles not as expected");
}
const savedReviewedAt = fullTool.reviewed_at;
// Source under test: the first reviewed update that is a plain X post. Its text is
// fixed before the first run so the baseline is taken on known wording.
const post = CURATED_UPDATES.find(u => /x\.com\/[^/]+\/status\/\d+/.test(u.url));
const postId = post.url.match(/status\/(\d+)/)[1];
const savedPostReviewedAt = post.reviewed_at;
const tweet = text => JSON.stringify({ code: 200, tweet: { text, article: null } });
posts.set(postId, { status: 200, body: tweet("original wording") });

let failures = 0;
const check = (label, ok) => { console.log(`${ok ? "PASS" : "FAIL"} ${label}`); if (!ok) failures++; };

// Run 1: first sighting — baseline, never a change.
pages.set(fullTool.url, page({ script: "app.v1.js" }));
pages.set(structureTool.url, page({ script: "daily.v1.js", heading: "Monday news", nav: "Learn" }));
await syncContentDrift(env);
check("first sighting sets no changed flag", rows.get(fullTool.id).last_changed_at == null);
check("none-profile tool is never fetched", !fetched.some(u => u.includes("/api/v1/catalog")));
check("none-profile tool records its stated reason", rows.get(noneTool.id)?.last_error === noneTool.drift_skip_reason);

// Run 2: full-profile tool ships a new build, no newer review — must flag.
pages.set(fullTool.url, page({ script: "app.v2.js" }));
// structure-profile tool: new build AND new headline, but same title/nav — must stay quiet.
pages.set(structureTool.url, page({ script: "daily.v2.js", heading: "Tuesday news", nav: "Learn" }));
await syncContentDrift(env);
check("post-review build change is flagged", rows.get(fullTool.id).last_changed_at != null);
check("structure profile ignores asset+heading churn", rows.get(structureTool.id).last_changed_at == null);
check("structure profile stores no asset fingerprint", rows.get(structureTool.id).asset_fingerprint == null);

// Run 3: the human re-reviews the flagged tool — the flag must clear, even
// though the page still differs from the pre-review observation history.
fullTool.reviewed_at = "2099-01-01T00:00:00Z";
try {
  await syncContentDrift(env);
  check("re-review clears the changed flag (the 9-second-requeue bug)", rows.get(fullTool.id).last_changed_at == null);

  // Run 4: drift AFTER the re-review must flag again.
  pages.set(fullTool.url, page({ script: "app.v3.js" }));
  await syncContentDrift(env);
  check("drift after the re-review is flagged again", rows.get(fullTool.id).last_changed_at != null);

  // Run 5: structure profile still catches a real structural change (nav label).
  pages.set(structureTool.url, page({ script: "daily.v3.js", heading: "Wednesday news", nav: "Shop" }));
  await syncContentDrift(env);
  check("structure profile catches a nav change", rows.get(structureTool.id).last_changed_at != null);
} finally {
  fullTool.reviewed_at = savedReviewedAt;
}

// ---- sources: posts and pages behind reviewed updates and learning resources ----
const overview = async () => selfAuditOverview(env, {});
try {
  check("source baseline taken (ok, no change flag)", sourceRows.get(post.id)?.last_status === "ok" && sourceRows.get(post.id)?.last_changed_at == null);
  check("learning sources baselined on the catalogue-level review date", [...sourceRows.values()].some(r => r.kind === "learning" && r.baseline_reviewed_at));
  check("run records source counts", Array.isArray(runs.at(-1)) && runs.at(-1).length >= 5);

  // (b) a non-JSON 500 is unverified, never "gone"
  posts.set(postId, { status: 500, body: "<html>upstream error</html>" });
  await syncContentDrift(env);
  check("non-JSON failure is recorded as error, not gone", sourceRows.get(post.id)?.last_status === "error");
  let ov = await overview();
  check("no source_gone finding on a fetch failure", !ov.findings.some(f => f.check === "source_gone"));

  // (c) the post text changes after the review -> queued with kind update
  posts.set(postId, { status: 200, body: tweet("edited wording") });
  await syncContentDrift(env);
  ov = await overview();
  check("changed post is queued with kind update", ov.review_queue.some(q => q.id === post.id && q.kind === "update"));

  // (d) a review bump clears it
  post.reviewed_at = "2099-01-01T00:00:00Z";
  await syncContentDrift(env);
  ov = await overview();
  check("review bump clears the queued source", !ov.review_queue.some(q => q.id === post.id));

  // (a) explicit not-found envelope -> gone + error finding
  posts.set(postId, { status: 404, body: JSON.stringify({ code: 404, message: "NOT_FOUND", tweet: null }) });
  await syncContentDrift(env);
  ov = await overview();
  check("explicit 404 envelope is recorded as gone", sourceRows.get(post.id)?.last_status === "gone");
  check("gone raises a severity-error finding naming the entry", ov.findings.some(f => f.check === "source_gone" && f.severity === "error" && f.subjects.includes(post.id)));
  const cov = ov.coverage.sources;
  check("source coverage buckets sum to total", cov.fingerprinted + cov.skipped.length + cov.errored.length + cov.gone.length + cov.not_attempted.length === cov.total);
  check("X Articles without a status id are skipped by policy", cov.skipped.some(sk => /status id/.test(sk.reason || "")));
} finally {
  post.reviewed_at = savedPostReviewedAt;
}

if (failures) { console.error(`${failures} failure(s)`); process.exit(1); }
console.log("self-audit drift semantics: all checks passed");
