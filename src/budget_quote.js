// Budget-first mining quote for TapeOut vs Behemoth.
//
// Methodology credit: this reimplements the read-only quoting logic published
// by 0xLukin in TapeOutGo (https://github.com/0xLukin/tapeoutgo, MIT license,
// live at https://tapeoutgo.vercel.app) — walking Firsto's public ask book to
// price a machine at real fillable cost, then applying the official non-pioneer
// weight H = b* x P against the live mining snapshot to get a daily $BEM yield.
// TapeOutGo's wallet-connect, buy, tape-out and claim flow is deliberately NOT
// reproduced here or anywhere on this site — only the public, read-only
// pricing/yield calculation is adapted, credited, and kept server-side.
import { bemMiningOverview } from "./bem.js";

const FIRSTO_API = "https://api-tapeout.firsto.ai";
const DEFAULT_TAKER_FEE_BPS = 50n;
const NAND_TOKEN_ID = 0;
const LATCH_TOKEN_ID = 1;

// Reference circuit: task 220, an 8-bit Johnson counter (1 NAND + 9 LATCH),
// chosen by TapeOutGo because LATCH is usually cheaper than NAND and both
// carry equal b* weight, making a 1-NAND/9-LATCH machine cost-efficient.
export const BUDGET_QUOTE_TASK_ID = 220;
export const NAND_BURN_PER_MACHINE = 1;
export const LATCH_BURN_PER_MACHINE = 9;

const PROCESSORS = Object.freeze({
  TapeOut: { key: "TapeOut", gates: "0xCC42ba5De07f01b472a5b14cf45abcca79eb8087", P: 1, hPerMachine: 10 },
  Behemoth: { key: "Behemoth", gates: "0xe2dfd802081c7a05341e20b6582b04b908e8550c", P: 6, hPerMachine: 60 },
});

async function fetchBook(gates, tokenId) {
  const res = await fetch(`${FIRSTO_API}/v1/book/${gates}/${tokenId}`, {
    headers: { accept: "application/json" },
    cf: { cacheTtl: 30 },
  });
  if (!res.ok) throw new Error(`Firsto book HTTP ${res.status}`);
  const body = await res.json();
  return {
    asks: Array.isArray(body.asks) ? body.asks : [],
    sourceBlock: body.sourceBlock ?? null,
    asOf: body.asOf ?? null,
    stale: Boolean(body.stale),
  };
}

function sortedQueue(asks) {
  return [...asks]
    .map((a) => ({
      priceWei: BigInt(a.priceWei || 0),
      remaining: Math.max(0, Math.floor(Number(a.remaining || 0))),
      feeBps: BigInt(a.feeBps ?? Number(DEFAULT_TAKER_FEE_BPS)),
    }))
    .sort((a, b) => (a.priceWei < b.priceWei ? -1 : a.priceWei > b.priceWei ? 1 : 0));
}

function takeUnits(queue, qty) {
  let left = qty;
  let cost = 0n;
  for (const row of queue) {
    if (left <= 0) break;
    if (row.remaining <= 0) continue;
    const take = Math.min(left, row.remaining);
    const gross = row.priceWei * BigInt(take);
    const fee = (gross * row.feeBps) / 10000n;
    cost += gross + fee;
    row.remaining -= take;
    left -= take;
  }
  return { got: qty - left, cost };
}

// Walk both books machine-by-machine (1 NAND + 9 LATCH each) until the budget
// is exhausted or either book runs dry. Machine-by-machine (not unit-by-unit)
// keeps the result meaningful: a partial machine cannot tape out or mine.
function maxMachinesForBudget(nandAsks, latchAsks, budgetWei) {
  const nandQueue = sortedQueue(nandAsks);
  const latchQueue = sortedQueue(latchAsks);
  let machines = 0;
  let costWei = 0n;
  const bestNand = nandQueue[0]?.priceWei ?? null;
  const bestLatch = latchQueue[0]?.priceWei ?? null;
  for (let guard = 0; guard < 100_000; guard += 1) {
    const nandSnapshot = nandQueue.map((r) => ({ ...r }));
    const latchSnapshot = latchQueue.map((r) => ({ ...r }));
    const nandTake = takeUnits(nandQueue, NAND_BURN_PER_MACHINE);
    const latchTake = takeUnits(latchQueue, LATCH_BURN_PER_MACHINE);
    if (nandTake.got < NAND_BURN_PER_MACHINE || latchTake.got < LATCH_BURN_PER_MACHINE) break; // book exhausted
    const machineCost = nandTake.cost + latchTake.cost;
    if (costWei + machineCost > budgetWei) {
      nandQueue.splice(0, nandQueue.length, ...nandSnapshot);
      latchQueue.splice(0, latchQueue.length, ...latchSnapshot);
      break;
    }
    costWei += machineCost;
    machines += 1;
  }
  return { machines, costWei, bestNandPriceWei: bestNand, bestLatchPriceWei: bestLatch };
}

export async function bemBudgetQuote(env, budgetBnbRaw) {
  const budgetBnb = Number(budgetBnbRaw);
  if (!Number.isFinite(budgetBnb) || budgetBnb <= 0) {
    throw new Error("budget_bnb must be a positive number");
  }
  const budgetWei = BigInt(Math.round(budgetBnb * 1e18));
  const overview = await bemMiningOverview(env);
  const currentRateRaw = overview?.metrics?.current_rate_raw ? BigInt(overview.metrics.current_rate_raw) : 0n;
  const totalVerifWeight = overview?.metrics?.total_verif_weight ? BigInt(overview.metrics.total_verif_weight) : 0n;

  const results = {};
  for (const cpu of Object.values(PROCESSORS)) {
    try {
      const [nandBook, latchBook] = await Promise.all([fetchBook(cpu.gates, NAND_TOKEN_ID), fetchBook(cpu.gates, LATCH_TOKEN_ID)]);
      const { machines, costWei, bestNandPriceWei, bestLatchPriceWei } = maxMachinesForBudget(nandBook.asks, latchBook.asks, budgetWei);
      const hTotal = machines * cpu.hPerMachine;
      let dailyBem = 0;
      if (totalVerifWeight > 0n && hTotal > 0) {
        const dailyRateBem = (Number(currentRateRaw) * 86400 * 0.99) / 1e8;
        dailyBem = (dailyRateBem * hTotal) / Number(totalVerifWeight);
      }
      results[cpu.key] = {
        status: "ok",
        p: cpu.P,
        machines,
        cost_bnb: Number(costWei) / 1e18,
        h_per_machine: cpu.hPerMachine,
        h_total: hTotal,
        daily_bem: dailyBem,
        best_nand_price_bnb: bestNandPriceWei != null ? Number(bestNandPriceWei) / 1e18 : null,
        best_latch_price_bnb: bestLatchPriceWei != null ? Number(bestLatchPriceWei) / 1e18 : null,
        book: {
          source: "firsto-api",
          nand_source_block: nandBook.sourceBlock,
          latch_source_block: latchBook.sourceBlock,
          stale: nandBook.stale || latchBook.stale,
        },
      };
    } catch (error) {
      results[cpu.key] = { status: "error", error: error?.message || String(error) };
    }
  }

  return {
    status: "ok",
    methodology_credit: {
      author: "0xLukin",
      repo: "https://github.com/0xLukin/tapeoutgo",
      live_tool: "https://tapeoutgo.vercel.app",
      license: "MIT",
      note: "Read-only pricing/yield methodology adapted from TapeOutGo with credit. This site never connects a wallet, buys, tapes out or claims on any user's behalf.",
    },
    task_id: BUDGET_QUOTE_TASK_ID,
    nand_burn_per_machine: NAND_BURN_PER_MACHINE,
    latch_burn_per_machine: LATCH_BURN_PER_MACHINE,
    budget_bnb: budgetBnb,
    mining_source: {
      current_rate_raw: overview?.metrics?.current_rate_raw ?? null,
      total_verif_weight: overview?.metrics?.total_verif_weight ?? null,
      observed_at: overview?.observed_at ?? null,
      status: overview?.status ?? null,
    },
    processors: results,
    boundary: "Quotes walk Firsto's live public ask book (read-only, same public API TapeOutGo itself reads). Costs exclude gas and can move before you act. This is not a return forecast, and this site does not execute any transaction for you.",
  };
}
