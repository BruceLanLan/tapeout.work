import { readFile } from 'node:fs/promises';

const root = process.argv[2] || process.cwd();
const fail = message => { throw new Error(`BEM realtime contract failed: ${message}`); };
const [worker, bem, app, wrangler] = await Promise.all([
  readFile(`${root}/src/worker.js`, 'utf8'),
  readFile(`${root}/src/bem.js`, 'utf8'),
  readFile(`${root}/public/app.js`, 'utf8'),
  readFile(`${root}/wrangler.toml`, 'utf8'),
]);

for (const cron of ['"* * * * *"', '"*/5 * * * *"']) if (!wrangler.includes(cron)) fail(`missing ${cron} cron`);
if (!bem.includes('const BEM_PRICE_HEALTH_MINUTES = 2;')) fail('price health threshold must remain two minutes');
if (!bem.includes('const BEM_PRICE_REFRESH_MINUTES = 1;')) fail('on-demand price recovery must remain one minute');
if (!worker.includes('controller.cron === "* * * * *"')) fail('one-minute scheduled branch is missing');
if (!worker.includes('ctx.waitUntil(syncBemPrice(env));')) fail('one-minute job must refresh only BEM price');
if (!worker.includes('runScheduledSync(env, { includeBemPrice: false,')) fail('five-minute full sync must avoid duplicate BEM price fetches');
if (!app.includes('const BEM_PRICE_POLL_MS = 60 * 1000;')) fail('browser price poll interval must remain one minute');
if (!app.includes('refreshBemPriceCard')) fail('browser price card refresh function is missing');
if (!app.includes("document.addEventListener('visibilitychange'")) fail('page visibility refresh is missing');
if (!app.includes('startBemPricePolling();')) fail('browser price polling must start after boot');
console.log('PASS: one-minute BEM scheduler and visible-page refresh contract');
