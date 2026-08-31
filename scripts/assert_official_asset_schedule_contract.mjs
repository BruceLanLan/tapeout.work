import { readFile } from 'node:fs/promises';

const root = new URL('..', import.meta.url);
// worker.js was split into domain modules: the official-asset refresh/health
// constants and freshness policy copy now live in official_assets.js; only the
// scheduled-handler wiring (runScheduledSync signature, cron branch) stays in worker.js.
const worker = await readFile(new URL('src/worker.js', root), 'utf8');
const officialAssets = await readFile(new URL('src/official_assets.js', root), 'utf8');
const wrangler = await readFile(new URL('wrangler.toml', root), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(`Official asset schedule contract failed: ${message}`);
};

assert(wrangler.includes('crons = ["* * * * *", "*/5 * * * *"]'), 'minute BEM and five-minute core cron pair changed unexpectedly');
assert(officialAssets.includes('const OFFICIAL_ASSET_REFRESH_MINUTES = 30;'), 'official asset refresh interval must remain 30 minutes');
assert(officialAssets.includes('const OFFICIAL_ASSET_HEALTH_MINUTES = 70;'), 'official asset stale threshold must remain 70 minutes');
assert(officialAssets.includes('maxAgeMinutes: OFFICIAL_ASSET_REFRESH_MINUTES'), 'on-demand recovery must respect official asset interval');
assert(worker.includes('includeOfficialAssets = false'), 'five-minute sync must not include official assets by default');
assert(worker.includes('includeOfficialAssets: minute % OFFICIAL_ASSET_REFRESH_MINUTES === 0'), 'official asset sync must be gated to the 30-minute boundary');
assert(officialAssets.includes('Checked independently every 30 minutes.'), 'API freshness policy must disclose independent low-frequency cadence');
assert(worker.includes('if (controller.cron === "* * * * *") ctx.waitUntil(syncBemPrice(env));'), 'BEM minute job must remain isolated');
console.log(JSON.stringify({ status: 'pass', official_asset_refresh_minutes: 30, official_asset_stale_minutes: 70 }, null, 2));
