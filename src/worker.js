import { ensureEventSchema } from "./events.js";
import { ensureRefreshSchema, refresh } from "./registry.js";
import { ensureAirdropSchema, syncAirdropsObserved } from "./airdrop.js";
import { ensureMarketSchema, syncCircuitMarketObserved } from "./market.js";
import { ensureBemSchema, syncBemObserved, syncBemPrice } from "./bem.js";
import { ensureOfficialAssetSchema, syncOfficialThreeAssets, OFFICIAL_ASSET_REFRESH_MINUTES, ensureTransistorCandleSchema, syncTransistorCandles } from "./official_assets.js";
import { ensureCommunityHolderSchema, syncCommunityProcessorBoard } from "./community.js";
import { api } from "./router.js";

async function runScheduledSync(env, { includeBemPrice = true, includeOfficialAssets = false } = {}) {
  // D1 schema preparation is sequential to avoid DDL races on fresh isolates.
  // Network synchronizations remain isolated and run concurrently afterwards.
  const jobs = [];
  async function prepare(label, schema, sync) {
    try {
      await schema();
      jobs.push({ label, promise: sync() });
    } catch (error) {
      console.error(`[scheduled] ${label} preparation failed`, error?.message || String(error));
    }
  }

  await prepare("registry", async () => { await ensureEventSchema(env); await ensureRefreshSchema(env); }, () => refresh(env));
  await prepare("airdrop", () => ensureAirdropSchema(env), () => syncAirdropsObserved(env));
  await prepare("market", () => ensureMarketSchema(env), () => syncCircuitMarketObserved(env));
  await prepare("bem", () => ensureBemSchema(env), () => syncBemObserved(env, { includePrice: includeBemPrice }));
  if (includeOfficialAssets) await prepare("official_three_assets", () => ensureOfficialAssetSchema(env), () => syncOfficialThreeAssets(env));
  await prepare("transistor_candles", () => ensureTransistorCandleSchema(env), () => syncTransistorCandles(env));
  await prepare("community_processor_board", () => ensureCommunityHolderSchema(env), () => syncCommunityProcessorBoard(env));

  const outcomes = await Promise.allSettled(jobs.map(job => job.promise));
  outcomes.forEach((outcome, index) => {
    if (outcome.status === "rejected") console.error(`[scheduled] ${jobs[index].label} sync failed`, outcome.reason?.message || String(outcome.reason));
  });
  return outcomes;
}

export default {
  async fetch(request, env) { return (await api(request, env)) || env.ASSETS.fetch(request); },
  async scheduled(controller, env, ctx) {
    // The one-minute trigger refreshes only the volatile third-party BEM/USDT quote.
    // The five-minute trigger retains the broader public-source collection cadence.
    // Official three-project address aggregation is deliberately lower frequency: every 30 minutes.
    if (controller.cron === "* * * * *") ctx.waitUntil(syncBemPrice(env));
    else {
      const minute = new Date(controller.scheduledTime || Date.now()).getUTCMinutes();
      ctx.waitUntil(runScheduledSync(env, { includeBemPrice: false, includeOfficialAssets: minute % OFFICIAL_ASSET_REFRESH_MINUTES === 0 }));
    }
  },
};
