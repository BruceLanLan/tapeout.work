// Run before every push to the public repo. Scans the current working tree
// (not git history — this is a fast, cheap net for new changes, not a
// forensic history audit) for strings that would connect this public,
// pseudonymous project to information it must never carry: any reference to
// NANDPU, or personal identifiers not meant for public attribution here.
//
// This is a working-tree grep, not a secrets scanner: it will not catch
// something already merged into history, and it is not a substitute for
// reviewing an actual diff before pushing. It exists to catch the exact
// mistake this project made once (an incidental code comment and a commit
// message that both referenced NANDPU) before it happens again.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2] || process.cwd();
const SELF = "scripts/assert_no_sensitive_info.mjs"; // contains the patterns themselves; would always self-match
const SKIP_DIRS = new Set([".git", "node_modules", ".wrangler"]);
const FORBIDDEN = [
  { pattern: /nandpu/i, label: "NANDPU reference" },
  { pattern: /lanzhihao/i, label: "personal Gmail-derived identifier" },
  { pattern: /lanzhihao1986@gmail\.com/i, label: "personal email address" },
];

function walk(dir, hits) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) { walk(full, hits); continue; }
    if (full.replace(root + "/", "") === SELF) continue;
    if (stat.size > 2_000_000) continue; // skip anything unusually large (binaries, etc.)
    let content;
    try { content = readFileSync(full, "utf8"); } catch { continue; } // skip non-UTF8/binary files
    for (const { pattern, label } of FORBIDDEN) {
      if (pattern.test(content)) hits.push({ file: full.replace(root + "/", ""), label });
    }
  }
}

const hits = [];
walk(root, hits);
if (hits.length) {
  console.error("BLOCKED: sensitive-info scan found matches that must not reach the public repo:");
  for (const hit of hits) console.error(`  ${hit.file} — ${hit.label}`);
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, scanned_root: root, forbidden_patterns: FORBIDDEN.length }, null, 2));
