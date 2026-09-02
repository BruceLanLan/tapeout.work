// Translation as a build step, with verification that can refuse.
//
// What it does: finds every catalogue entry whose translatable source text no
// longer matches the hash stored beside its translation, translates exactly those
// entries per locale, then checks each translation against its source for the
// class of error this site actually shipped once — a negation or scope caveat
// inverted in nine locales at once. A translation that fails that check is not
// written; the entry stays on the older wording and the build stays red until a
// human looks. Nothing here decides what the catalogue says; it only carries what
// the canonical text says into other languages, and proves that it did.
//
// Usage:
//   node scripts/translate_catalog.mjs --check            report stale entries, exit 1 if any
//   node scripts/translate_catalog.mjs                    translate stale entries (all locales)
//   node scripts/translate_catalog.mjs --locales ko,ja    subset of locales
//   node scripts/translate_catalog.mjs --bootstrap        stamp current hashes on existing translations
//                                                         (declares them current; use only after a human review)
//   node scripts/translate_catalog.mjs --verify ids       re-run the verification pass on already-stored translations
//   node scripts/translate_catalog.mjs --stamp ids        after a hand fix that --verify passed: mark it current
//   --model <name>   claude model alias (default: sonnet)
//   --stub           no model calls: identity "translations", verification passes (for tests)
//   CLAUDE_BIN       path to the claude CLI (default: claude on PATH)
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { CURATED_TOOLS, CURATED_UPDATES, ECOSYSTEM_CATALOG_VERSION } from "../src/curated_ecosystem_seed.js";
import { LEARNING_RESOURCES, LEARNING_CATALOG_VERSION } from "../src/learning_resources_seed.js";
import { entrySourceHash, LOCALE_FIELD_SOURCES } from "../src/catalog_hash.js";

export const LOCALES = ["ko", "ja", "es", "ar", "tr", "fr", "de", "ru", "pt"];
const LOCALE_NAMES = { ko: "Korean", ja: "Japanese", es: "Spanish (neutral, not regional)", ar: "Modern Standard Arabic", tr: "Turkish", fr: "French", de: "German", ru: "Russian", pt: "Portuguese (neutral)" };
const root = new URL("..", import.meta.url);
const path = relative => new URL(relative, root).pathname;

const KINDS = {
  tools: { seed: CURATED_TOOLS, file: locale => `public/i18n/ecosystem/${locale}.json`, table: doc => (doc.translations.tools ||= {}) },
  updates: { seed: CURATED_UPDATES, file: locale => `public/i18n/ecosystem/${locale}.json`, table: doc => (doc.translations.updates ||= {}) },
  learning: { seed: LEARNING_RESOURCES, file: locale => `public/i18n/learning/${locale}.json`, table: doc => (doc.translations ||= {}) },
};

const readDoc = relative => JSON.parse(readFileSync(path(relative), "utf8"));
const writeDoc = (relative, doc) => writeFileSync(path(relative), JSON.stringify(doc, null, 2) + "\n");

async function currentHashes() {
  const out = {};
  for (const [kind, { seed }] of Object.entries(KINDS)) {
    out[kind] = new Map();
    for (const entry of seed) out[kind].set(entry.id, await entrySourceHash(kind, entry));
  }
  return out;
}

// Stale = translation missing, unstamped, or stamped from different source text.
export async function freshnessReport(locales = LOCALES) {
  const hashes = await currentHashes();
  const report = {};
  for (const locale of locales) {
    report[locale] = { stale: [], total: 0, stamp_lag: [] };
    for (const [kind, spec] of Object.entries(KINDS)) {
      const doc = readDoc(spec.file(locale));
      const want = kind === "learning" ? LEARNING_CATALOG_VERSION : ECOSYSTEM_CATALOG_VERSION;
      if (doc.source_catalog_version !== want && !report[locale].stamp_lag.includes(spec.file(locale))) report[locale].stamp_lag.push(spec.file(locale));
      const table = spec.table(doc);
      for (const entry of spec.seed) {
        report[locale].total++;
        const stored = table[entry.id];
        const current = hashes[kind].get(entry.id);
        if (!stored) report[locale].stale.push({ kind, id: entry.id, reason: "missing" });
        else if (!stored.source_hash) report[locale].stale.push({ kind, id: entry.id, reason: "unstamped" });
        else if (stored.source_hash !== current) report[locale].stale.push({ kind, id: entry.id, reason: "source changed" });
      }
    }
  }
  return report;
}

function bootstrap(locales) {
  return (async () => {
    const hashes = await currentHashes();
    let stamped = 0;
    for (const locale of locales) {
      const docs = new Map();
      for (const [kind, spec] of Object.entries(KINDS)) {
        const file = spec.file(locale);
        const doc = docs.get(file) || readDoc(file);
        docs.set(file, doc);
        const table = spec.table(doc);
        for (const entry of spec.seed) {
          if (table[entry.id] && !table[entry.id].source_hash) { table[entry.id].source_hash = hashes[kind].get(entry.id); stamped++; }
        }
      }
      for (const [file, doc] of docs) writeDoc(file, doc);
    }
    console.log(`bootstrap: stamped ${stamped} existing translations with their current source hash`);
  })();
}

// ---- model calls -------------------------------------------------------------
const CLAUDE_BIN = process.env.CLAUDE_BIN || "claude";
function callModel(prompt, model, attempt = 1) {
  try { return callModelOnce(prompt, model); }
  catch (error) {
    // A text-only prompt occasionally still ends in a tool_use stop or an empty
    // envelope; both are stochastic, so one or two retries are cheaper than a
    // human re-running the whole locale.
    if (attempt < 3 && /tool_use|no result/.test(String(error?.message))) { console.warn(`  retry ${attempt}: ${error.message.slice(0, 80)}`); return callModel(prompt, model, attempt + 1); }
    throw error;
  }
}
function callModelOnce(prompt, model) {
  const run = spawnSync(CLAUDE_BIN, ["-p", "--model", model, "--output-format", "json", "--max-turns", "1", "--tools", ""], {
    input: prompt, encoding: "utf8", maxBuffer: 16 * 1024 * 1024,
  });
  // The CLI can exit non-zero for reasons unrelated to the answer (a local
  // SessionEnd hook that cannot connect, for instance) while still printing the
  // full result envelope. Judge the call by whether an envelope came back.
  let envelope;
  try { envelope = JSON.parse(run.stdout); } catch { envelope = null; }
  if (envelope?.stop_reason === "tool_use") throw new Error("model tried to call a tool instead of answering; tools are disabled for this call — the prompt should not need any");
  if (!envelope || envelope.result == null) throw new Error(`claude exited ${run.status} with no result. stdout: ${(run.stdout || "").slice(0, 300)} stderr: ${(run.stderr || "").replace(/SessionEnd hook[^\n]*/g, "").slice(0, 300)}`);
  const text = typeof envelope.result === "string" ? envelope.result : JSON.stringify(envelope.result);
  const start = text.indexOf("{"), end = text.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error(`model returned no JSON object: ${text.slice(0, 200)}`);
  return { json: JSON.parse(text.slice(start, end + 1)), cost_usd: envelope.total_cost_usd ?? null };
}

const GLOSSARY = "Keep untranslated, exactly as written: TapeOut, Behemoth, BEM, $BEM, NAND, LATCH, Circuit, Processor, PoD, Proof of Design, Canvas, BscScan, PancakeSwap, Chainlink, Dune, GatePilot, BNB, USDT, D1, every URL, every contract address, every tool or site name, and any label shown in quotation marks or guillemets that names something on a screen (for example \"Forgone Emissions\").";

function sourceFieldsFor(kind, entry) {
  const map = LOCALE_FIELD_SOURCES[kind];
  const out = {};
  for (const [localeField, sourceField] of Object.entries(map)) out[localeField] = entry[sourceField] ?? "";
  // The Chinese canonical is supplied as a second reading of the same meaning.
  const zh = {};
  for (const [localeField, sourceField] of Object.entries(map)) { const zhField = sourceField.replace(/_en$/, "_zh"); if (entry[zhField]) zh[localeField] = entry[zhField]; }
  return { en: out, zh };
}

function translatePrompt(locale, items, references) {
  return [
    `You are translating reviewed catalogue copy for a public research site about the TapeOut protocol into ${LOCALE_NAMES[locale]}.`,
    "Answer directly from the text below; you have no tools and need none.",
    "Rules:",
    "- Translate meaning faithfully. Every negation, exclusion, hedge, scope limitation and disclaimer in the English must survive with the same polarity and the same scope. Never soften, strengthen, add or drop a claim.",
    "- The Chinese text (zh) is a second canonical reading of the same meaning; use it to disambiguate, but the English is the primary source.",
    `- ${GLOSSARY}`,
    "- Match the register and terminology of the reference translations below (they are from the same locale file).",
    "- Output only a JSON object: { \"<id>\": { <field>: \"<translation>\", ... }, ... } with exactly the ids and fields given. No commentary.",
    "",
    "Reference translations (existing, for style):",
    JSON.stringify(references, null, 1),
    "",
    "Entries to translate:",
    JSON.stringify(items, null, 1),
  ].join("\n");
}

function verifyPrompt(locale, pairs) {
  return [
    `You are checking ${LOCALE_NAMES[locale]} translations of English source texts for meaning drift. You are not judging style. Answer directly from the text below; you have no tools and need none.`,
    "For each id: list every negation, exclusion, hedge, scope limitation or disclaimer in the English source (phrases like \"not official\", \"does not guarantee\", \"only\", \"never\", \"cannot\", \"is not corroborated\", \"rather than\", \"separate from\", \"could not be verified\"). For each, decide whether the translation preserves both its polarity and its scope. Also list any factual claim present in the translation that is absent from the source.",
    "Be literal about polarity: a translation that says a thing is not X when the source says it is X — or the reverse — is a failure even if it reads naturally.",
    "source_zh is the Chinese canonical of the same entry, written by the same reviewer. A wording that the Chinese licenses (for example a verb the Chinese uses explicitly) is not an added claim, even if the English phrases it more loosely.",
    "Output only JSON: { \"<id>\": { \"caveats\": [ { \"source\": \"...\", \"preserved\": true|false, \"note\": \"...\" } ], \"added_claims\": [ \"...\" ], \"verdict\": \"pass\"|\"fail\" } }. verdict is fail if any caveat is not preserved or any claim was added.",
    "",
    JSON.stringify(pairs, null, 1),
  ].join("\n");
}

function stubTranslate(locale, items) {
  const out = {};
  for (const [id, fields] of Object.entries(items)) { out[id] = {}; for (const [f, v] of Object.entries(fields.en)) out[id][f] = `[${locale}] ${v}`; }
  return { json: out, cost_usd: 0 };
}

export async function translateStale({ locales = LOCALES, model = "sonnet", stub = false } = {}) {
  const hashes = await currentHashes();
  const report = await freshnessReport(locales);
  const summary = { translated: 0, rejected: [], cost_usd: 0 };
  for (const locale of locales) {
    const stale = report[locale].stale;
    if (!stale.length) {
      // Nothing to translate, but the informational version stamp still follows
      // the catalogue so readers of the API see which revision a locale tracks.
      for (const [kind, spec] of Object.entries(KINDS)) { const file = spec.file(locale); const doc = readDoc(file); const want = kind === "learning" ? LEARNING_CATALOG_VERSION : ECOSYSTEM_CATALOG_VERSION; if (doc.source_catalog_version !== want) { doc.source_catalog_version = want; writeDoc(file, doc); } }
      console.log(`${locale}: current`); continue;
    }
    const docs = new Map();
    const items = {}, meta = {};
    for (const { kind, id } of stale) {
      const entry = KINDS[kind].seed.find(e => e.id === id);
      items[id] = sourceFieldsFor(kind, entry);
      meta[id] = kind;
    }
    // Style references: two current translations from this locale, tools preferred.
    const refDoc = readDoc(KINDS.tools.file(locale));
    const references = Object.entries(refDoc.translations.tools || {}).filter(([id]) => !items[id]).slice(0, 2)
      .map(([id, t]) => ({ id, english: sourceFieldsFor("tools", CURATED_TOOLS.find(e => e.id === id) || {}).en, translation: { title: t.title, summary: t.summary, safety: t.safety } }));

    console.log(`${locale}: translating ${stale.length} entr${stale.length === 1 ? "y" : "ies"} (${stale.map(s => s.id).join(", ")})`);
    let translated;
    try { translated = stub ? stubTranslate(locale, items) : callModel(translatePrompt(locale, items, references), model); }
    catch (error) { for (const id of Object.keys(items)) summary.rejected.push({ locale, id, reason: `locale run failed: ${String(error?.message || error).slice(0, 160)}` }); continue; }
    summary.cost_usd += translated.cost_usd || 0;

    const pairs = {};
    for (const id of Object.keys(items)) {
      if (!translated.json[id]) { summary.rejected.push({ locale, id, reason: "model returned no translation" }); continue; }
      pairs[id] = { source: items[id].en, source_zh: items[id].zh, translation: translated.json[id] };
    }
    let verdicts = {};
    if (Object.keys(pairs).length) {
      if (stub) { for (const id of Object.keys(pairs)) verdicts[id] = { verdict: "pass", caveats: [], added_claims: [] }; }
      else { try { const v = callModel(verifyPrompt(locale, pairs), model); verdicts = v.json; summary.cost_usd += v.cost_usd || 0; } catch (error) { verdicts = {}; console.warn(`  ${locale}: verification call failed (${String(error?.message || error).slice(0, 120)}); nothing written for this locale`); } }
    }
    for (const [id, pair] of Object.entries(pairs)) {
      const verdict = verdicts[id];
      const failedCaveats = (verdict?.caveats || []).filter(c => c.preserved === false);
      const added = verdict?.added_claims || [];
      if (!verdict || verdict.verdict !== "pass" || failedCaveats.length || added.length) {
        summary.rejected.push({ locale, id, reason: !verdict ? "no verification verdict" : [...failedCaveats.map(c => `caveat not preserved: ${c.source} — ${c.note || ""}`), ...added.map(a => `added claim: ${a}`)].join("; ") || "verifier failed it" });
        continue;
      }
      const kind = meta[id];
      const file = KINDS[kind].file(locale);
      const doc = docs.get(file) || readDoc(file);
      docs.set(file, doc);
      const table = KINDS[kind].table(doc);
      const fields = Object.keys(LOCALE_FIELD_SOURCES[kind]);
      const cleaned = {};
      for (const f of fields) { if (typeof pair.translation[f] !== "string" || !pair.translation[f].trim()) { cleaned.__missing = f; break; } cleaned[f] = pair.translation[f].trim(); }
      if (cleaned.__missing) { summary.rejected.push({ locale, id, reason: `missing field ${cleaned.__missing}` }); continue; }
      table[id] = { ...cleaned, source_hash: hashes[kind].get(id) };
      summary.translated++;
    }
    for (const [file, doc] of docs) {
      doc.source_catalog_version = file.includes("/learning/") ? LEARNING_CATALOG_VERSION : ECOSYSTEM_CATALOG_VERSION;
      writeDoc(file, doc);
    }
  }
  return summary;
}

// Re-run only the verification pass over stored translations — used to calibrate
// the checker against hand-made translations that are known to be right.
export async function verifyStored(ids, { locales = LOCALES, model = "sonnet" } = {}) {
  const results = [];
  for (const locale of locales) {
    const pairs = {};
    for (const [kind, spec] of Object.entries(KINDS)) {
      const table = spec.table(readDoc(spec.file(locale)));
      for (const id of ids) { const entry = spec.seed.find(e => e.id === id); if (entry && table[id]) { const t = { ...table[id] }; delete t.source_hash; const sf = sourceFieldsFor(kind, entry); pairs[id] = { source: sf.en, source_zh: sf.zh, translation: t }; } }
    }
    if (!Object.keys(pairs).length) continue;
    const v = callModel(verifyPrompt(locale, pairs), model);
    for (const [id, verdict] of Object.entries(v.json)) {
      const r = { locale, id, verdict: verdict.verdict, failed: (verdict.caveats || []).filter(c => c.preserved === false), added: verdict.added_claims || [] };
      results.push(r);
      // Print as we go: a long multi-locale run that is interrupted should not lose
      // the locales it already finished.
      const bad = r.verdict !== "pass" || r.failed.length || r.added.length;
      console.log(`${bad ? "FAIL" : "PASS"} ${locale} ${id}${bad ? " — " + [...r.failed.map(f => `${f.source}: ${f.note}`), ...r.added.map(a => `added: ${a}`)].join("; ") : ""}`);
    }
  }
  return results;
}

// ---- CLI ---------------------------------------------------------------------
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  const args = process.argv.slice(2);
  const flag = name => args.includes(name);
  const opt = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
  const locales = opt("--locales", "") ? opt("--locales").split(",") : LOCALES;
  const model = opt("--model", "sonnet");
  if (flag("--bootstrap")) { await bootstrap(locales); process.exit(0); }
  if (flag("--check")) {
    const report = await freshnessReport(locales);
    let stale = 0;
    for (const [locale, r] of Object.entries(report)) {
      stale += r.stale.length;
      console.log(`${r.stale.length ? "STALE" : "PASS "} ${locale}: ${r.total - r.stale.length}/${r.total} current${r.stale.length ? " — " + r.stale.map(s => `${s.id} (${s.reason})`).join(", ") : ""}`);
    }
    if (stale) { console.error(`FAIL translation freshness: ${stale} stale translation(s); run node scripts/translate_catalog.mjs`); process.exit(1); }
    console.log("PASS translation freshness"); process.exit(0);
  }
  if (flag("--stamp")) {
    // After a hand fix that --verify has passed: declare these translations current.
    const ids = opt("--stamp").split(","); const hashes = await currentHashes(); let n = 0;
    for (const locale of locales) for (const [kind, spec] of Object.entries(KINDS)) { const file = spec.file(locale); const doc = readDoc(file); const table = spec.table(doc); let touched = false;
      for (const id of ids) if (table[id] && hashes[kind].has(id)) { table[id].source_hash = hashes[kind].get(id); touched = true; n++; }
      if (touched) { doc.source_catalog_version = kind === "learning" ? LEARNING_CATALOG_VERSION : ECOSYSTEM_CATALOG_VERSION; writeDoc(file, doc); } }
    console.log(`stamped ${n} translation(s) as current — only do this after --verify passed`); process.exit(0);
  }
  if (flag("--verify")) {
    const ids = opt("--verify").split(",");
    const results = await verifyStored(ids, { locales, model });
    const fails = results.filter(r => r.verdict !== "pass" || r.failed.length || r.added.length).length;
    console.log(`${results.length - fails}/${results.length} passed verification`); process.exit(fails ? 1 : 0);
  }
  const summary = await translateStale({ locales, model, stub: flag("--stub") });
  console.log(`translated ${summary.translated}, rejected ${summary.rejected.length}, cost ≈ $${summary.cost_usd.toFixed(2)}`);
  for (const r of summary.rejected) console.log(`  REJECTED ${r.locale} ${r.id}: ${r.reason}`);
  process.exit(summary.rejected.length ? 1 : 0);
}
