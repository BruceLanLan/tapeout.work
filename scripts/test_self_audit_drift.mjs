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
import { syncContentDrift } from "../src/self_audit.js";
import { CURATED_TOOLS } from "../src/curated_ecosystem_seed.js";

const rows = new Map(); // tool_id -> row object
const fetched = [];

const UPSERT_COLS = ["tool_id", "url", "asset_fingerprint", "surface_fingerprint", "first_seen_at", "last_checked_at",
  "last_changed_at", "change_count", "surface_items", "last_surface_added", "last_surface_removed",
  "baseline_surface", "baseline_reviewed_at", "drift_profile"];
const NOTOK_COLS = ["tool_id", "url", "first_seen_at", "last_checked_at", "last_status", "last_error"];

function applyStatement(sql, args) {
  if (sql.includes("self_audit_runs")) return;
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
      all: async () => sql.includes("FROM tool_content_fingerprints") ? { results: [...rows.values()] } : { results: [] },
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
globalThis.fetch = async (url) => {
  fetched.push(String(url));
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

if (failures) { console.error(`${failures} failure(s)`); process.exit(1); }
console.log("self-audit drift semantics: all checks passed");
