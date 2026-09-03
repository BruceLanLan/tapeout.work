// Turns the self-audit review queue into evidence-backed review files a human can
// approve, instead of pages a human has to go and re-read from scratch.
//
// For each tool the site says needs a second look (or one named with --tool), it
// fetches the page as served today, records a numbered excerpt of what it saw,
// checks each sentence of the catalogue entry against that excerpt, and — unless
// --no-llm — asks a model for a proposed revision that must cite excerpt line
// numbers. A citation that does not resolve to a recorded line invalidates the
// draft. When no fetch path returns content, the file says "unverifiable this
// round" and proposes nothing. Nothing here changes the catalogue: that is
// apply_reviews.mjs, and it only acts on files a human has marked approved.
//
//   node scripts/review_drafts.mjs                 everything in the production review queue
//   node scripts/review_drafts.mjs --tool <id>     one tool, queued or not
//   node scripts/review_drafts.mjs --stale         also tools whose review is older than 30 days
//   --no-llm         evidence + claim check only
//   --model <alias>  default sonnet     CLAUDE_BIN  path to claude CLI
//   --origin <url>   default https://tapeout.work
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { CURATED_TOOLS } from "../src/curated_ecosystem_seed.js";

const args = process.argv.slice(2);
const flag = n => args.includes(n);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const ORIGIN = opt("--origin", "https://tapeout.work");
const MODEL = opt("--model", "sonnet");
const CLAUDE_BIN = process.env.CLAUDE_BIN || "claude";
const OUT_DIR = new URL("../reviews/pending/", import.meta.url).pathname;
const UA = "tapeout.work-catalogue-review/1.0 (+https://tapeout.work)";
const EXCERPT_MAX_LINES = 220, EXCERPT_MAX_CHARS = 22_000;

// ---- which tools -----------------------------------------------------------------
let targets = [];
const audit = await fetch(`${ORIGIN}/api/v1/self-audit`).then(r => r.json()).catch(() => null);
const queue = new Map((audit?.review_queue || []).map(q => [q.id, q]));
const named = args.flatMap((a, i) => a === "--tool" ? [args[i + 1]] : []);
if (named.length) targets = named;
else {
  targets = [...queue.keys()];
  if (flag("--stale")) for (const f of audit?.findings || []) if (f.check === "review_age") targets.push(...(f.subjects || []));
}
targets = [...new Set(targets)].filter(id => CURATED_TOOLS.some(t => t.id === id));
const limit = Number(opt("--limit", 0)); if (limit > 0) targets = targets.slice(0, limit);
if (!targets.length) { console.log("nothing to review: queue empty" + (audit ? "" : " (self-audit unreachable)")); process.exit(0); }

// ---- fetch paths -----------------------------------------------------------------
const stripHtml = html => html.replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<style\b[\s\S]*?<\/style>/gi, " ")
  .replace(/<\/(p|div|li|h[1-6]|tr|section|article|nav|header|footer|br)>/gi, "\n").replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const toLines = text => text.split("\n").map(l => l.replace(/\s+/g, " ").trim()).filter(l => l.length > 2);
async function viaJina(url) {
  const r = await fetch(`https://r.jina.ai/${url}`, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(90_000) });
  if (!r.ok) throw new Error(`jina HTTP ${r.status}`);
  const text = await r.text();
  const body = text.split(/\nMarkdown Content:\n/)[1] ?? text;
  const lines = toLines(body);
  if (lines.length < 3) throw new Error("jina returned no body");
  return lines;
}
function viaChrome(url) {
  const chrome = process.env.CHROME_BIN || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const r = spawnSync(chrome, ["--headless=new", "--disable-gpu", "--no-sandbox", "--window-size=1600,12000", "--virtual-time-budget=30000",
    "--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36", "--dump-dom", url],
    { encoding: "utf8", timeout: 120_000, maxBuffer: 32 * 1024 * 1024 });
  if (r.status !== 0 || !r.stdout) throw new Error("chrome produced no DOM");
  if (/Attention Required! \| Cloudflare|Just a moment/i.test(r.stdout)) throw new Error("chrome hit a Cloudflare challenge");
  const lines = toLines(stripHtml(r.stdout));
  if (lines.length < 3) throw new Error("chrome DOM had no text");
  return lines;
}
async function fetchOne(url) {
  const attempts = [["r.jina.ai", () => viaJina(url)], ["headless chrome", () => viaChrome(url)]];
  const errors = [];
  for (const [name, fn] of attempts) {
    try { const lines = await fn(); return { path: name, lines, errors }; }
    catch (e) { errors.push(`${name}: ${e.message}`); }
  }
  return { path: null, lines: [], errors };
}
// An entry that describes sub-pages (/circuits, /mining, ...) cannot be judged from
// the root alone — the first dry run returned a 24-line FAQ for a site whose entry
// is about three other sections. Fetch every path the entry itself names.
function namedPaths(tool) {
  const text = `${tool.summary_en} ${tool.summary_zh}`;
  // Two-letter minimum and no trailing "*" — "b*" in an entry about hashpower is a
  // formula symbol, not a route (the first run fetched tapeout.vip/b because of it).
  return [...new Set((text.match(/(?<![\w.])\/[a-z][a-z0-9-]{2,}(?:\/[a-z0-9-]+)*(?![\w*])/g) || []))].slice(0, 6);
}
async function fetchExcerpt(url, tool) {
  const root = await fetchOne(url);
  let lines = root.lines, path = root.path; const errors = [...root.errors];
  for (const sub of namedPaths(tool)) {
    const target = new URL(sub, url).toString();
    const r = await fetchOne(target);
    if (r.path) { lines = [...lines, `=== ${sub} ===`, ...r.lines]; path = path ? `${path} (+${sub})` : `${r.path} (${sub})`; }
    else errors.push(...r.errors.map(e => `${sub}: ${e}`));
  }
  return { path, lines: cap(lines), errors };
}
const cap = lines => { const out = []; let chars = 0; for (const l of lines) { if (out.length >= EXCERPT_MAX_LINES || chars + l.length > EXCERPT_MAX_CHARS) break; out.push(l.slice(0, 400)); chars += l.length; } return out; };

// ---- claim check (mechanical) ----------------------------------------------------
const STOP = new Set(["that", "this", "with", "from", "into", "than", "then", "when", "which", "where", "while", "their", "there", "these", "those", "have", "been", "were", "also", "only", "rather", "each", "every", "such", "same", "other", "about", "over", "under", "after", "before", "between", "against", "through", "without", "within", "site", "page", "tool", "tools", "user", "users"]);
// Latin tokens of 4+ chars, plus CJK bigrams so Chinese pages and the zh summary
// can be matched too — most catalogued sites serve Chinese UI text.
const tokens = s => {
  const latin = (s.toLowerCase().match(/[a-z0-9$][a-z0-9$./-]{3,}/g) || []).filter(t => !STOP.has(t));
  const cjk = []; for (const run of s.match(/[\u4e00-\u9fff]{2,}/g) || []) for (let i = 0; i + 1 < run.length; i++) cjk.push(run.slice(i, i + 2));
  return [...new Set([...latin, ...cjk])];
};
function claimCheck(summary, lines) {
  const sentences = summary.split(/(?<=[.!?。！？])\s*(?=[A-Z"“(\u4e00-\u9fff「])/).map(s => s.trim()).filter(Boolean);
  const lineTokens = lines.map(tokens);
  return sentences.map(sentence => {
    const st = tokens(sentence);
    let best = { line: 0, hits: [] };
    lineTokens.forEach((lt, i) => { const hits = st.filter(t => lt.includes(t)); if (hits.length > best.hits.length) best = { line: i + 1, hits }; });
    const ratio = st.length ? best.hits.length / st.length : 0;
    const status = best.hits.length >= 3 || ratio >= 0.4 ? "supported" : best.hits.length >= 1 ? "weak" : "no match";
    return { sentence, line: best.line, hits: best.hits, status };
  });
}

// ---- model draft -----------------------------------------------------------------
function draft(tool, lines, claims, queued) {
  const prompt = [
    "Answer directly from the material below; you have no tools and need none.",
    "You are reviewing one entry of a public, evidence-first catalogue of TapeOut-protocol community tools. The catalogue's rule: every sentence must be something a reviewer saw on the page. You are given the entry as it stands and a numbered excerpt of the page as served today.",
    "Decide: \"still_accurate\" (the entry needs no text change), \"revise\" (propose replacement summary_en and summary_zh), or \"unverifiable\" (the excerpt does not let you judge).",
    "Absence is not evidence: never remove or weaken a claim merely because this excerpt does not show it — these pages are client-rendered and an excerpt is often a fraction of the page. Revise only what the excerpt contradicts or extends; if the excerpt is too thin to cover what the entry describes, answer unverifiable.",
    "If you revise: keep the entry's register and its safety boundaries; do not add any capability the excerpt does not show; every new or changed claim must cite excerpt line numbers in `citations` (integers). Do not quote live numbers (prices, counts) — describe the surfaces and counters instead. Keep the same length class as the current entry.",
    "Output only JSON: { \"verdict\": \"still_accurate\"|\"revise\"|\"unverifiable\", \"summary_en\": string|null, \"summary_zh\": string|null, \"citations\": [int], \"rationale\": string }",
    "",
    `Tool: ${tool.id} — ${tool.title_en} — ${tool.url}`,
    queued ? `Self-audit flagged it: page changed ${queued.changed_at}, entry reviewed ${queued.reviewed_at}. Labels added: ${JSON.stringify(queued.surface_added)}; removed: ${JSON.stringify(queued.surface_removed)}.` : "Not currently flagged by the self-audit.",
    "", "Current summary_en:", tool.summary_en, "", "Current summary_zh:", tool.summary_zh, "", "Current safety_en (do not weaken):", tool.safety_en,
    "", "Mechanical claim check (sentence → best excerpt line):", JSON.stringify(claims.map(c => ({ sentence: c.sentence.slice(0, 120), line: c.line, status: c.status })), null, 0),
    "", "Excerpt (numbered):", ...lines.map((l, i) => `${String(i + 1).padStart(3)}| ${l}`),
  ].join("\n");
  let env = null;
  for (let attempt = 1; attempt <= 3 && (!env || env.result == null || env.stop_reason === "tool_use"); attempt++) {
    const r = spawnSync(CLAUDE_BIN, ["-p", "--model", MODEL, "--output-format", "json", "--max-turns", "1", "--tools", ""], { input: prompt, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
    try { env = JSON.parse(r.stdout); } catch { env = null; }
  }
  if (!env || env.result == null) throw new Error("claude returned no result after 3 attempts");
  const text = String(env.result);
  const s = text.indexOf("{"), e = text.lastIndexOf("}");
  if (s < 0) throw new Error("model returned no JSON");
  const json = JSON.parse(text.slice(s, e + 1));
  const bad = (json.citations || []).filter(n => !Number.isInteger(n) || n < 1 || n > lines.length);
  if (json.verdict === "revise" && (!json.summary_en || !json.summary_zh)) json.invalid = "revise verdict without both summaries";
  else if (json.verdict === "revise" && !(json.citations || []).length) json.invalid = "revise verdict with no citations";
  else if (bad.length) json.invalid = `citations do not resolve to excerpt lines: ${bad.join(", ")}`;
  return { json, cost: env.total_cost_usd ?? null };
}

// ---- write files -----------------------------------------------------------------
mkdirSync(OUT_DIR, { recursive: true });
const today = new Date().toISOString();
const runSummary = { generated_at: today, model: flag("--no-llm") ? null : MODEL, tools: [] };
for (const id of targets) {
  const tool = CURATED_TOOLS.find(t => t.id === id);
  const queued = queue.get(id) || null;
  process.stdout.write(`${id}: fetching… `);
  const { path, lines, errors } = await fetchExcerpt(tool.url, tool);
  const claims = path ? [...claimCheck(tool.summary_en, lines), ...claimCheck(tool.summary_zh, lines).map(c => ({ ...c, lang: "zh" }))] : [];
  let proposal = null, cost = null;
  let status = path ? "draft" : "unverifiable";
  if (path && !flag("--no-llm")) {
    try { const d = draft(tool, lines, claims, queued); proposal = d.json; cost = d.cost; if (proposal.invalid) status = "draft-invalid"; }
    catch (e) { proposal = { error: e.message }; status = "draft-error"; }
  }
  const fm = [
    "---", `id: ${id}`, `url: ${tool.url}`, `status: ${status}`, `generated_at: ${today}`, `reviewed_at: ${tool.reviewed_at}`,
    `changed_at: ${queued?.changed_at ?? "not flagged"}`, `fetch_path: ${path ?? "none"}`, `excerpt_lines: ${lines.length}`,
    `model: ${proposal && !proposal.error && !flag("--no-llm") ? MODEL : "none"}`, "---", "",
  ];
  const body = [
    `# Review: ${tool.title_en}`, "",
    "Set `status: approved` to apply the JSON block at the bottom (edit it first if needed), or `status: revouch` to keep the text and refresh the review date. Then run `node scripts/apply_reviews.mjs`.", "",
    "## Entry as it stands", "", `**summary_en:** ${tool.summary_en}`, "", `**summary_zh:** ${tool.summary_zh}`, "", `**safety_en:** ${tool.safety_en}`, "",
    "## Self-audit signal", "", queued ? `Page changed ${queued.changed_at}; entry reviewed ${queued.reviewed_at}.\n\nLabels added: ${JSON.stringify(queued.surface_added)}\nLabels removed: ${JSON.stringify(queued.surface_removed)}` : "Not in the review queue.", "",
    "## Fetch", "", path ? `Retrieved via **${path}**.` : "**No fetch path returned content — unverifiable this round.**", ...(errors.length ? ["", ...errors.map(e => `- ${e}`)] : []), "",
    "## Claim check (mechanical, en then zh)", "", "| # | sentence | best line | overlap | status |", "|---|---|---|---|---|",
    ...claims.map((c, i) => `| ${i + 1}${c.lang ? " zh" : ""} | ${c.sentence.replace(/\|/g, "\\|").slice(0, 110)} | ${c.line || "—"} | ${c.hits.slice(0, 5).join(", ")} | ${c.status} |`), "",
    "## Excerpt (as served, numbered)", "", "```text", ...lines.map((l, i) => `${String(i + 1).padStart(3)}| ${l}`), "```", "",
    "## Proposed revision", "",
    proposal ? (proposal.error ? `Model call failed: ${proposal.error}` : `Verdict: **${proposal.verdict}**${proposal.invalid ? ` — INVALID: ${proposal.invalid}` : ""}\n\n${proposal.rationale || ""}\n\n\`\`\`json\n${JSON.stringify({ verdict: proposal.verdict, summary_en: proposal.summary_en, summary_zh: proposal.summary_zh, citations: proposal.citations }, null, 2)}\n\`\`\``) : "(no model draft requested)", "",
  ];
  writeFileSync(`${OUT_DIR}${id}.md`, fm.join("\n") + body.join("\n"));
  runSummary.tools.push({
    id, title_en: tool.title_en, url: tool.url, status, fetch_path: path, excerpt_lines: lines.length, cost_usd: cost,
    queued: queued ? { changed_at: queued.changed_at, reviewed_at: queued.reviewed_at } : null,
    claim_check: claims.map(c => c.status),
    verdict: proposal?.verdict ?? null, invalid: proposal?.invalid ?? null, rationale: proposal?.rationale ?? null,
    summary_en_before: tool.summary_en, summary_en_after: proposal?.summary_en ?? null, summary_zh_after: proposal?.summary_zh ?? null,
    cited_lines: (proposal?.citations || []).filter(n => Number.isInteger(n) && n >= 1 && n <= lines.length).map(n => ({ n, text: lines[n - 1] })),
  });
  console.log(`${status}${path ? ` via ${path}, ${lines.length} lines` : ""}${proposal?.verdict ? `, verdict ${proposal.verdict}` : ""}${cost != null ? `, $${cost.toFixed(2)}` : ""} → reviews/pending/${id}.md`);
}
writeFileSync(`${OUT_DIR}_run.json`, JSON.stringify(runSummary, null, 2) + "\n");
