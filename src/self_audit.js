import { CURATED_TOOLS, CURATED_UPDATES, ECOSYSTEM_CATALOG_VERSION } from "./curated_ecosystem_seed.js";
import { LEARNING_RESOURCES } from "./learning_resources_seed.js";
import { ensureScheduledDomainFresh } from "./freshness.js";

// Self-audit: the monitor checking its own claims against reality, and publishing
// what it finds — including its own failures.
//
// Every quality problem this site has had was invisible until someone read the
// pages by hand: a catalogued tool quietly grew a whole new analysis panel, another
// rebranded from a marketplace into a trading terminal, a third turned out to have
// three verdict categories where our summary said two. Nothing told us. The
// editorial promise here is that a description was true when it was reviewed, so
// the thing worth automating is not writing descriptions — it is knowing when one
// has probably stopped being true.
//
// Two independent signals, chosen because they survive the noise these pages
// generate. Most of them render a live price ticker, so hashing the page body would
// report "changed" every minute and mean nothing; and most are client-rendered, so
// a Worker fetching them sees an empty shell where the navigation should be.
//   - asset fingerprint: the set of script/stylesheet URLs. Vite and Next emit
//     content-hashed filenames, so this changes exactly when the site ships a build
//     and not when a number on it moves. It works precisely where the DOM does not.
//   - surface fingerprint: title plus heading and nav-link text from the served
//     HTML. Empty for a client-rendered app, informative for a server-rendered one.
// Neither says what changed. That is the honest limit: they say when to look, which
// is the part a human was doing badly.
const DRIFT_REFRESH_MINUTES = 360;
const DRIFT_HEALTH_MINUTES = 900;
const DRIFT_FETCH_TIMEOUT_MS = 8000;
const DRIFT_MAX_BYTES = 400_000;
// Reviews older than this are surfaced for a re-read even with no observed change,
// because absence of a detected change is not evidence a page is unchanged: an
// entirely server-rendered edit with no new build leaves both fingerprints intact.
const REVIEW_STALE_DAYS = 30;

let selfAuditSchemaReady;

// D1/SQLite has no "ADD COLUMN IF NOT EXISTS"; a duplicate-column error just means
// an earlier isolate already migrated this table, which is the steady state.
async function ensureColumn(env, table, column, type) {
  try { await env.DB.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`).run(); }
  catch (error) { if (!/duplicate column/i.test(String(error?.message || error))) throw error; }
}

export async function ensureSelfAuditSchema(env) {
  if (!selfAuditSchemaReady) {
    selfAuditSchemaReady = (async () => {
      await env.DB.batch([
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS tool_content_fingerprints (
        tool_id TEXT PRIMARY KEY, url TEXT NOT NULL, asset_fingerprint TEXT, surface_fingerprint TEXT,
        first_seen_at TEXT NOT NULL, last_checked_at TEXT NOT NULL, last_changed_at TEXT, change_count INTEGER NOT NULL DEFAULT 0,
        last_status TEXT, last_error TEXT, surface_items TEXT, last_surface_added TEXT, last_surface_removed TEXT
      )`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS self_audit_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT, attempted_at TEXT NOT NULL, status TEXT NOT NULL,
        checked_count INTEGER, changed_count INTEGER, error TEXT
      )`),
      env.DB.prepare("CREATE INDEX IF NOT EXISTS self_audit_runs_attempted_idx ON self_audit_runs(attempted_at DESC)"),
      ]);
      // Added after the table shipped: the surface labels themselves, so a change can
      // be reported as which labels moved rather than only that something did.
      await ensureColumn(env, "tool_content_fingerprints", "surface_items", "TEXT");
      await ensureColumn(env, "tool_content_fingerprints", "last_surface_added", "TEXT");
      await ensureColumn(env, "tool_content_fingerprints", "last_surface_removed", "TEXT");
    })();
  }
  return selfAuditSchemaReady;
}

const SELF_ORIGIN = "https://tapeout.work";
function resolveProbeUrl(url) { try { return new URL(url, SELF_ORIGIN).toString(); } catch { return null; } }

async function digest(value) {
  if (!value) return null;
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].slice(0, 12).map(b => b.toString(16).padStart(2, "0")).join("");
}

// Deliberately parsed with regexes rather than a DOM. The input is arbitrary
// third-party HTML we only ever hash — we never render it, never follow anything
// out of it, and never show it to a reader — so the failure mode of a sloppy parse
// is a slightly noisier fingerprint, not a correctness or safety problem.
export function extractFingerprintSources(html) {
  const assets = [...html.matchAll(/<(?:script|link)\b[^>]*?(?:src|href)\s*=\s*["']([^"']+)["']/gi)]
    .map(match => match[1])
    .filter(value => /\.(?:js|css|mjs)(?:\?|$)/i.test(value))
    // Query strings on asset URLs are usually cache-busters that move on their own.
    .map(value => value.split("?")[0])
    .sort();
  const stripped = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const text = node => node.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  const title = text((stripped.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "");
  const headings = [...stripped.matchAll(/<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/gi)].map(m => text(m[1])).filter(Boolean);
  const navLinks = [...stripped.matchAll(/<nav\b[^>]*>([\s\S]*?)<\/nav>/gi)]
    .flatMap(navMatch => [...navMatch[1].matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)].map(a => text(a[1])))
    .filter(Boolean);
  const surface = [...new Set([`title:${title}`, ...headings.map(h => `h:${h}`), ...navLinks.map(n => `nav:${n}`)])].sort();
  return { assets, surface };
}

async function fingerprintTool(tool) {
  const target = resolveProbeUrl(tool.url);
  if (!target) return { id: tool.id, status: "skipped", error: "unresolvable url" };
  // Telegram and other non-HTML destinations are catalogued too; they have no build
  // to fingerprint, so they are recorded as skipped rather than as a failure.
  try {
    const response = await fetch(target, {
      method: "GET", redirect: "follow",
      headers: { accept: "text/html,application/xhtml+xml", "user-agent": "tapeout.work-monitor/1.0 (+https://tapeout.work)" },
      cf: { cacheTtl: 0, cacheEverything: false }, signal: AbortSignal.timeout(DRIFT_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return { id: tool.id, status: "error", error: `HTTP ${response.status}` };
    const type = response.headers.get("content-type") || "";
    if (!/html/i.test(type)) return { id: tool.id, status: "skipped", error: `non-html (${type.split(";")[0] || "unknown"})` };
    const body = (await response.text()).slice(0, DRIFT_MAX_BYTES);
    const { assets, surface } = extractFingerprintSources(body);
    return {
      id: tool.id, status: "ok", surface,
      asset_fingerprint: await digest(assets.join("\n")),
      surface_fingerprint: await digest(surface.join("\n")),
    };
  } catch (error) {
    return { id: tool.id, status: "error", error: error?.message || String(error) };
  }
}

export async function syncContentDrift(env) {
  await ensureSelfAuditSchema(env);
  const attemptedAt = new Date().toISOString();
  try {
    const existingRows = await env.DB.prepare("SELECT tool_id, asset_fingerprint, surface_fingerprint, change_count, surface_items FROM tool_content_fingerprints").all();
    const existing = new Map((existingRows.results || []).map(row => [row.tool_id, row]));
    const results = [];
    for (const tool of CURATED_TOOLS) {
      results.push(await fingerprintTool(tool));
    }
    const statements = [];
    let changedCount = 0;
    for (const [index, result] of results.entries()) {
      const tool = CURATED_TOOLS[index];
      const previous = existing.get(tool.id);
      if (result.status !== "ok") {
        statements.push(env.DB.prepare(`INSERT INTO tool_content_fingerprints (tool_id, url, first_seen_at, last_checked_at, last_status, last_error, change_count)
          VALUES (?, ?, ?, ?, ?, ?, 0)
          ON CONFLICT(tool_id) DO UPDATE SET url=excluded.url, last_checked_at=excluded.last_checked_at, last_status=excluded.last_status, last_error=excluded.last_error`)
          .bind(tool.id, tool.url, attemptedAt, attemptedAt, result.status, result.error || null));
        continue;
      }
      // A first sighting is a baseline, never a change: we have nothing to compare it
      // against, and reporting it as drift would put every tool in the review queue
      // the day this feature ships.
      const changed = Boolean(previous?.asset_fingerprint || previous?.surface_fingerprint)
        && (previous.asset_fingerprint !== result.asset_fingerprint || previous.surface_fingerprint !== result.surface_fingerprint);
      if (changed) changedCount += 1;
      // What moved, not merely that something did. These are observed strings from
      // the page — a nav label that appeared or vanished — never an interpretation of
      // what the change means. It turns "go re-read this site" into "this page grew a
      // tab called X", which is the part a human was spending real time on.
      let previousSurface = null;
      try { const parsed = JSON.parse(previous?.surface_items ?? "null"); if (Array.isArray(parsed)) previousSurface = parsed; } catch { previousSurface = null; }
      const currentSurface = result.surface || [];
      // With no stored predecessor there is nothing to diff against, and listing the
      // whole current surface as "added" would read as a sweeping change when the
      // truth is that we simply were not recording labels yet. Report it as unknown.
      const haveBaseline = previousSurface !== null;
      const added = changed && haveBaseline ? currentSurface.filter(item => !previousSurface.includes(item)).slice(0, 25) : null;
      const removed = changed && haveBaseline ? previousSurface.filter(item => !currentSurface.includes(item)).slice(0, 25) : null;
      statements.push(env.DB.prepare(`INSERT INTO tool_content_fingerprints
          (tool_id, url, asset_fingerprint, surface_fingerprint, first_seen_at, last_checked_at, last_changed_at, change_count, last_status, last_error, surface_items, last_surface_added, last_surface_removed)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ok', NULL, ?, ?, ?)
          ON CONFLICT(tool_id) DO UPDATE SET url=excluded.url, asset_fingerprint=excluded.asset_fingerprint,
            surface_fingerprint=excluded.surface_fingerprint, last_checked_at=excluded.last_checked_at,
            last_changed_at=excluded.last_changed_at, change_count=excluded.change_count, last_status='ok', last_error=NULL,
            surface_items=excluded.surface_items,
            last_surface_added=CASE WHEN excluded.last_changed_at IS NOT tool_content_fingerprints.last_changed_at THEN excluded.last_surface_added ELSE tool_content_fingerprints.last_surface_added END,
            last_surface_removed=CASE WHEN excluded.last_changed_at IS NOT tool_content_fingerprints.last_changed_at THEN excluded.last_surface_removed ELSE tool_content_fingerprints.last_surface_removed END`)
        .bind(tool.id, tool.url, result.asset_fingerprint, result.surface_fingerprint, attemptedAt, attemptedAt,
          changed ? attemptedAt : (previous?.last_changed_at ?? null), (previous?.change_count ?? 0) + (changed ? 1 : 0),
          JSON.stringify(currentSurface), added ? JSON.stringify(added) : null, removed ? JSON.stringify(removed) : null));
    }
    for (let index = 0; index < statements.length; index += 40) await env.DB.batch(statements.slice(index, index + 40));
    await env.DB.prepare("INSERT INTO self_audit_runs (attempted_at, status, checked_count, changed_count, error) VALUES (?, 'ok', ?, ?, NULL)")
      .bind(attemptedAt, results.length, changedCount).run();
    return { status: "ok", attempted_at: attemptedAt, checked: results.length, changed: changedCount };
  } catch (error) {
    await env.DB.prepare("INSERT INTO self_audit_runs (attempted_at, status, checked_count, changed_count, error) VALUES (?, 'error', NULL, NULL, ?)")
      .bind(attemptedAt, String(error?.message || error).slice(0, 500)).run();
    return { status: "error", attempted_at: attemptedAt, error: error?.message || String(error) };
  }
}

export async function ensureContentDriftFresh(env) {
  return ensureScheduledDomainFresh({
    key: "self_audit", env, prepare: () => ensureSelfAuditSchema(env),
    latestRun: () => env.DB.prepare("SELECT attempted_at, status FROM self_audit_runs ORDER BY id DESC LIMIT 1").first(),
    sync: syncContentDrift, maxAgeMinutes: DRIFT_REFRESH_MINUTES, errorBackoffMinutes: 30,
  });
}

// Invariants the catalogue is supposed to hold. Each one here is a mistake this
// site actually made and did not notice: localisation silently falling behind the
// catalogue as it grew, and entries carrying a review date old enough that nobody
// could reasonably still vouch for them.
async function catalogueInvariants(env, localeCoverage) {
  const findings = [];
  // A check that could not run is not a check that passed. Reporting silence as
  // "clean" is the exact failure this whole feature exists to prevent.
  if (!localeCoverage) {
    findings.push({ check: "localisation_coverage", severity: "warning", detail: "locale files could not be read, so coverage was not verified this run", subjects: [] });
    localeCoverage = {};
  } else {
    const unreadable = AUDIT_LOCALES.filter(locale => !(locale in localeCoverage));
    if (unreadable.length) findings.push({ check: "localisation_coverage", severity: "warning", detail: `${unreadable.length} locale file(s) unreadable, coverage unverified for them`, subjects: unreadable });
  }
  const missingEvidence = CURATED_TOOLS.filter(tool => !tool.safety_en || !tool.url || !tool.operator || !tool.wallet_risk);
  if (missingEvidence.length) findings.push({ check: "tool_evidence_fields", severity: "error", detail: `${missingEvidence.length} tool(s) missing a required evidence field`, subjects: missingEvidence.map(t => t.id) });

  for (const [locale, counts] of Object.entries(localeCoverage)) {
    const gaps = [];
    if (counts.tools !== CURATED_TOOLS.length) gaps.push(`tools ${counts.tools}/${CURATED_TOOLS.length}`);
    if (counts.updates !== CURATED_UPDATES.length) gaps.push(`updates ${counts.updates}/${CURATED_UPDATES.length}`);
    if (counts.learning !== LEARNING_RESOURCES.length) gaps.push(`learning ${counts.learning}/${LEARNING_RESOURCES.length}`);
    if (gaps.length) findings.push({ check: "localisation_coverage", severity: "warning", detail: `${locale}: ${gaps.join(", ")}`, subjects: [locale] });
  }

  const behind = Object.entries(localeCoverage)
    .filter(([, counts]) => counts.source_catalog_version && counts.source_catalog_version !== ECOSYSTEM_CATALOG_VERSION)
    .map(([locale]) => locale);
  if (behind.length) findings.push({ check: "localisation_freshness", severity: "warning", detail: `${behind.length} locale(s) were translated from an earlier catalogue revision than ${ECOSYSTEM_CATALOG_VERSION}; entries whose source text was rewritten since then are serving the older wording`, subjects: behind });

  const now = Date.now();
  const stale = CURATED_TOOLS.filter(tool => {
    const reviewed = Date.parse(tool.reviewed_at || "");
    return Number.isFinite(reviewed) && (now - reviewed) / 86400000 > REVIEW_STALE_DAYS;
  });
  if (stale.length) findings.push({ check: "review_age", severity: "info", detail: `${stale.length} tool(s) last reviewed more than ${REVIEW_STALE_DAYS} days ago`, subjects: stale.map(t => t.id) });
  return findings;
}

// Reads the shipped locale files through the ASSETS binding rather than importing
// them, so the audit measures what the site actually serves rather than what the
// source tree happens to contain.
const AUDIT_LOCALES = ["ko", "ja", "es", "ar", "tr", "fr", "de", "ru", "pt"];
export async function readLocaleCoverage(env) {
  if (!env.ASSETS) return null;
  const coverage = {};
  await Promise.all(AUDIT_LOCALES.map(async locale => {
    try {
      const [ecoResponse, learnResponse] = await Promise.all([
        env.ASSETS.fetch(new Request(`${SELF_ORIGIN}/i18n/ecosystem/${locale}.json`)),
        env.ASSETS.fetch(new Request(`${SELF_ORIGIN}/i18n/learning/${locale}.json`)),
      ]);
      if (!ecoResponse.ok || !learnResponse.ok) return;
      const eco = await ecoResponse.json(), learn = await learnResponse.json();
      coverage[locale] = {
        tools: Object.keys(eco?.translations?.tools || {}).length,
        updates: Object.keys(eco?.translations?.updates || {}).length,
        learning: Object.keys(learn?.translations || {}).length,
        // Which catalogue revision this locale was translated from. Counting entries
        // proves a translation exists; it says nothing about whether the English it
        // was made from has since been rewritten, which is its own kind of stale.
        source_catalog_version: eco?.source_catalog_version ?? null,
      };
    } catch { /* left out of the result; reported below as unreadable, never as passing */ }
  }));
  return coverage;
}

const safeList = value => { try { const parsed = JSON.parse(value || "[]"); return Array.isArray(parsed) ? parsed : []; } catch { return []; } };
export async function selfAuditOverview(env, localeCoverage = null) {
  await ensureSelfAuditSchema(env);
  // Cold-start only, matching the convention used elsewhere in this repo: the
  // six-hourly cron owns refreshing this. A reader pays for a sync exactly once,
  // when there is no baseline at all, because an audit with no baseline would
  // otherwise report "clean" while having checked nothing.
  const seeded = await env.DB.prepare("SELECT 1 AS seeded FROM tool_content_fingerprints LIMIT 1").first();
  if (!seeded) await syncContentDrift(env);
  const [fingerprintRows, latestRun] = await Promise.all([
    env.DB.prepare("SELECT tool_id, url, last_checked_at, last_changed_at, change_count, last_status, last_error, last_surface_added, last_surface_removed FROM tool_content_fingerprints").all(),
    env.DB.prepare("SELECT attempted_at, status, checked_count, changed_count, error FROM self_audit_runs ORDER BY id DESC LIMIT 1").first(),
  ]);
  const byId = new Map((fingerprintRows.results || []).map(row => [row.tool_id, row]));

  // The actionable output: a page observably shipped a change after the date we
  // last vouched for its description. Not "this description is wrong" — we cannot
  // know that from a fingerprint — but "a human should read this one again".
  const reviewQueue = [];
  for (const tool of CURATED_TOOLS) {
    const row = byId.get(tool.id);
    if (!row?.last_changed_at) continue;
    const reviewedAt = Date.parse(tool.reviewed_at || "");
    const changedAt = Date.parse(row.last_changed_at);
    if (!Number.isFinite(reviewedAt) || !Number.isFinite(changedAt) || changedAt <= reviewedAt) continue;
    reviewQueue.push({
      id: tool.id, url: tool.url, title_en: tool.title_en, tier: tool.tier, wallet_risk: tool.wallet_risk,
      reviewed_at: tool.reviewed_at, changed_at: row.last_changed_at, change_count: row.change_count,
      // null, not [], when no comparable predecessor existed — an empty list would
      // claim nothing moved, which is a different statement from not knowing.
      surface_added: row.last_surface_added ? safeList(row.last_surface_added) : null,
      surface_removed: row.last_surface_removed ? safeList(row.last_surface_removed) : null,
    });
  }
  reviewQueue.sort((a, b) => String(b.changed_at).localeCompare(String(a.changed_at)));

  const measuredCoverage = localeCoverage ?? await readLocaleCoverage(env);
  const findings = await catalogueInvariants(env, measuredCoverage);
  const coverage = {
    tools_fingerprinted: [...byId.values()].filter(row => row.last_status === "ok").length,
    tools_total: CURATED_TOOLS.length,
    skipped: [...byId.values()].filter(row => row.last_status === "skipped").map(row => ({ tool_id: row.tool_id, reason: row.last_error })),
    errored: [...byId.values()].filter(row => row.last_status === "error").map(row => ({ tool_id: row.tool_id, error: row.last_error })),
  };

  return {
    // A warning counts toward "attention". The failure this whole feature exists to
    // prevent is a real problem sitting in a report that reads as fine, and the
    // localisation gap that went unnoticed for weeks was exactly a warning-level one.
    // "info" (a review simply getting old) does not flip the status by itself.
    status: latestRun?.status === "error" ? "error"
      : (reviewQueue.length || findings.some(f => f.severity === "error" || f.severity === "warning")) ? "attention" : "clean",
    catalog_version: ECOSYSTEM_CATALOG_VERSION,
    last_run: latestRun || null,
    review_queue: reviewQueue,
    findings,
    coverage,
    // Published as numbers rather than as the absence of complaints, so a reader can
    // see what was actually measured instead of trusting that something ran.
    localisation: measuredCoverage === null ? null : {
      catalogue: { tools: CURATED_TOOLS.length, updates: CURATED_UPDATES.length, learning: LEARNING_RESOURCES.length },
      locales: measuredCoverage,
    },
    methodology: "Each catalogued tool page is fetched on a six-hourly schedule and reduced to two fingerprints: the set of its script/stylesheet URLs (which change when the site ships a build, and not when a price on it moves) and the title/heading/nav text visible in the served HTML (empty for client-rendered apps). A tool enters the review queue when a fingerprint changed after the date we last reviewed its description.",
    boundary: "Where the served HTML exposes headings and navigation, the entry lists which of those labels appeared or disappeared — observed strings, not an interpretation of what the change means, and blank for a client-rendered app whose shell carries none. Otherwise this detects that a page changed, never what changed or whether our description is now wrong — a human decides that. A tool absent from the queue is not certified current: a server-rendered edit that ships no new build leaves both fingerprints untouched, and non-HTML destinations cannot be fingerprinted at all. Nothing here is automatically written into the catalogue.",
  };
}
