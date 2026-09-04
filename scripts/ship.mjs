// One command from "the tree is ready" to "production is verified serving it".
//
// This is the chain that was run by hand, seven steps at a time, three times in
// one night — and once in the wrong order, deploying before the checks passed.
// A script cannot skip a step it was not written to skip.
//
//   node scripts/ship.mjs -m "commit message"        gate → changelog → scan → commit → push → deploy → verify
//   node scripts/ship.mjs --dry-run                  gate → changelog → scan; report what would ship
//   node scripts/ship.mjs -m "..." --no-deploy       leave deployment to CI (still verifies the push)
//   node scripts/ship.mjs -m "..." --full            also run release_contract_review.sh against the local server
//
// The gate needs a local Worker for the live contracts; if nothing answers on
// :8796 the script starts `wrangler dev --local` itself and stops it afterwards.
import { spawnSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const flag = n => args.includes(n);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const DRY = flag("--dry-run"), NO_DEPLOY = flag("--no-deploy"), FULL = flag("--full");
const message = opt("-m", null);
const LOCAL = "http://127.0.0.1:8796";
const PROD = process.env.SHIP_PROD_ORIGIN || "https://tapeout.work";

const t0 = Date.now();
const log = line => console.log(`[ship +${((Date.now() - t0) / 1000).toFixed(1)}s] ${line}`);
const fail = line => { console.error(`[ship] FAIL ${line}`); process.exit(1); };
const run = (cmd, argv, opts = {}) => spawnSync(cmd, argv, { encoding: "utf8", stdio: opts.quiet ? "pipe" : "inherit", ...opts });
const must = (label, cmd, argv, opts) => { const r = run(cmd, argv, opts); if (r.status !== 0) { if (opts?.quiet) console.error(r.stdout, r.stderr); fail(label); } return r; };

if (!DRY && !message) fail("a commit message is required: -m \"...\" (or use --dry-run)");

// ---- 1. static gate ------------------------------------------------------------
const STATIC = [
  "assert_no_sensitive_info", "test_self_audit_drift", "assert_translation_freshness",
  "assert_global_typography_contract", "assert_learning_layout_contract", "assert_qa_ui_contract",
  "assert_startup_resilience_contract", "assert_official_asset_schedule_contract",
];
const WITH_PWD = ["assert_registry_label_governance_contract", "assert_bem_realtime_scheduler_contract"];
for (const s of STATIC) must(`static gate: ${s}`, "node", [`scripts/${s}.mjs`], { quiet: true }), log(`PASS ${s}`);
for (const s of WITH_PWD) must(`static gate: ${s}`, "node", [`scripts/${s}.mjs`, process.cwd()], { quiet: true }), log(`PASS ${s}`);

// ---- 2. live gate (local Worker) -----------------------------------------------
const alive = async url => { try { const r = await fetch(url, { signal: AbortSignal.timeout(3000) }); return r.ok; } catch { return false; } };
let devProcess = null;
if (!(await alive(`${LOCAL}/api/v1/tools?page_size=1`))) {
  log("no local Worker on :8796 — starting wrangler dev --local");
  devProcess = spawn("npx", ["wrangler", "dev", "--port", "8796", "--local"], { stdio: "ignore", detached: true });
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline && !(await alive(`${LOCAL}/api/v1/tools?page_size=1`))) await new Promise(r => setTimeout(r, 2000));
  if (!(await alive(`${LOCAL}/api/v1/tools?page_size=1`))) { devProcess.kill(); fail("local Worker did not come up within 90s"); }
}
const stopDev = () => { if (devProcess) { try { process.kill(-devProcess.pid); } catch { try { devProcess.kill(); } catch {} } } };
process.on("exit", stopDev);
const LIVE = ["assert_curated_ecosystem_contract", "assert_api_i18n_contract"];
for (const s of LIVE) must(`live gate: ${s}`, "node", [`scripts/${s}.mjs`, LOCAL], { quiet: true }), log(`PASS ${s}`);
if (FULL) must("release_contract_review.sh", "bash", ["release_contract_review.sh", LOCAL]), log("PASS release_contract_review.sh");
stopDev(); devProcess = null;

// ---- 3. derived assets + scan --------------------------------------------------
must("build_changelog", "node", ["scripts/build_changelog.mjs"], { quiet: true }); log("built public/changelog.json");
must("sensitive-info scan (post-build)", "node", ["scripts/assert_no_sensitive_info.mjs"], { quiet: true }); log("PASS sensitive-info scan");

// ---- 4. what would ship --------------------------------------------------------
const seed = readFileSync("src/curated_ecosystem_seed.js", "utf8");
const catalogVersion = (seed.match(/ECOSYSTEM_CATALOG_VERSION = "([^"]+)"/) || [])[1];
const cacheVersion = (readFileSync("public/index.html", "utf8").match(/features-r\d+/) || [])[0];
const status = run("git", ["status", "--porcelain"], { quiet: true }).stdout.trim();
log(`catalogue ${catalogVersion} · cache ${cacheVersion} · ${status ? status.split("\n").length + " changed file(s)" : "tree clean"}`);
if (DRY) { console.log(status || "(nothing to commit)"); log("dry run complete — nothing committed, pushed or deployed"); process.exit(0); }

// ---- 5. commit, push -----------------------------------------------------------
if (status) {
  must("git add", "git", ["add", "-A"], { quiet: true });
  must("git commit", "git", ["commit", "-q", "-m", message], { quiet: true });
  log(`committed: ${run("git", ["log", "--oneline", "-1"], { quiet: true }).stdout.trim()}`);
} else log("nothing to commit; shipping HEAD as-is");
must("git push origin main", "git", ["push", "origin", "main"], { quiet: true }); log("pushed origin/main");

// ---- 6. deploy -----------------------------------------------------------------
if (NO_DEPLOY) log("--no-deploy: leaving deployment to CI");
else { must("wrangler deploy", "npx", ["wrangler", "deploy"], { quiet: true }); log("deployed"); }

// ---- 7. verify production ------------------------------------------------------
const checks = [];
// A nonce on every verification URL sidesteps the edge cache (which is keyed by
// full URL) so the check measures the deploy, not a copy from before it.
const nonce = `ship_nonce=${Date.now().toString(36)}`;
const get = async (p, as = "text") => { const r = await fetch(`${PROD}${p}${p.includes("?") ? "&" : "?"}${nonce}`, { signal: AbortSignal.timeout(15000), headers: { "cache-control": "no-cache" } }); return { status: r.status, body: as === "json" ? await r.json().catch(() => null) : await r.text() }; };
const deadline = Date.now() + (NO_DEPLOY ? 240_000 : 90_000);
let ok = false;
while (Date.now() < deadline && !ok) {
  checks.length = 0;
  const home = await get("/"); checks.push(["/ serves current cache version", home.status === 200 && home.body.includes(cacheVersion)]);
  const tools = await get("/api/v1/tools?page_size=1", "json"); checks.push(["/api/v1/tools serves current catalogue", tools.status === 200 && tools.body?.catalog_version === catalogVersion]);
  const ko = await get("/i18n/ecosystem/ko.json", "json"); checks.push(["ko locale stamped with current catalogue", ko.status === 200 && ko.body?.source_catalog_version === catalogVersion]);
  for (const p of ["/api/v1/self-audit", "/api/v1/data-health", "/api/v1/changelog", "/api/v1/official-assets/overview", "/api/v1/official-assets/addresses?view=mints&page_size=1", "/api/v1/bem/trades", "/api/v1/tools?locale=ko&page_size=1"]) { const r = await get(p, "json"); checks.push([`${p} responds 200`, r.status === 200]); }
  ok = checks.every(([, pass]) => pass);
  if (!ok) await new Promise(r => setTimeout(r, 10_000));
}
for (const [label, pass] of checks) console.log(`  ${pass ? "PASS" : "FAIL"} ${label}`);
if (!ok) fail("production verification did not converge — the push/deploy went out; investigate before shipping again");
log(`production verified: ${PROD} serving ${catalogVersion} / ${cacheVersion}`);

// Every check above carries a cache-busting nonce, so none of them can see what an
// ordinary reader's un-nonced GET is served. That blind spot let a four-hour browser
// cache sit on the freshness endpoints for a day (2026-09-04). This contract fetches
// the real URLs, so it runs here, against production, on the way out.
must("freshness/no-store contract (production)", "node", ["scripts/assert_freshness_recovery_contract.mjs", PROD], { quiet: true });
log("PASS assert_freshness_recovery_contract (production)");
