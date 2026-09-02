// The scheduled entry point of the automation loop: review queue → evidence →
// drafts → applied revisions → translations → gate → one pull request.
//
// Merging that pull request is the human approval the loop is built around.
// Everything before it is automatic; nothing after it needs a person (the
// deploy workflow runs on merge). The PR body carries the evidence inline —
// verdict, before/after text, the cited excerpt lines quoted — so it can be
// judged from a phone without opening files.
//
//   node scripts/maintain.mjs               queue → PR (default)
//   node scripts/maintain.mjs --dry-run     everything except push and PR; branch left for inspection
//   node scripts/maintain.mjs --direct      ship to main via ship.mjs instead of a PR (no human gate)
//   --tool <id> (repeatable)  review these instead of the queue
//   --stale                    also tools whose review is older than 30 days
//   --limit <n>                cap tools per run (default 5) — the per-run cost bound
//   --model <alias>            default sonnet;   CLAUDE_BIN  path to the claude CLI
//
// Cost bound: an empty queue makes zero model calls. Each reviewed tool costs
// roughly $0.1–1 for the draft plus about $1–4 if its entry changes and nine
// locales must be retranslated.
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync, rmSync } from "node:fs";

const args = process.argv.slice(2);
const flag = n => args.includes(n);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const DRY = flag("--dry-run"), DIRECT = flag("--direct");
const LIMIT = Number(opt("--limit", 5));
const ORIGIN = process.env.SHIP_PROD_ORIGIN || "https://tapeout.work";
const BRANCH = "auto/catalogue-review";
const MAX_PR_AGE_DAYS = 3;
const t0 = Date.now();
const log = m => console.log(`[maintain +${((Date.now() - t0) / 1000).toFixed(0)}s] ${m}`);
const fail = m => { console.error(`[maintain] FAIL ${m}`); process.exit(1); };
const sh = (cmd, argv, opts = {}) => spawnSync(cmd, argv, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024, ...opts });
const must = (label, cmd, argv, opts) => { const r = sh(cmd, argv, opts); if (r.status !== 0) { console.error(r.stdout, r.stderr); fail(label); } return r; };
const git = (...argv) => sh("git", argv).stdout.trim();

// ---- preconditions ---------------------------------------------------------------
if (git("status", "--porcelain")) fail("working tree is not clean");
if (git("branch", "--show-current") !== "main") fail("not on main");
must("git fetch", "git", ["fetch", "origin", "--prune"], { stdio: "pipe" });
if (git("rev-parse", "HEAD") !== git("rev-parse", "origin/main")) fail("main is not at origin/main — pull or push first");

// Single in-flight PR: never stack, never force-push over one a person may be reading.
if (!DRY) {
  const open = JSON.parse(sh("gh", ["pr", "list", "--head", BRANCH, "--state", "open", "--json", "number,createdAt,url"]).stdout || "[]");
  if (open.length) {
    const ageDays = (Date.now() - Date.parse(open[0].createdAt)) / 86400000;
    if (ageDays < MAX_PR_AGE_DAYS) { log(`PR #${open[0].number} is open (${ageDays.toFixed(1)}d) — nothing done: ${open[0].url}`); process.exit(0); }
    // Older than the bound: its reviewed_at stamps would drift too far from the merge.
    must("close stale PR", "gh", ["pr", "close", String(open[0].number), "--delete-branch", "--comment", `Superseded: older than ${MAX_PR_AGE_DAYS} days, regenerating so review dates stay close to the merge.`]);
    log(`closed stale PR #${open[0].number}`);
  }
}

// ---- targets ---------------------------------------------------------------------
const audit = await fetch(`${ORIGIN}/api/v1/self-audit`).then(r => r.json()).catch(() => null);
if (!audit) fail("self-audit unreachable");
const named = args.flatMap((a, i) => a === "--tool" ? [args[i + 1]] : []);
let targets = named.length ? named : (audit.review_queue || []).map(q => q.id);
if (!named.length && flag("--stale")) for (const f of audit.findings || []) if (f.check === "review_age") targets.push(...(f.subjects || []));
targets = [...new Set(targets)].slice(0, LIMIT);
if (!targets.length) { log("review queue empty — nothing to do (no model calls made)"); process.exit(0); }
log(`reviewing ${targets.length}: ${targets.join(", ")}`);

// ---- drafts ----------------------------------------------------------------------
rmSync("reviews/pending/_run.json", { force: true });
must("review_drafts", "node", ["scripts/review_drafts.mjs", ...targets.flatMap(id => ["--tool", id]), "--model", opt("--model", "sonnet"), "--origin", ORIGIN], { stdio: "inherit" });
const run = JSON.parse(readFileSync("reviews/pending/_run.json", "utf8"));
let cost = run.tools.reduce((n, t) => n + (t.cost_usd || 0), 0);

// Decide what the PR will carry. A draft that is unverifiable or has invalid
// citations stays pending for a person; it is reported, never applied.
const decisions = [];
for (const t of run.tools) {
  let action = "left pending";
  if (t.status === "draft" && t.verdict === "still_accurate") action = "revouch";
  else if (t.status === "draft" && t.verdict === "revise" && !t.invalid && t.summary_en_after && t.summary_zh_after) {
    // A revision that shrinks the entry has probably dropped a claim on thin
    // evidence; that judgement belongs to a person, not to this script.
    action = t.summary_en_after.length < t.summary_en_before.length * 0.85 ? "left pending (revision removes content)" : "approved";
  }
  decisions.push({ ...t, action });
  if (!action.startsWith("left pending")) {
    const file = `reviews/pending/${t.id}.md`;
    const text = readFileSync(file, "utf8").replace(/^status: draft$/m, `status: ${action}`);
    must("mark review", "node", ["-e", "require('fs').writeFileSync(process.argv[1], process.argv[2])", file, text]);
  }
}
const applying = decisions.filter(d => !d.action.startsWith("left pending"));
if (!applying.length) { log("no draft qualified for automatic application; drafts left in reviews/pending/ for a person"); process.exit(0); }

// ---- branch, apply, translate, gate ----------------------------------------------
sh("git", ["branch", "-D", BRANCH]);
must("branch", "git", ["checkout", "-q", "-b", BRANCH]);
must("apply_reviews", "node", ["scripts/apply_reviews.mjs"], { stdio: "inherit" });
let tr = sh("node", ["scripts/translate_catalog.mjs"], { env: process.env });
if (tr.status !== 0 && !/translated \d+/.test(tr.stdout)) { log("translate step crashed; retrying once"); console.error((tr.stderr || "").replace(/SessionEnd hook[^\n]*/g, "").slice(0, 600)); tr = sh("node", ["scripts/translate_catalog.mjs"], { env: process.env }); }
process.stdout.write(tr.stdout);
if (tr.status !== 0 && !/translated \d+/.test(tr.stdout)) console.error("translate step failed twice:\n" + (tr.stderr || "").replace(/SessionEnd hook[^\n]*/g, "").slice(0, 600));
const trSummary = (tr.stdout.match(/translated (\d+), rejected (\d+), cost ≈ \$([\d.]+)/) || []);
const rejected = [...tr.stdout.matchAll(/REJECTED ([^\n]+)/g)].map(m => m[1]);
cost += Number(trSummary[3] || 0);
const GATE = ["assert_no_sensitive_info", "test_self_audit_drift", "assert_translation_freshness", "assert_global_typography_contract", "assert_learning_layout_contract", "assert_qa_ui_contract", "assert_startup_resilience_contract", "assert_official_asset_schedule_contract"];
const gate = [];
for (const s of GATE) { const r = sh("node", [`scripts/${s}.mjs`]); gate.push([s, r.status === 0]); }
for (const s of ["assert_registry_label_governance_contract", "assert_bem_realtime_scheduler_contract"]) { const r = sh("node", [`scripts/${s}.mjs`, process.cwd()]); gate.push([s, r.status === 0]); }
const gateOk = gate.every(([, ok]) => ok);
must("build_changelog", "node", ["scripts/build_changelog.mjs"]);
log(`gate ${gateOk ? "green" : "RED"}; translations: ${trSummary[1] ?? "?"} written, ${rejected.length} rejected; cost ≈ $${cost.toFixed(2)}`);

// ---- PR body ---------------------------------------------------------------------
const catalogVersion = (readFileSync("src/curated_ecosystem_seed.js", "utf8").match(/ECOSYSTEM_CATALOG_VERSION = "([^"]+)"/) || [])[1];
const body = [];
body.push(`Automated catalogue review — catalogue → ${catalogVersion}. **Merging this PR is the human review**: the reviewed_at stamps inside read as the date the drafts were made (${run.generated_at.slice(0, 16)}Z); this PR is regenerated if it stays open more than ${MAX_PR_AGE_DAYS} days so that date never drifts far from the merge.`, "");
body.push(`Gate: ${gateOk ? "green" : "**RED** — do not merge until fixed"} · translations: ${trSummary[1] ?? "?"} written, ${rejected.length} rejected · model cost ≈ $${cost.toFixed(2)}`, "");
for (const d of decisions) {
  body.push(`## ${d.title_en} (\`${d.id}\`) — ${d.action.startsWith("left pending") ? d.action.replace("left pending", "left for a person") : d.action}`);
  body.push(`Fetched via ${d.fetch_path ?? "nothing (unverifiable)"}, ${d.excerpt_lines} excerpt lines · verdict **${d.verdict ?? "none"}**${d.invalid ? ` (invalid: ${d.invalid})` : ""} · $${(d.cost_usd || 0).toFixed(2)}`);
  if (d.queued) body.push(`Self-audit: page changed ${d.queued.changed_at}, entry reviewed ${d.queued.reviewed_at}.`);
  if (d.rationale) body.push("", `> ${d.rationale.replace(/\n/g, " ")}`);
  if (d.action === "approved") body.push("", "**summary_en before**", "", d.summary_en_before, "", "**summary_en after**", "", d.summary_en_after);
  if (d.cited_lines?.length) body.push("", "**Cited excerpt lines**", "", "```text", ...d.cited_lines.map(l => `${String(l.n).padStart(3)}| ${l.text}`), "```");
  body.push("");
}
if (rejected.length) body.push("## Translations refused by the verifier (entry stays on older wording until a person fixes it)", "", ...rejected.map(r => `- ${r}`), "");
body.push("## Gate", "", ...gate.map(([s, ok]) => `- ${ok ? "PASS" : "FAIL"} ${s}`), "");
body.push("Evidence files for the applied reviews are committed under `reviews/applied/`.", "", "🤖 Generated with [Claude Code](https://claude.com/claude-code)");
const prBody = body.join("\n");
const title = `catalogue review: ${applying.map(d => `${d.id.replace(/^tool-/, "")} ${d.action}`).join(", ")}`.slice(0, 120);

must("git add", "git", ["add", "-A"]);
must("git commit", "git", ["commit", "-q", "-m", `${title}\n\nAutomated by scripts/maintain.mjs; evidence in reviews/applied/ and in the pull request body.`]);
if (DRY) {
  console.log("\n===== PR body (dry run) =====\n" + prBody);
  must("back to main", "git", ["checkout", "-q", "main"]);
  log(`dry run complete — branch ${BRANCH} left with the commit; nothing pushed`);
  process.exit(gateOk ? 0 : 1);
}
if (DIRECT) {
  must("back to main", "git", ["checkout", "-q", "main"]);
  must("merge", "git", ["merge", "--ff-only", BRANCH]);
  must("ship", "node", ["scripts/ship.mjs", "-m", "unused"], { stdio: "inherit" });
  process.exit(0);
}
must("push", "git", ["push", "--force-with-lease", "-u", "origin", BRANCH]);
const pr = must("gh pr create", "gh", ["pr", "create", "--base", "main", "--head", BRANCH, "--title", title, "--body", prBody]);
must("back to main", "git", ["checkout", "-q", "main"]);
log(`opened ${pr.stdout.trim()}`);
