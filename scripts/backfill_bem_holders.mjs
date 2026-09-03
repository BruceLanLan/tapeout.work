// One-off $BEM holder census backfill, run from a machine whose egress the
// archive provider tolerates. The Worker's incremental scan times out on old
// ranges from Cloudflare egress; from here bloXroute answers 5,000-block windows.
//
// Reads the Worker's current balances and checkpoint from D1, folds every Transfer
// from checkpoint+1 to (latest - confirmations) with the exact semantics of
// applyTransferWindow (zero address is never a holder), then writes absolute
// balances, the checkpoint and a sync-run row through wrangler. Run only while the
// Worker's census is paused (BSC_ARCHIVE_RPC_URL unset), or the two will double-apply.
//
//   node scripts/backfill_bem_holders.mjs [--rpc https://bsc.rpc.blxrbdn.com] [--window 5000] [--dry-run]
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const RPC = opt("--rpc", "https://bsc.rpc.blxrbdn.com");
let WINDOW = Number(opt("--window", 5000));
const DRY = args.includes("--dry-run");
const TOKEN = "0x5ce033b2bfca3af30b3e8c8457deaf776a8b695a";
const TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const ZERO = "0x0000000000000000000000000000000000000000";
const GENESIS = 115900000, CONFIRMATIONS = 12;
const DB = "tapeout-monitor";
const OUT = new URL("../.backfill/", import.meta.url).pathname; mkdirSync(OUT, { recursive: true });

const d1 = sql => {
  const r = spawnSync("npx", ["wrangler", "d1", "execute", DB, "--remote", "--json", "--command", sql], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const i = r.stdout.indexOf("["); if (i < 0) throw new Error(`d1 query failed: ${r.stderr.slice(0, 300)}`);
  return JSON.parse(r.stdout.slice(i))[0].results;
};
const d1file = file => {
  const r = spawnSync("npx", ["wrangler", "d1", "execute", DB, "--remote", "--file", file, "--yes"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`d1 file failed (${file}): ${(r.stdout + r.stderr).slice(-400)}`);
};
async function rpc(method, params) {
  const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), signal: AbortSignal.timeout(60_000) });
  const j = await r.json();
  if (j.error) throw new Error(`RPC ${j.error.code}: ${j.error.message}`);
  return j.result;
}
const hex = n => `0x${n.toString(16)}`;
const addr = topic => { const w = String(topic || "").replace(/^0x/, ""); return w.length === 64 ? `0x${w.slice(-40).toLowerCase()}` : ""; };

// --- state from the Worker ---------------------------------------------------------
const cp = d1("SELECT block_number FROM bem_holder_checkpoints WHERE source_key='bem_token_transfer'")[0];
const start = cp ? Number(cp.block_number) + 1 : GENESIS;
const latest = parseInt(await rpc("eth_blockNumber", []), 16);
const target = latest - CONFIRMATIONS;
const existing = new Map(d1("SELECT address, balance_wei FROM bem_holder_balances").map(r => [r.address, BigInt(r.balance_wei)]));
console.log(`backfill ${start} → ${target} (${target - start + 1} blocks), existing balance rows: ${existing.size}`);

// --- fold every transfer -----------------------------------------------------------
const deltas = new Map();
let transfers = 0, from = start, t0 = Date.now();
while (from <= target) {
  const to = Math.min(target, from + WINDOW - 1);
  let logs;
  try { logs = await rpc("eth_getLogs", [{ address: TOKEN, topics: [TOPIC], fromBlock: hex(from), toBlock: hex(to) }]); }
  catch (e) {
    if (WINDOW > 250) { WINDOW = Math.floor(WINDOW / 2); console.log(`  ${e.message.slice(0, 60)} — window → ${WINDOW}`); continue; }
    throw e;
  }
  for (const log of logs) {
    const f = addr(log.topics?.[1]), t = addr(log.topics?.[2]);
    const value = BigInt(`0x${String(log.data || "0x").replace(/^0x/, "").slice(0, 64) || "0"}`);
    if (f && f !== ZERO) deltas.set(f, (deltas.get(f) ?? 0n) - value);
    if (t && t !== ZERO) deltas.set(t, (deltas.get(t) ?? 0n) + value);
  }
  transfers += logs.length;
  if (((to - start) / WINDOW) % 40 < 1) console.log(`  through ${to} (${((to - start) / (target - start) * 100).toFixed(1)}%), transfers so far ${transfers}, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  from = to + 1;
  if (WINDOW < 5000 && logs.length < 500) WINDOW = Math.min(5000, WINDOW * 2); // recover after a transient halving
}
const touched = [...deltas.entries()].filter(([, d]) => d !== 0n);
const finalBalances = new Map(touched.map(([a, d]) => [a, (existing.get(a) ?? 0n) + d]));
const holders = [...new Set([...existing.keys(), ...finalBalances.keys()])].filter(a => (finalBalances.has(a) ? finalBalances.get(a) : existing.get(a)) !== 0n).length;
const negatives = [...finalBalances.values()].filter(v => v < 0n).length;
console.log(`folded ${transfers} transfers; ${touched.length} addresses touched; holders (nonzero) ≈ ${holders}; negative balances: ${negatives}`);
if (DRY) { console.log("dry run — nothing written"); process.exit(0); }

// --- write ---------------------------------------------------------------------------
const now = new Date().toISOString();
const rows = [...finalBalances.entries()].map(([a, v]) => `('${a}','${v.toString()}','${now}')`);
const files = [];
for (let i = 0; i < rows.length; i += 400) {
  const f = `${OUT}balances_${files.length}.sql`;
  writeFileSync(f, `INSERT INTO bem_holder_balances (address, balance_wei, updated_at) VALUES ${rows.slice(i, i + 400).join(",")} ON CONFLICT(address) DO UPDATE SET balance_wei=excluded.balance_wei, updated_at=excluded.updated_at;\n`);
  files.push(f);
}
const tail = `${OUT}checkpoint.sql`;
writeFileSync(tail, [
  `INSERT INTO bem_holder_checkpoints (source_key, block_number, updated_at) VALUES ('bem_token_transfer', ${target}, '${now}') ON CONFLICT(source_key) DO UPDATE SET block_number=excluded.block_number, updated_at=excluded.updated_at;`,
  `INSERT OR IGNORE INTO bem_holder_checkpoints (source_key, block_number, updated_at) VALUES ('bem_token_transfer_from', ${GENESIS}, '${now}');`,
  `INSERT INTO bem_holder_sync_runs (attempted_at, status, from_block, to_block, transfer_count, error) VALUES ('${now}', 'ok', ${start}, ${target}, ${transfers}, NULL);`,
].join("\n") + "\n");
for (const [i, f] of files.entries()) { d1file(f); console.log(`  wrote balances file ${i + 1}/${files.length}`); }
d1file(tail);
console.log(`done: checkpoint → ${target}, ${rows.length} balance rows written`);
