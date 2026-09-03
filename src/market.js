import { BSC_CHAIN_ID, BSC_LOGS_RPC_SECRET, CIRCUIT_MARKET_ADDRESS } from "./constants.js";
import { hexToNumber, hexToBigInt, formatBnb, topicAddress, dataWord, toBigInt } from "./util.js";
import { ensureEventSchema } from "./events.js";

const CIRCUIT_MARKET_SOLD_TOPIC = "0x2938a0a3a4a7c19c3a1fe6ef25340b7acd26dfac11de87836084d42fccc18656";
const MARKET_CONFIRMATIONS = 12;
const MARKET_LOG_WINDOW = 2000;
// Public providers answer roughly one tick in four from Cloudflare egress; a
// successful tick therefore scans several windows so coverage keeps pace with
// the chain (~400 blocks per five minutes) instead of slipping behind.
const MARKET_LOG_WINDOWS_PER_RUN = 3;
// Beyond this lag the scan gives up catching up and restarts from recent blocks,
// recording the skipped range (see syncCircuitMarket). ~4 hours of BSC blocks.
const MARKET_MAX_LAG_BLOCKS = 20000;
const LARGE_SALE_WEI = 500000000000000000n;

let marketSchemaReady;

export async function ensureMarketSchema(env) {
  if (!marketSchemaReady) {
    marketSchemaReady = env.DB.batch([
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS market_events (
        id TEXT PRIMARY KEY, chain_id INTEGER NOT NULL, block_number INTEGER NOT NULL, block_timestamp INTEGER,
        tx_hash TEXT NOT NULL, log_index INTEGER NOT NULL, circuit_address TEXT NOT NULL, buyer_address TEXT NOT NULL,
        seller_address TEXT NOT NULL, token_id TEXT NOT NULL, paid_to_seller_wei TEXT NOT NULL, fee_wei TEXT NOT NULL,
        gross_wei TEXT NOT NULL, processor_address TEXT, processor_name TEXT, observed_at TEXT NOT NULL
      )`),
      env.DB.prepare("CREATE INDEX IF NOT EXISTS market_events_block_idx ON market_events(block_number DESC, log_index DESC)"),
      env.DB.prepare("CREATE INDEX IF NOT EXISTS market_events_circuit_idx ON market_events(circuit_address, block_number DESC)"),
      env.DB.prepare("CREATE TABLE IF NOT EXISTS market_checkpoints (source_key TEXT PRIMARY KEY, block_number INTEGER NOT NULL, updated_at TEXT NOT NULL)"),
      env.DB.prepare("CREATE TABLE IF NOT EXISTS market_sync_runs (id INTEGER PRIMARY KEY AUTOINCREMENT, attempted_at TEXT NOT NULL, status TEXT NOT NULL, from_block INTEGER, to_block INTEGER, sale_count INTEGER, error TEXT)"),
      env.DB.prepare("CREATE INDEX IF NOT EXISTS market_sync_runs_attempted_idx ON market_sync_runs(attempted_at DESC)"),
    ]);
  }
  return marketSchemaReady;
}

export function marketRpcUrl(env) { return String(env[BSC_LOGS_RPC_SECRET] || "").trim(); }

export async function rpc(env, method, params, endpoint = marketRpcUrl(env)) {
  if (!endpoint) throw new Error("log provider is not configured");
  // Public providers rate-limit Cloudflare's shared egress by IP; a 429 is usually
  // about the neighbourhood, not this Worker. Two short retries catch the
  // intermittent case without hammering a provider that is refusing outright.
  let response;
  for (let attempt = 0; attempt < 3; attempt++) {
    response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json", "user-agent": "tapeout.work-monitor/1.0 (+https://tapeout.work)" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
    if (response.status !== 429) break;
    await new Promise(resolve => setTimeout(resolve, 1500 * (attempt + 1)));
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.error) throw new Error(`RPC ${payload.error.code}: ${payload.error.message}`);
  return payload.result;
}

export async function processorForCircuit(env, circuitAddress) {
  const row = await env.DB.prepare("SELECT address, name FROM processors_current WHERE lower(json_extract(raw_json, '$.circuits')) = ? OR lower(json_extract(raw_json, '$.circuitAddress')) = ? LIMIT 1").bind(circuitAddress, circuitAddress).first();
  return row || null;
}

export function marketEventStatement(env, { id, observedAt, processorAddress, name, grossWei, detail, evidenceUrl, raw }) {
  return env.DB.prepare(`INSERT OR IGNORE INTO public_events
    (id, observed_at, event_type, trust, processor_address, creator_address, name, metric_name, metric_value, detail, evidence_url, raw_json)
    VALUES (?, ?, 'market.circuit_sold_large', 'chain_observed', ?, NULL, ?, 'gross_wei', ?, ?, ?, ?)`)
    .bind(id, observedAt, processorAddress || null, name, grossWei, detail, evidenceUrl, JSON.stringify(raw));
}

export async function syncCircuitMarket(env) {
  await Promise.all([ensureMarketSchema(env), ensureEventSchema(env)]);
  if (!marketRpcUrl(env)) return { synced: false, status: "not_configured", sales: 0 };
  const latest = hexToNumber(await rpc(env, "eth_blockNumber", []));
  const finalized = Math.max(0, latest - MARKET_CONFIRMATIONS);
  const checkpoint = await env.DB.prepare("SELECT block_number FROM market_checkpoints WHERE source_key = 'circuit_market_sold'").first();
  const recentStart = Math.max(116708167, finalized - (MARKET_LOG_WINDOW * MARKET_LOG_WINDOWS_PER_RUN));
  let start = checkpoint ? Number(checkpoint.block_number) + 1 : recentStart;
  // A checkpoint far behind the chain (the provider was unconfigured for weeks, or
  // rate-limited for hours) cannot be caught up 2,000 blocks per tick, and a public
  // non-archive node refuses old ranges outright. Rather than stall forever, the
  // scan resumes from recent blocks and records the skipped range as a coverage
  // gap that the overview discloses — the sale count is then "since coverage",
  // never a complete history.
  if (start < finalized - MARKET_MAX_LAG_BLOCKS) {
    const gapFrom = start, gapTo = recentStart - 1;
    await env.DB.prepare("INSERT INTO market_checkpoints (source_key, block_number, updated_at) VALUES (?, ?, ?) ON CONFLICT(source_key) DO UPDATE SET block_number=excluded.block_number, updated_at=excluded.updated_at")
      .bind(`circuit_market_sold_gap:${gapFrom}`, gapTo, new Date().toISOString()).run();
    start = recentStart;
  }
  if (start > finalized) return { from_block: start, to_block: finalized, sales: 0, synced: false };
  const end = Math.min(finalized, start + (MARKET_LOG_WINDOW * MARKET_LOG_WINDOWS_PER_RUN) - 1);
  const logs = [];
  for (let from = start; from <= end; from += MARKET_LOG_WINDOW) {
    const to = Math.min(end, from + MARKET_LOG_WINDOW - 1);
    const result = await rpc(env, "eth_getLogs", [{ address: CIRCUIT_MARKET_ADDRESS, topics: [CIRCUIT_MARKET_SOLD_TOPIC], fromBlock: `0x${from.toString(16)}`, toBlock: `0x${to.toString(16)}` }]);
    logs.push(...result);
  }
  const observedAt = new Date().toISOString(), statements = [], evidenceStatements = [];
  for (const log of logs) {
    const circuitAddress = topicAddress(log.topics?.[2]), buyerAddress = topicAddress(log.topics?.[3]);
    const tokenId = hexToBigInt(log.topics?.[1]).toString(), paidToSeller = hexToBigInt(dataWord(log.data, 1)), fee = hexToBigInt(dataWord(log.data, 2)), gross = paidToSeller + fee;
    const processor = await processorForCircuit(env, circuitAddress);
    const id = `${String(log.transactionHash).toLowerCase()}:${hexToNumber(log.logIndex)}`;
    statements.push(env.DB.prepare(`INSERT OR IGNORE INTO market_events
      (id, chain_id, block_number, block_timestamp, tx_hash, log_index, circuit_address, buyer_address, seller_address, token_id, paid_to_seller_wei, fee_wei, gross_wei, processor_address, processor_name, observed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, BSC_CHAIN_ID, hexToNumber(log.blockNumber), hexToNumber(log.blockTimestamp), String(log.transactionHash).toLowerCase(), hexToNumber(log.logIndex), circuitAddress, buyerAddress, topicAddress(dataWord(log.data, 0)), tokenId, paidToSeller.toString(), fee.toString(), gross.toString(), processor?.address || null, processor?.name || null, observedAt));
    if (gross >= LARGE_SALE_WEI) evidenceStatements.push(marketEventStatement(env, { id: `market.circuit_sold_large:${id}`, observedAt, processorAddress: processor?.address || null, name: processor?.name || `Circuit ${circuitAddress.slice(0, 10)}…`, grossWei: gross.toString(), detail: `Confirmed Circuit Market sale of ${formatBnb(gross)} BNB (threshold: 0.5 BNB).`, evidenceUrl: `https://bscscan.com/tx/${String(log.transactionHash).toLowerCase()}`, raw: { chain_id: BSC_CHAIN_ID, market: CIRCUIT_MARKET_ADDRESS, circuit_address: circuitAddress, buyer_address: buyerAddress, seller_address: topicAddress(dataWord(log.data, 0)), token_id: tokenId, paid_to_seller_wei: paidToSeller.toString(), fee_wei: fee.toString(), gross_wei: gross.toString(), block_number: hexToNumber(log.blockNumber) } }));
  }
  for (let index = 0; index < statements.length; index += 100) await env.DB.batch(statements.slice(index, index + 100));
  for (let index = 0; index < evidenceStatements.length; index += 100) await env.DB.batch(evidenceStatements.slice(index, index + 100));
  if (!checkpoint) await env.DB.prepare("INSERT OR IGNORE INTO market_checkpoints (source_key, block_number, updated_at) VALUES ('circuit_market_sold_from', ?, ?)").bind(start, observedAt).run();
  await env.DB.prepare("INSERT INTO market_checkpoints (source_key, block_number, updated_at) VALUES ('circuit_market_sold', ?, ?) ON CONFLICT(source_key) DO UPDATE SET block_number=excluded.block_number, updated_at=excluded.updated_at").bind(end, observedAt).run();
  return { from_block: start, to_block: end, sales: logs.length, synced: true };
}

export async function recordMarketSync(env, { attemptedAt, status, fromBlock = null, toBlock = null, saleCount = null, error = null }) {
  await ensureMarketSchema(env);
  await env.DB.prepare("INSERT INTO market_sync_runs (attempted_at, status, from_block, to_block, sale_count, error) VALUES (?, ?, ?, ?, ?, ?)").bind(attemptedAt, status, fromBlock, toBlock, saleCount, error ? String(error).slice(0, 500) : null).run();
}

export async function syncCircuitMarketObserved(env) {
  // Do not create a market audit write on every core Registry check until a dedicated provider exists.
  if (!marketRpcUrl(env)) return { synced: false, status: "not_configured", sales: 0 };
  const attemptedAt = new Date().toISOString();
  try {
    const result = await syncCircuitMarket(env);
    await recordMarketSync(env, { attemptedAt, status: result.status || "ok", fromBlock: result.from_block, toBlock: result.to_block, saleCount: result.sales });
    return result;
  } catch (error) {
    await recordMarketSync(env, { attemptedAt, status: "error", error: error?.message || String(error) });
    return { synced: false, error: error?.message || String(error) };
  }
}

export async function marketOverview(env) {
  await ensureMarketSchema(env);
  const [rowsResult, checkpoint, startCheckpoint, gapRows, latestSync] = await Promise.all([
    env.DB.prepare("SELECT id, block_number, block_timestamp, tx_hash, circuit_address, buyer_address, seller_address, token_id, paid_to_seller_wei, fee_wei, gross_wei, processor_address, processor_name FROM market_events ORDER BY block_number DESC, log_index DESC LIMIT 2000").all(),
    env.DB.prepare("SELECT block_number, updated_at FROM market_checkpoints WHERE source_key = 'circuit_market_sold'").first(),
    env.DB.prepare("SELECT block_number FROM market_checkpoints WHERE source_key = 'circuit_market_sold_from'").first(),
    env.DB.prepare("SELECT source_key, block_number FROM market_checkpoints WHERE source_key LIKE 'circuit_market_sold_gap:%'").all().catch(() => ({ results: [] })),
    env.DB.prepare("SELECT attempted_at, status, from_block, to_block, sale_count, error FROM market_sync_runs ORDER BY id DESC LIMIT 1").first(),
  ]);
  const rows = rowsResult.results, buyers = new Set(), sellers = new Set(), circuits = new Set(), processors = new Set();
  let gross = 0n, fees = 0n, largeSales = 0;
  for (const row of rows) { gross += toBigInt(row.gross_wei); fees += toBigInt(row.fee_wei); if (toBigInt(row.gross_wei) >= LARGE_SALE_WEI) largeSales += 1; buyers.add(row.buyer_address); sellers.add(row.seller_address); circuits.add(row.circuit_address); if (row.processor_address) processors.add(row.processor_address); }
  return { source: "Circuit Market Sold event", chain_id: BSC_CHAIN_ID, market_address: CIRCUIT_MARKET_ADDRESS, latest_sync: latestSync || null, coverage: checkpoint ? { from_block: startCheckpoint?.block_number ?? null, through_block: checkpoint.block_number, updated_at: checkpoint.updated_at , gaps: (gapRows.results || []).map(row => ({ from_block: Number(row.source_key.split(":")[1]), to_block: Number(row.block_number), note: "not scanned: provider serves recent windows only" }))} : null, sale_count: rows.length, gross_wei: gross.toString(), fee_wei: fees.toString(), large_sale_count: largeSales, unique_buyers: buyers.size, unique_sellers: sellers.size, traded_circuits: circuits.size, mapped_processors: processors.size, recent_sales: rows.slice(0, 20) };
}
