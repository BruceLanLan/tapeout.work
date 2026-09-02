// Applies human-approved review files to the catalogue seed. The only writer of
// catalogue text in the automation loop, and it acts only on files whose status a
// person changed to `approved` (text from the file's last JSON block) or
// `revouch` (no text change; refresh the review date). Bumps the catalogue
// version, moves the file to reviews/applied/ as the audit trail, and tells you
// the next command. It never translates and never ships.
import { readdirSync, readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from "node:fs";

const PENDING = new URL("../reviews/pending/", import.meta.url).pathname;
const APPLIED = new URL("../reviews/applied/", import.meta.url).pathname;
const SEED = new URL("../src/curated_ecosystem_seed.js", import.meta.url).pathname;
mkdirSync(APPLIED, { recursive: true });

const files = existsSync(PENDING) ? readdirSync(PENDING).filter(f => f.endsWith(".md")) : [];
const frontmatter = text => Object.fromEntries((text.match(/^---\n([\s\S]*?)\n---/) || ["", ""])[1].split("\n").map(l => l.split(/:\s(.*)/)).filter(p => p[0]).map(([k, v]) => [k.trim(), (v ?? "").trim()]));
const lastJsonBlock = text => { const blocks = [...text.matchAll(/```json\n([\s\S]*?)\n```/g)]; return blocks.length ? JSON.parse(blocks[blocks.length - 1][1]) : null; };
const jsLiteral = s => JSON.stringify(s);

let seed = readFileSync(SEED, "utf8");
const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
let applied = 0;
for (const file of files) {
  const text = readFileSync(PENDING + file, "utf8");
  const fm = frontmatter(text);
  if (!["approved", "revouch", "approved-new"].includes(fm.status)) continue;
  const id = fm.id;
  if (fm.status === "approved-new") {
    // A candidate becoming an entry: the JSON block must carry the full evidence
    // record; the same fields the contract asserts on every existing tool.
    const json = lastJsonBlock(text);
    const required = ["id", "wallet_risk", "category", "tier", "operator", "url", "original_language", "title_en", "title_zh", "summary_en", "summary_zh", "use_cases", "safety_en", "safety_zh"];
    const missing = required.filter(k => json?.[k] == null || json[k] === "");
    if (missing.length) { console.error(`SKIP ${file}: approved-new but missing ${missing.join(", ")}`); continue; }
    if (seed.includes(`id: "${json.id}"`)) { console.error(`SKIP ${file}: ${json.id} already exists in seed`); continue; }
    const entry = ["  {", ...required.map(k => `    ${k}: ${jsLiteral(json[k])},`), `    reviewed_at: "${now}",`, ...(json.drift_profile ? [`    drift_profile: ${jsLiteral(json.drift_profile)},`] : []), "  }"].join("\n");
    const toolsStart = seed.indexOf("export const CURATED_TOOLS");
    const close = seed.indexOf("\n]);", toolsStart);
    seed = seed.slice(0, close) + ",\n" + entry + seed.slice(close);
    renameSync(PENDING + file, `${APPLIED}${now.slice(0, 10)}-${file}`);
    console.log(`ADDED ${json.id} (reviewed_at ${now})`);
    applied++;
    continue;
  }
  const start = seed.indexOf(`id: "${id}"`);
  if (start < 0) { console.error(`SKIP ${file}: ${id} not in seed`); continue; }
  const end = seed.indexOf("\n  {", start) > 0 ? seed.indexOf("\n  {", start) : seed.indexOf("\n]);", start);
  let block = seed.slice(start, end);
  if (fm.status === "approved") {
    const json = lastJsonBlock(text);
    if (!json || typeof json.summary_en !== "string" || typeof json.summary_zh !== "string") { console.error(`SKIP ${file}: approved but no JSON block with summary_en and summary_zh`); continue; }
    if (json.verdict && json.verdict !== "revise") { console.error(`SKIP ${file}: approved but verdict is "${json.verdict}" — use status: revouch for no text change`); continue; }
    block = block.replace(/summary_en: "(?:[^"\\]|\\.)*"/, `summary_en: ${jsLiteral(json.summary_en.trim())}`)
                 .replace(/summary_zh: "(?:[^"\\]|\\.)*"/, `summary_zh: ${jsLiteral(json.summary_zh.trim())}`);
  }
  block = block.replace(/reviewed_at: "[^"]*"/, `reviewed_at: "${now}"`);
  seed = seed.slice(0, start) + block + seed.slice(end);
  renameSync(PENDING + file, `${APPLIED}${now.slice(0, 10)}-${file}`);
  console.log(`${fm.status === "approved" ? "APPLIED" : "REVOUCHED"} ${id} (reviewed_at ${now})`);
  applied++;
}
if (!applied) { console.log("nothing to apply: no pending review has status approved or revouch"); process.exit(0); }
// Catalogue version: today's date plus the next letter.
const today = now.slice(0, 10);
seed = seed.replace(/ECOSYSTEM_CATALOG_VERSION = "(\d{4}-\d{2}-\d{2})([a-z])"/, (_, d, l) => `ECOSYSTEM_CATALOG_VERSION = "${d === today ? today + String.fromCharCode(l.charCodeAt(0) + 1) : today + "a"}"`);
writeFileSync(SEED, seed);
console.log(`catalogue version → ${(seed.match(/ECOSYSTEM_CATALOG_VERSION = "([^"]+)"/) || [])[1]}`);
console.log("next: node scripts/translate_catalog.mjs   then   node scripts/ship.mjs -m \"content: ...\"");
