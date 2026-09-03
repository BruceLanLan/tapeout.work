// Deploy-on-merge without a CI token: this machine already holds a wrangler
// login, so it watches origin/main and deploys whatever lands there.
//
// Every run: fetch; if origin/main moved past the last deployed commit and the
// working tree is clean, fast-forward, run the static gate, deploy, verify
// production, and record the commit. Any failure leaves the marker untouched so
// the next run retries. Meant for launchd every 10 minutes; also runnable by hand.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const MARKER = new URL("../.deploy_watch_last", import.meta.url).pathname;
const t0 = Date.now();
const log = m => console.log(`[deploy-watch +${((Date.now() - t0) / 1000).toFixed(0)}s ${new Date().toISOString()}] ${m}`);
const sh = (cmd, argv, opts = {}) => spawnSync(cmd, argv, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024, ...opts });
const git = (...argv) => sh("git", argv).stdout.trim();

if (git("status", "--porcelain")) { log("working tree dirty — a person is mid-change; skipping"); process.exit(0); }
if (git("branch", "--show-current") !== "main") { log("not on main; skipping"); process.exit(0); }
if (sh("git", ["fetch", "origin", "--prune"]).status !== 0) { log("fetch failed; will retry next run"); process.exit(0); }
const remote = git("rev-parse", "origin/main");
const last = existsSync(MARKER) ? readFileSync(MARKER, "utf8").trim() : "";
if (remote === last) { log(`origin/main ${remote.slice(0, 7)} already deployed`); process.exit(0); }
if (git("rev-parse", "HEAD") !== remote) {
  if (sh("git", ["merge", "--ff-only", "origin/main"]).status !== 0) { log("local main has diverged from origin; not touching it"); process.exit(0); }
}
log(`new commit ${remote.slice(0, 7)} on origin/main — gating`);
const GATE = ["assert_no_sensitive_info", "test_self_audit_drift", "assert_translation_freshness", "assert_global_typography_contract", "assert_learning_layout_contract", "assert_qa_ui_contract", "assert_startup_resilience_contract", "assert_official_asset_schedule_contract"];
for (const s of GATE) { const r = sh("node", [`scripts/${s}.mjs`]); if (r.status !== 0) { log(`gate failed: ${s}\n${(r.stdout + r.stderr).slice(-600)}`); process.exit(1); } }
for (const s of ["assert_registry_label_governance_contract", "assert_bem_realtime_scheduler_contract"]) { const r = sh("node", [`scripts/${s}.mjs`, process.cwd()]); if (r.status !== 0) { log(`gate failed: ${s}`); process.exit(1); } }
sh("node", ["scripts/build_changelog.mjs"]);
const deploy = sh("npx", ["wrangler", "deploy"]);
if (deploy.status !== 0) { log(`wrangler deploy failed:\n${(deploy.stdout + deploy.stderr).slice(-800)}`); process.exit(1); }
// Verify: production must serve this commit's catalogue and cache version.
const want = (readFileSync("src/curated_ecosystem_seed.js", "utf8").match(/ECOSYSTEM_CATALOG_VERSION = "([^"]+)"/) || [])[1];
const cache = (readFileSync("public/index.html", "utf8").match(/features-r\d+/) || [])[0];
let ok = false;
for (let i = 0; i < 12 && !ok; i++) {
  try {
    const tools = await (await fetch(`https://tapeout.work/api/v1/tools?page_size=1&dw=${Date.now()}`)).json();
    const home = await (await fetch(`https://tapeout.work/?dw=${Date.now()}`)).text();
    ok = tools.catalog_version === want && home.includes(cache);
  } catch {}
  if (!ok) await new Promise(r => setTimeout(r, 10_000));
}
if (!ok) { log(`deployed ${remote.slice(0, 7)} but production did not converge on ${want}/${cache}`); process.exit(1); }
writeFileSync(MARKER, remote + "\n");
log(`deployed and verified ${remote.slice(0, 7)} — ${want} / ${cache}`);
