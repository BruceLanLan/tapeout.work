// Run before every push to the public repo. Scans the current working tree
// (not git history — this is a fast, cheap net for new changes, not a
// forensic history audit) for a short list of strings that must never
// appear in this public repo: identifiers of unrelated projects and people
// this repo's operator is associated with, and personal contact details.
//
// This is a working-tree grep, not a secrets scanner: it will not catch
// something already merged into history, and it is not a substitute for
// reviewing an actual diff before pushing.
//
// The forbidden strings are base64-encoded here on purpose, not as
// security through obscurity (this script's logic is public either way)
// but so this file itself never contains the plaintext of the exact
// strings it exists to keep out of a public repo — a script whose own
// source spells out the sensitive word defeats its own purpose the moment
// it's pushed.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2] || process.cwd();
const SKIP_DIRS = new Set([".git", "node_modules", ".wrangler"]);
const decode = (b64) => Buffer.from(b64, "base64").toString("utf8");
const FORBIDDEN = [
  { encoded: "TkFORFBV", label: "unrelated-project reference" }, // decodes to a specific project codename
  { encoded: "bGFuemhpaGFv", label: "personal identifier" }, // decodes to an email-derived personal identifier
].map(({ encoded, label }) => ({ pattern: new RegExp(decode(encoded), "i"), label }));

function walk(dir, hits) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) { walk(full, hits); continue; }
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
