import { CURATED_TOOLS, CURATED_UPDATES, ECOSYSTEM_CATALOG_VERSION } from "./curated_ecosystem_seed.js";
import { LEARNING_RESOURCES, LEARNING_CATALOG_REVIEWED_AT } from "./learning_resources_seed.js";
import { ensureScheduledDomainFresh } from "./freshness.js";
import { entrySourceHash } from "./catalog_hash.js";

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
      // Catalogued sources (reviewed updates and learning resources): X posts and
      // articles through fxtwitter's JSON, other pages through the same surface
      // fingerprint as tools. A deleted post is recorded as "gone" only on
      // fxtwitter's explicit 404 envelope; any other failure is unverified.
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS source_content_fingerprints (
        entry_id TEXT PRIMARY KEY, kind TEXT NOT NULL, url TEXT NOT NULL, fingerprint TEXT,
        first_seen_at TEXT NOT NULL, last_checked_at TEXT NOT NULL, last_changed_at TEXT, change_count INTEGER NOT NULL DEFAULT 0,
        last_status TEXT, last_error TEXT, baseline_reviewed_at TEXT
      )`),
      ]);
      await ensureColumn(env, "self_audit_runs", "sources_checked", "INTEGER");
      await ensureColumn(env, "self_audit_runs", "sources_changed", "INTEGER");
      // Added after the table shipped: the surface labels themselves, so a change can
      // be reported as which labels moved rather than only that something did.
      await ensureColumn(env, "tool_content_fingerprints", "surface_items", "TEXT");
      await ensureColumn(env, "tool_content_fingerprints", "last_surface_added", "TEXT");
      await ensureColumn(env, "tool_content_fingerprints", "last_surface_removed", "TEXT");
      // The surface as it stood at the last human review, and which review that was.
      // Diffing probe-against-probe answered the wrong question: two changes between
      // reviews could cancel out, or the first one's labels could be overwritten by
      // the second, so a reviewer could open the queue and be shown less than had
      // actually moved. The question they are asking is "what changed since I last
      // vouched for this", so that is what the baseline has to be.
      await ensureColumn(env, "tool_content_fingerprints", "baseline_surface", "TEXT");
      await ensureColumn(env, "tool_content_fingerprints", "baseline_reviewed_at", "TEXT");
      // Which signals this tool was fingerprinted under. When the catalogue changes a
      // tool's drift profile, the stored hashes were computed under different rules
      // and comparing across that boundary would manufacture a phantom change, so a
      // profile mismatch forces a re-baseline instead.
      await ensureColumn(env, "tool_content_fingerprints", "drift_profile", "TEXT");
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

async function digestBytes(buffer) {
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(hash)].slice(0, 12).map(b => b.toString(16).padStart(2, "0")).join("");
}

// A PDF the size limit rejects is still worth a shallow check: ETag/Content-Length
// change whenever the file is actually replaced, even though neither proves it.
const PDF_MAX_BYTES = 5_000_000;

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

// The first night of real data taught this: one signal set does not fit every
// tool. A dashboard hosted on a shared platform inherits the platform's asset
// churn; a daily newsroom's headings are its content, which is supposed to change;
// and this site's own API cannot be probed by the Worker that serves it. Each
// profile is declared in the seed next to the tool it describes, so the policy is
// reviewable exactly like every other editorial claim.
//   "full"      (default) assets + title/headings/nav
//   "structure" title + nav only — for pages whose body content is expected to
//               change constantly while the product around it rarely does
//   "none"      not probed at all; the seed states why, and coverage reports it
//               as skipped-by-policy rather than pretending it was checked
async function fingerprintTool(tool) {
  const profile = tool.drift_profile || "full";
  if (profile === "none") {
    return { id: tool.id, status: "skipped", error: tool.drift_skip_reason || "excluded by drift policy" };
  }
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
    if (/pdf/i.test(type)) {
      const contentLength = Number(response.headers.get("content-length") || 0);
      const etag = response.headers.get("etag") || "";
      let assetFingerprint;
      if (contentLength && contentLength > PDF_MAX_BYTES) {
        assetFingerprint = await digest(`pdf-meta:${etag}:${contentLength}`);
      } else {
        assetFingerprint = await digestBytes(await response.arrayBuffer());
      }
      // The learning/update path (fingerprintSource) only carries surface_fingerprint
      // forward and drops asset_fingerprint entirely, so the real byte digest has to
      // live here too, not just in the field a source-kind caller never reads.
      const surface = [`pdf:${assetFingerprint}`];
      return { id: tool.id, status: "ok", surface, asset_fingerprint: assetFingerprint, surface_fingerprint: await digest(surface.join("\n")) };
    }
    if (!/html/i.test(type)) return { id: tool.id, status: "skipped", error: `non-html (${type.split(";")[0] || "unknown"})` };
    const body = (await response.text()).slice(0, DRIFT_MAX_BYTES);
    const extracted = extractFingerprintSources(body);
    const surface = profile === "structure"
      ? extracted.surface.filter(item => item.startsWith("title:") || item.startsWith("nav:"))
      : extracted.surface;
    return {
      id: tool.id, status: "ok", surface,
      asset_fingerprint: profile === "structure" ? null : await digest(extracted.assets.join("\n")),
      surface_fingerprint: await digest(surface.join("\n")),
    };
  } catch (error) {
    return { id: tool.id, status: "error", error: error?.message || String(error) };
  }
}

const X_STATUS = /^https?:\/\/(?:x|twitter)\.com\/[^/]+\/status\/(\d+)/i;
const X_ARTICLE = /^https?:\/\/(?:x|twitter)\.com\/[^/]+\/article\/\d+/i;
// Every catalogued source with the review date its fingerprint is baselined on.
// Updates carry their own reviewed_at. Learning resources do not — the catalogue
// has one review date for all of them — so a catalogue-level bump re-baselines
// every learning source at once. Coarse, but true; per-entry dates would have to
// be invented.
export function sourceEntries() {
  const list = [];
  for (const u of CURATED_UPDATES) list.push({ id: u.id, kind: "update", url: u.url, title_en: u.title_en, reviewed_at: u.reviewed_at || null, status_id: u.source_status_id || (u.url.match(X_STATUS) || [])[1] || null });
  for (const l of LEARNING_RESOURCES) list.push({ id: l.id, kind: "learning", url: l.url, title_en: l.title_en, reviewed_at: LEARNING_CATALOG_REVIEWED_AT, status_id: (l.url.match(X_STATUS) || [])[1] || null });
  return list;
}

async function fingerprintSource(entry) {
  if (entry.status_id) {
    try {
      const response = await fetch(`https://api.fxtwitter.com/i/status/${entry.status_id}`, {
        headers: { accept: "application/json", "user-agent": "tapeout.work-monitor/1.0 (+https://tapeout.work)" },
        cf: { cacheTtl: 0, cacheEverything: false }, signal: AbortSignal.timeout(DRIFT_FETCH_TIMEOUT_MS),
      });
      let body = null;
      try { body = await response.json(); } catch { body = null; }
      // "Gone" is asserted only on the explicit not-found envelope. A 404 without it,
      // a 5xx, a rate limit or a non-JSON body says nothing about the post.
      if (response.status === 404 && body && body.code === 404 && body.tweet === null) return { id: entry.id, status: "gone", error: "fxtwitter: 404 NOT_FOUND" };
      if (!response.ok || !body?.tweet) return { id: entry.id, status: "error", error: `fxtwitter HTTP ${response.status}${body ? "" : " (non-JSON)"}` };
      const tweet = body.tweet;
      const material = [tweet.text || "", tweet.article?.title || "", ...((tweet.article?.content?.blocks || []).map(block => block?.text || ""))].join("\n");
      return { id: entry.id, status: "ok", fingerprint: await digest(material) };
    } catch (error) {
      return { id: entry.id, status: "error", error: error?.message || String(error) };
    }
  }
  if (X_ARTICLE.test(entry.url)) return { id: entry.id, status: "skipped", error: "X Article without a recorded status id" };
  const page = await fingerprintTool({ id: entry.id, url: entry.url, drift_profile: "structure" });
  if (page.status !== "ok") return { id: entry.id, status: page.status, error: page.error };
  return { id: entry.id, status: "ok", fingerprint: page.surface_fingerprint };
}

async function syncSourceDrift(env, attemptedAt) {
  const existingRows = await env.DB.prepare("SELECT entry_id, fingerprint, change_count, last_changed_at, baseline_reviewed_at FROM source_content_fingerprints").all();
  const existing = new Map((existingRows.results || []).map(row => [row.entry_id, row]));
  const statements = [];
  let changed = 0, checked = 0;
  for (const entry of sourceEntries()) {
    const result = await fingerprintSource(entry);
    checked += 1;
    const previous = existing.get(entry.id);
    if (result.status !== "ok") {
      statements.push(env.DB.prepare(`INSERT INTO source_content_fingerprints (entry_id, kind, url, first_seen_at, last_checked_at, last_status, last_error, change_count)
          VALUES (?, ?, ?, ?, ?, ?, ?, 0)
          ON CONFLICT(entry_id) DO UPDATE SET url=excluded.url, last_checked_at=excluded.last_checked_at, last_status=excluded.last_status, last_error=excluded.last_error`)
        .bind(entry.id, entry.kind, entry.url, attemptedAt, attemptedAt, result.status, result.error || null));
      continue;
    }
    const rebaseline = !previous || previous.baseline_reviewed_at !== entry.reviewed_at;
    const moved = !rebaseline && Boolean(previous?.fingerprint) && previous.fingerprint !== result.fingerprint;
    if (moved) changed += 1;
    statements.push(env.DB.prepare(`INSERT INTO source_content_fingerprints (entry_id, kind, url, fingerprint, first_seen_at, last_checked_at, last_changed_at, change_count, last_status, last_error, baseline_reviewed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ok', NULL, ?)
        ON CONFLICT(entry_id) DO UPDATE SET url=excluded.url, fingerprint=excluded.fingerprint, last_checked_at=excluded.last_checked_at,
          last_changed_at=excluded.last_changed_at, change_count=excluded.change_count, last_status='ok', last_error=NULL, baseline_reviewed_at=excluded.baseline_reviewed_at`)
      .bind(entry.id, entry.kind, entry.url, result.fingerprint, attemptedAt, attemptedAt,
        moved ? attemptedAt : (rebaseline ? null : previous?.last_changed_at ?? null), (previous?.change_count ?? 0) + (moved ? 1 : 0), entry.reviewed_at));
  }
  for (let index = 0; index < statements.length; index += 40) await env.DB.batch(statements.slice(index, index + 40));
  return { checked, changed };
}

export async function syncContentDrift(env) {
  await ensureSelfAuditSchema(env);
  const attemptedAt = new Date().toISOString();
  try {
    const existingRows = await env.DB.prepare("SELECT tool_id, asset_fingerprint, surface_fingerprint, change_count, surface_items, baseline_surface, baseline_reviewed_at, drift_profile FROM tool_content_fingerprints").all();
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
      const currentSurface = result.surface || [];
      // Re-baseline when the catalogue says this entry has been reviewed since the
      // baseline was taken: a fresh human sign-off makes the page as it stands the
      // new point of comparison. A drift-profile change re-baselines too — hashes
      // computed under different rules are not comparable, and diffing across that
      // boundary would manufacture a phantom change.
      const reviewedAt = tool.reviewed_at || null;
      const profile = tool.drift_profile || "full";
      const rebaseline = !previous || previous.baseline_reviewed_at !== reviewedAt || (previous.drift_profile || "full") !== profile;
      // A first sighting is a baseline, never a change: we have nothing to compare it
      // against, and reporting it as drift would put every tool in the review queue
      // the day this feature ships. The same holds on re-baseline: the reviewer just
      // vouched for the page as it stands, so drift measured against the pre-review
      // observation is history, not a post-review change. The first version of this
      // code got that wrong and re-queued two tools nine seconds after their review.
      const changed = !rebaseline && Boolean(previous?.asset_fingerprint || previous?.surface_fingerprint)
        && (previous.asset_fingerprint !== result.asset_fingerprint || previous.surface_fingerprint !== result.surface_fingerprint);
      if (changed) changedCount += 1;
      // What moved, not merely that something did. These are observed strings from
      // the page — a nav label that appeared or vanished — never an interpretation of
      // what the change means. It turns "go re-read this site" into "this page grew a
      // tab called X", which is the part a human was spending real time on.
      let baselineSurface = null;
      if (!rebaseline) {
        try { const parsed = JSON.parse(previous?.baseline_surface ?? "null"); if (Array.isArray(parsed)) baselineSurface = parsed; } catch { baselineSurface = null; }
      }
      const nextBaselineSurface = rebaseline ? currentSurface : (baselineSurface ?? currentSurface);
      // With no comparable baseline there is nothing to diff against, and listing the
      // whole current surface as "added" would read as a sweeping change when the
      // truth is that we simply were not recording labels yet. Report it as unknown.
      const added = baselineSurface ? currentSurface.filter(item => !baselineSurface.includes(item)).slice(0, 25) : null;
      const removed = baselineSurface ? baselineSurface.filter(item => !currentSurface.includes(item)).slice(0, 25) : null;
      statements.push(env.DB.prepare(`INSERT INTO tool_content_fingerprints
          (tool_id, url, asset_fingerprint, surface_fingerprint, first_seen_at, last_checked_at, last_changed_at, change_count, last_status, last_error, surface_items, last_surface_added, last_surface_removed, baseline_surface, baseline_reviewed_at, drift_profile)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ok', NULL, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(tool_id) DO UPDATE SET url=excluded.url, asset_fingerprint=excluded.asset_fingerprint,
            surface_fingerprint=excluded.surface_fingerprint, last_checked_at=excluded.last_checked_at,
            last_changed_at=excluded.last_changed_at, change_count=excluded.change_count, last_status='ok', last_error=NULL,
            surface_items=excluded.surface_items, baseline_surface=excluded.baseline_surface, baseline_reviewed_at=excluded.baseline_reviewed_at, drift_profile=excluded.drift_profile,
            last_surface_added=CASE WHEN excluded.last_changed_at IS NOT tool_content_fingerprints.last_changed_at THEN excluded.last_surface_added ELSE tool_content_fingerprints.last_surface_added END,
            last_surface_removed=CASE WHEN excluded.last_changed_at IS NOT tool_content_fingerprints.last_changed_at THEN excluded.last_surface_removed ELSE tool_content_fingerprints.last_surface_removed END`)
        .bind(tool.id, tool.url, result.asset_fingerprint, result.surface_fingerprint, attemptedAt, attemptedAt,
          // On re-baseline the stale flag is cleared, not carried: the queue's question
          // is "changed since the last review", and a fresh review resets that clock.
          changed ? attemptedAt : (rebaseline ? null : previous?.last_changed_at ?? null), (previous?.change_count ?? 0) + (changed ? 1 : 0),
          JSON.stringify(currentSurface), added ? JSON.stringify(added) : null, removed ? JSON.stringify(removed) : null,
          JSON.stringify(nextBaselineSurface), reviewedAt, profile));
    }
    for (let index = 0; index < statements.length; index += 40) await env.DB.batch(statements.slice(index, index + 40));
    const sources = await syncSourceDrift(env, attemptedAt);
    await env.DB.prepare("INSERT INTO self_audit_runs (attempted_at, status, checked_count, changed_count, error, sources_checked, sources_changed) VALUES (?, 'ok', ?, ?, NULL, ?, ?)")
      .bind(attemptedAt, results.length, changedCount, sources.checked, sources.changed).run();
    return { status: "ok", attempted_at: attemptedAt, checked: results.length, changed: changedCount, sources };
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

  // Freshness is judged per entry from the source hash stored beside each
  // translation — the same hash the build's translation step and its contract use,
  // so the site and the build cannot disagree about what is stale.
  const staleByLocale = Object.entries(localeCoverage).filter(([, c]) => (c.stale_entries || []).length);
  if (staleByLocale.length) {
    const total = staleByLocale.reduce((n, [, c]) => n + c.stale_entries.length, 0);
    findings.push({ check: "localisation_freshness", severity: "warning", detail: `${total} translation(s) across ${staleByLocale.length} locale(s) were made from source text that has since been rewritten; those entries are serving the older wording`, subjects: staleByLocale.flatMap(([locale, c]) => c.stale_entries.slice(0, 6).map(e => `${locale}:${e}`)) });
  }

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
  const current = { tools: new Map(), updates: new Map(), learning: new Map() };
  for (const [kind, seed] of [["tools", CURATED_TOOLS], ["updates", CURATED_UPDATES], ["learning", LEARNING_RESOURCES]]) {
    for (const entry of seed) current[kind].set(entry.id, await entrySourceHash(kind, entry));
  }
  await Promise.all(AUDIT_LOCALES.map(async locale => {
    try {
      const [ecoResponse, learnResponse] = await Promise.all([
        env.ASSETS.fetch(new Request(`${SELF_ORIGIN}/i18n/ecosystem/${locale}.json`)),
        env.ASSETS.fetch(new Request(`${SELF_ORIGIN}/i18n/learning/${locale}.json`)),
      ]);
      if (!ecoResponse.ok || !learnResponse.ok) return;
      const eco = await ecoResponse.json(), learn = await learnResponse.json();
      // Per-entry: which source text each translation was made from. Counting
      // entries proves a translation exists; the hash says whether the English it
      // was made from has since been rewritten — which is its own kind of stale,
      // and the one that shipped an inverted safety caveat in nine languages once.
      const stale = [];
      for (const [kind, table] of [["tools", eco?.translations?.tools], ["updates", eco?.translations?.updates], ["learning", learn?.translations]]) {
        for (const [id, hash] of current[kind]) {
          const stored = table?.[id];
          if (stored && stored.source_hash !== hash) stale.push(`${kind}:${id}`);
        }
      }
      coverage[locale] = {
        tools: Object.keys(eco?.translations?.tools || {}).length,
        updates: Object.keys(eco?.translations?.updates || {}).length,
        learning: Object.keys(learn?.translations || {}).length,
        source_catalog_version: eco?.source_catalog_version ?? null,
        stale_entries: stale,
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
  const [fingerprintRows, latestRun, sourceRows] = await Promise.all([
    env.DB.prepare("SELECT tool_id, url, last_checked_at, last_changed_at, change_count, last_status, last_error, last_surface_added, last_surface_removed FROM tool_content_fingerprints").all(),
    env.DB.prepare("SELECT attempted_at, status, checked_count, changed_count, error, sources_checked, sources_changed FROM self_audit_runs ORDER BY id DESC LIMIT 1").first(),
    env.DB.prepare("SELECT entry_id, kind, url, last_checked_at, last_changed_at, change_count, last_status, last_error FROM source_content_fingerprints").all().catch(() => ({ results: [] })),
  ]);
  const byId = new Map((fingerprintRows.results || []).map(row => [row.tool_id, row]));
  const sourceById = new Map((sourceRows.results || []).map(row => [row.entry_id, row]));

  // The actionable output: a page observably shipped a change after the date we
  // last vouched for its description. Not "this description is wrong" — we cannot
  // know that from a fingerprint — but "a human should read this one again".
  const reviewQueue = [];
  for (const tool of CURATED_TOOLS) {
    // A tool the policy says not to probe cannot honestly be queued by a probe;
    // stale rows from before its profile changed must not keep it flagged.
    if ((tool.drift_profile || "full") === "none") continue;
    const row = byId.get(tool.id);
    if (!row?.last_changed_at) continue;
    const reviewedAt = Date.parse(tool.reviewed_at || "");
    const changedAt = Date.parse(row.last_changed_at);
    if (!Number.isFinite(reviewedAt) || !Number.isFinite(changedAt) || changedAt <= reviewedAt) continue;
    reviewQueue.push({
      kind: "tool", id: tool.id, url: tool.url, title_en: tool.title_en, tier: tool.tier, wallet_risk: tool.wallet_risk,
      reviewed_at: tool.reviewed_at, changed_at: row.last_changed_at, change_count: row.change_count,
      // null, not [], when no comparable predecessor existed — an empty list would
      // claim nothing moved, which is a different statement from not knowing.
      surface_added: row.last_surface_added ? safeList(row.last_surface_added) : null,
      surface_removed: row.last_surface_removed ? safeList(row.last_surface_removed) : null,
    });
  }
  // Sources: the post or page behind a reviewed update or learning resource changed
  // after the review it was baselined on. Same semantics as tools, no label diff.
  const allSources = sourceEntries();
  for (const entry of allSources) {
    const row = sourceById.get(entry.id);
    if (!row?.last_changed_at) continue;
    const reviewedAt = Date.parse(entry.reviewed_at || ""), changedAt = Date.parse(row.last_changed_at);
    if (!Number.isFinite(reviewedAt) || !Number.isFinite(changedAt) || changedAt <= reviewedAt) continue;
    reviewQueue.push({ kind: entry.kind, id: entry.id, url: entry.url, title_en: entry.title_en, reviewed_at: entry.reviewed_at, changed_at: row.last_changed_at, change_count: row.change_count, surface_added: null, surface_removed: null });
  }
  reviewQueue.sort((a, b) => String(b.changed_at).localeCompare(String(a.changed_at)));

  const measuredCoverage = localeCoverage ?? await readLocaleCoverage(env);
  const findings = await catalogueInvariants(env, measuredCoverage);
  // A tool with no fingerprint row at all used to land in none of these buckets:
  // the panel published "17 of 20" alongside two named exclusions, and a reader
  // summing them got 19 with no way to see which tool had never been attempted.
  // Silence read as coverage, which is the exact failure this audit exists to
  // prevent, so an unattempted tool is now named and reported as a finding.
  const notAttempted = CURATED_TOOLS.filter(tool => !byId.has(tool.id)).map(tool => ({ tool_id: tool.id, url: tool.url }));
  const sourceStatus = status => allSources.filter(e => sourceById.get(e.id)?.last_status === status).map(e => ({ entry_id: e.id, kind: e.kind, reason: sourceById.get(e.id)?.last_error || null }));
  const sourcesNotAttempted = allSources.filter(e => !sourceById.has(e.id)).map(e => ({ entry_id: e.id, kind: e.kind }));
  const coverage = {
    tools_fingerprinted: [...byId.values()].filter(row => row.last_status === "ok").length,
    tools_total: CURATED_TOOLS.length,
    skipped: [...byId.values()].filter(row => row.last_status === "skipped").map(row => ({ tool_id: row.tool_id, reason: row.last_error })),
    errored: [...byId.values()].filter(row => row.last_status === "error").map(row => ({ tool_id: row.tool_id, error: row.last_error })),
    not_attempted: notAttempted,
    // The posts and pages behind reviewed updates and learning resources. Buckets sum
    // to sources_total, like the tool buckets above.
    sources: {
      fingerprinted: sourceStatus("ok").length, total: allSources.length,
      skipped: sourceStatus("skipped"), errored: sourceStatus("error"), gone: sourceStatus("gone"), not_attempted: sourcesNotAttempted,
    },
  };
  // A source that no longer publicly exists is an error, not a review prompt: the
  // catalogue is linking readers to nothing.
  if (coverage.sources.gone.length) findings.push({ check: "source_gone", severity: "error", detail: `${coverage.sources.gone.length} catalogued source(s) no longer exist at their URL (explicit not-found from the source); the entries need a person to drop or replace them`, subjects: coverage.sources.gone.map(g => g.entry_id) });
  if (sourcesNotAttempted.length && sourceById.size) findings.push({ check: "fingerprint_coverage", severity: "warning", detail: `${sourcesNotAttempted.length} catalogued source(s) have never been fingerprinted`, subjects: sourcesNotAttempted.map(e => e.entry_id) });
  if (notAttempted.length) {
    findings.push({
      check: "fingerprint_coverage",
      severity: "warning",
      detail: `${notAttempted.length} catalogued tool(s) have never been fingerprinted, so this audit has said nothing about them either way`,
      subjects: notAttempted.map(t => t.tool_id),
    });
  }

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
    boundary: "Where the served HTML exposes headings and navigation, the entry lists which of those labels appeared or disappeared since the entry was last reviewed — observed strings, not an interpretation of what the change means, and blank for a client-rendered app whose shell carries none. Otherwise this detects that a page changed, never what changed or whether our description is now wrong — a human decides that. A tool absent from the queue is not certified current: a server-rendered edit that ships no new build leaves both fingerprints untouched, and non-HTML destinations cannot be fingerprinted at all. Nothing here is automatically written into the catalogue.",
  };
}
