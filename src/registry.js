import { PROCESSORS_URL, PROTECTED_PROCESSOR_HASHES, OFFICIAL_PROCESSOR_URL } from "./constants.js";
import { sha256, pick, toBigInt, comparison, completionBps, completionBand, websiteLabel } from "./util.js";
import { ensureEventSchema, eventStatement } from "./events.js";
import { ensureScheduledDomainFresh } from "./freshness.js";

let refreshSchemaReady;

export function normalizeRows(payload) {
  const items = Array.isArray(payload) ? payload : payload.cpus || payload.processors || payload.data || [];
  return items.map(raw => ({
    address: pick(raw, ["address", "processorAddress", "cpuAddress", "contractAddress"]).toLowerCase(),
    name: pick(raw, ["name", "processorName", "symbol"], "Unnamed processor"),
    creatorAddress: pick(raw, ["creator", "creatorAddress", "owner", "deployer"]).toLowerCase(),
    transistorAddress: pick(raw, ["transistors", "transistorAddress", "tokenAddress"]).toLowerCase(),
    supplyCap: pick(raw, ["supplyCap", "totalSupply", "supply", "cap"], "0"),
    minted: pick(raw, ["minted", "totalMinted", "mintedSupply"], "0"),
    mintPrice: pick(raw, ["mintPrice", "mintPriceWei", "price"], ""),
    circuitCount: Number(pick(raw, ["circuitCount", "circuits", "tapeoutCount"], "0")) || 0,
    sourceUpdatedAt: pick(raw, ["updatedAt", "lastUpdatedAt", "timestamp"], ""),
    raw,
  })).filter(row => /^0x[a-f0-9]{40}$/.test(row.address));
}

export async function fetchPublicSources() {
  const processorsResponse = await fetch(PROCESSORS_URL, { cf: { cacheTtl: 0, cacheEverything: false } });
  if (!processorsResponse.ok) throw new Error(`processors.json failed with ${processorsResponse.status}`);
  const payload = await processorsResponse.json();
  return { rows: normalizeRows(payload), sourceGeneratedAt: pick(payload, ["generatedAt", "updatedAt"], "") };
}

export async function ensureRefreshSchema(env) {
  if (!refreshSchemaReady) refreshSchemaReady = env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS refresh_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, attempted_at TEXT NOT NULL, status TEXT NOT NULL,
      source_generated_at TEXT, processor_count INTEGER, changed_processors INTEGER, error TEXT
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS refresh_runs_attempted_idx ON refresh_runs(attempted_at DESC)"),
  ]);
  return refreshSchemaReady;
}

export async function recordRefreshRun(env, { attemptedAt, status, sourceGeneratedAt = null, processorCount = null, changedProcessors = 0, error = null }) {
  await env.DB.prepare("INSERT INTO refresh_runs (attempted_at, status, source_generated_at, processor_count, changed_processors, error) VALUES (?, ?, ?, ?, ?, ?)").bind(attemptedAt, status, sourceGeneratedAt, processorCount, changedProcessors, error).run();
}

export async function refresh(env) {
  const attemptedAt = new Date().toISOString();
  await Promise.all([ensureEventSchema(env), ensureRefreshSchema(env)]);
  try {
    const { rows, sourceGeneratedAt } = await fetchPublicSources();
    const publicRows = [];
    for (const row of rows) if (!PROTECTED_PROCESSOR_HASHES.has(await sha256(row.address))) publicRows.push(row);
    const sourceHash = await sha256(JSON.stringify(publicRows.map(row => [row.address, row.name, row.supplyCap, row.minted, row.mintPrice, row.circuitCount, row.creatorAddress, row.transistorAddress])));
    const latest = await env.DB.prepare("SELECT source_hash, observed_at, processor_count, minted_total, circuit_total FROM snapshots WHERE processor_count > 0 ORDER BY id DESC LIMIT 1").first();
    if (latest?.source_hash === sourceHash) {
      await recordRefreshRun(env, { attemptedAt, status: "no_change", sourceGeneratedAt, processorCount: Number(latest.processor_count || 0) });
      return { observedAt: latest.observed_at, checkedAt: attemptedAt, processorCount: latest.processor_count, mintedTotal: latest.minted_total, circuitTotal: latest.circuit_total, changed: false };
    }

    const existing = new Map((await env.DB.prepare("SELECT address, name, minted, circuit_count, mint_price, supply_cap, creator_address, transistor_address FROM processors_current").all()).results.map(row => [row.address, row]));
    const statements = []; let changedProcessors = 0;
    for (const row of publicRows) {
      const prior = existing.get(row.address); let rowChanged = !prior;
      if (!prior) {
        changedProcessors += 1;
        statements.push(env.DB.prepare("INSERT INTO changes (observed_at, change_type, address, name, detail) VALUES (?, 'processor_created', ?, ?, ?)").bind(attemptedAt, row.address, row.name, "New public processor detected."));
        statements.push(eventStatement(env, { observedAt: attemptedAt, eventType: "processor.created", row, detail: "New valid Processor observed in Tapeout public registry.", raw: { supply_cap: row.supplyCap, minted: row.minted, circuit_count: row.circuitCount } }));
      } else {
        const mintDelta = toBigInt(row.minted) - toBigInt(prior.minted);
        const circuitDelta = row.circuitCount - Number(prior.circuit_count || 0);
        const priorCompletion = completionBps(prior.minted, prior.supply_cap);
        const nextCompletion = completionBps(row.minted, row.supplyCap);
        rowChanged = mintDelta !== 0n || circuitDelta !== 0 || prior.mint_price !== row.mintPrice || prior.supply_cap !== row.supplyCap || prior.creator_address !== (row.creatorAddress || null) || prior.transistor_address !== (row.transistorAddress || null) || prior.name !== row.name;
        if (rowChanged) changedProcessors += 1;
        if (mintDelta > 0n) statements.push(eventStatement(env, { observedAt: attemptedAt, eventType: "processor.mint_delta", row, metricName: "mint_delta", metricValue: mintDelta.toString(), detail: "Observed Mint increase between public registry snapshots.", raw: { prior_minted: prior.minted, minted: row.minted, completion_bps: nextCompletion } }));
        if (circuitDelta > 0) statements.push(eventStatement(env, { observedAt: attemptedAt, eventType: "processor.circuit_delta", row, metricName: "circuit_delta", metricValue: String(circuitDelta), detail: "Observed Circuit count increase between public registry snapshots.", raw: { prior_circuit_count: prior.circuit_count, circuit_count: row.circuitCount } }));
        if ((priorCompletion === null || priorCompletion < 10000) && nextCompletion !== null && nextCompletion >= 10000) statements.push(eventStatement(env, { observedAt: attemptedAt, eventType: "processor.completed", row, metricName: "completion_bps", metricValue: String(nextCompletion), detail: "Observed Mint completion reached declared supply.", raw: { minted: row.minted, supply_cap: row.supplyCap } }));
        if (rowChanged) statements.push(env.DB.prepare("INSERT INTO changes (observed_at, change_type, address, name, detail) VALUES (?, 'processor_changed', ?, ?, ?)").bind(attemptedAt, row.address, row.name, "Mint, supply, price, Creator, transistor, name, or Circuit count changed."));
      }
      if (!rowChanged) continue;
      const label = websiteLabel(row.address);
      if (label) statements.push(eventStatement(env, { observedAt: attemptedAt, eventType: "attestation.website_label", trust: label.trust, row, metricName: "website_label", metricValue: label.label, detail: `Public Tapeout website displays this Processor with the ${label.label} label.`, evidenceUrl: label.evidence_url, raw: { website_label: label.label, source: "tapeout.net" }, id: `attestation.website_label:${row.address}:${label.label}` }));
      statements.push(env.DB.prepare(`INSERT INTO processors_current
        (address, name, supply_cap, minted, mint_price, circuit_count, raw_json, source_updated_at, observed_at, creator_address, transistor_address)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(address) DO UPDATE SET
          name=excluded.name, supply_cap=excluded.supply_cap, minted=excluded.minted, mint_price=excluded.mint_price,
          circuit_count=excluded.circuit_count, raw_json=excluded.raw_json, source_updated_at=excluded.source_updated_at,
          observed_at=excluded.observed_at, creator_address=excluded.creator_address, transistor_address=excluded.transistor_address`)
        .bind(row.address, row.name, row.supplyCap, row.minted, row.mintPrice, row.circuitCount, JSON.stringify(row.raw), row.sourceUpdatedAt, attemptedAt, row.creatorAddress || null, row.transistorAddress || null));
      statements.push(env.DB.prepare("INSERT OR IGNORE INTO processor_snapshots (observed_at, address, minted, supply_cap, circuit_count) VALUES (?, ?, ?, ?, ?)").bind(attemptedAt, row.address, row.minted, row.supplyCap, row.circuitCount));
    }
    const mintedTotal = publicRows.reduce((sum, row) => sum + toBigInt(row.minted), 0n).toString();
    const circuitTotal = publicRows.reduce((sum, row) => sum + row.circuitCount, 0);
    statements.push(env.DB.prepare("INSERT INTO snapshots (observed_at, processor_count, minted_total, circuit_total, source_hash) VALUES (?, ?, ?, ?, ?)").bind(attemptedAt, publicRows.length, mintedTotal, circuitTotal, sourceHash));
    for (let index = 0; index < statements.length; index += 100) await env.DB.batch(statements.slice(index, index + 100));
    await recordRefreshRun(env, { attemptedAt, status: "updated", sourceGeneratedAt, processorCount: publicRows.length, changedProcessors });
    return { observedAt: attemptedAt, checkedAt: attemptedAt, processorCount: publicRows.length, mintedTotal, circuitTotal, changed: true, changedProcessors };
  } catch (error) {
    await recordRefreshRun(env, { attemptedAt, status: "error", error: error?.message || String(error) });
    throw error;
  }
}

export function toPublicProcessor(row) {
  const completion = completionBps(row.minted, row.supply_cap);
  return { ...row, completion_bps: completion, completion_band: completionBand(completion), official_url: OFFICIAL_PROCESSOR_URL(row.address), website_label: websiteLabel(row.address) };
}

export function applyProcessorFilters(rows, query) {
  const q = (query.get("q") || "").trim().toLowerCase();
  const creator = (query.get("creator") || "").trim().toLowerCase();
  const completion = query.get("completion") || "all";
  const minCircuits = Math.max(0, Number(query.get("min_circuits") || 0));
  const minMinted = toBigInt(query.get("min_minted") || "0");
  const minSupply = toBigInt(query.get("min_supply") || "0");
  return rows.filter(row => {
    const publicRow = toPublicProcessor(row);
    const haystack = `${row.name || ""} ${row.address || ""} ${row.creator_address || ""} ${row.transistor_address || ""}`.toLowerCase();
    return (!q || haystack.includes(q)) && (!creator || String(row.creator_address || "").toLowerCase().includes(creator)) &&
      (completion === "all" || publicRow.completion_band === completion) && Number(row.circuit_count || 0) >= minCircuits &&
      toBigInt(row.minted) >= minMinted && toBigInt(row.supply_cap) >= minSupply;
  });
}

export function sortProcessors(rows, sort) {
  const field = ["circuits", "minted", "supply", "completion", "name"].includes(sort) ? sort : "circuits";
  return [...rows].sort((left, right) => {
    if (field === "name") return String(left.name || "").localeCompare(String(right.name || ""));
    if (field === "circuits") return Number(right.circuit_count || 0) - Number(left.circuit_count || 0);
    if (field === "completion") return (completionBps(right.minted, right.supply_cap) ?? -1) - (completionBps(left.minted, left.supply_cap) ?? -1);
    return comparison(right[field === "minted" ? "minted" : "supply_cap"], left[field === "minted" ? "minted" : "supply_cap"]);
  });
}

export async function currentRows(env, { boot = false } = {}) {
  const count = await env.DB.prepare("SELECT COUNT(*) AS count, SUM(CASE WHEN creator_address IS NOT NULL THEN 1 ELSE 0 END) AS creators FROM processors_current").first();
  if (boot && Number(count?.count || 0) > 0 && Number(count?.creators || 0) === 0) await refresh(env);
  const result = await env.DB.prepare("SELECT address, name, supply_cap, minted, mint_price, circuit_count, creator_address, transistor_address, source_updated_at, observed_at FROM processors_current").all();
  return result.results;
}

export async function ensureRegistryFresh(env) {
  return ensureScheduledDomainFresh({ key: "registry", env, prepare: async () => { await ensureEventSchema(env); await ensureRefreshSchema(env); }, latestRun: () => env.DB.prepare("SELECT attempted_at, status FROM refresh_runs ORDER BY id DESC LIMIT 1").first(), sync: refresh, maxAgeMinutes: 6 });
}
