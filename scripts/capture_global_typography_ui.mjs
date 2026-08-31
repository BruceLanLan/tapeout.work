import { mkdir, writeFile } from 'node:fs/promises';

const baseUrl = process.argv[2] || 'http://127.0.0.1:8797/';
const outputDir = process.argv[3] || '/tmp/tapeout-global-typography';
const debugPort = process.argv[4] || '9277';
await mkdir(outputDir, { recursive: true });

const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
const pageTarget = targets.find(target => target.type === 'page');
if (!pageTarget?.webSocketDebuggerUrl) throw new Error('No inspectable Chromium page');
const socket = new WebSocket(pageTarget.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});
let sequence = 0;
const pending = new Map();
socket.addEventListener('message', event => {
  const payload = JSON.parse(event.data);
  if (payload.id && pending.has(payload.id)) {
    const { resolve, reject } = pending.get(payload.id);
    pending.delete(payload.id);
    payload.error ? reject(new Error(payload.error.message)) : resolve(payload.result);
  }
});
const command = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence;
  pending.set(id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params }));
});
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const waitFor = async (expression, label) => {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result?.result?.value) return;
    await sleep(150);
  }
  throw new Error(`Timed out: ${label}`);
};

async function capture({ name, width, height, locale, anchor, expectedDir = 'ltr' }) {
  await command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width <= 480 });
  await command('Page.enable');
  await command('Network.enable');
  await command('Network.setCacheDisabled', { cacheDisabled: true });
  await command('Page.navigate', { url: `${baseUrl}?typography=${Date.now()}#${anchor}` });
  await sleep(4500);
  await command('Runtime.evaluate', { expression: `(async()=>{await setLanguage(${JSON.stringify(locale)});translate();})()`, awaitPromise: true });
  await waitFor(`state.lang === ${JSON.stringify(locale)} && document.documentElement.lang === ${JSON.stringify(locale === 'zh' ? 'zh-CN' : locale)} && document.documentElement.dir === ${JSON.stringify(expectedDir)}`, `${name} locale application`);
  const metricResult = await command('Runtime.evaluate', { expression: `(() => {
    const anchor = document.querySelector('#${anchor}'); anchor?.scrollIntoView({ block: 'start' });
    const pick = selector => { const el = document.querySelector(selector); return el ? getComputedStyle(el).fontFamily : null; };
    const rect = el => el?.getBoundingClientRect();
    const section = document.querySelector('.section-heading');
    const label = document.querySelector('.panel-head > div > span');
    const numeric = document.querySelector('.numeric, .kpi > b, .pulse-card b');
    const select = document.querySelector('select');
    const update = document.querySelector('.updated-label');
    return {
      dir: document.documentElement.dir,
      lang: document.documentElement.lang,
      viewport: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      section: Boolean(anchor),
      desktopNav: (() => { const nav = document.querySelector('.learning-nav-desktop'); const navRect = rect(nav); const navStyle = nav ? getComputedStyle(nav) : null; return { visible: Boolean(nav && navRect?.width && navRect?.height && navStyle?.display !== 'none' && navStyle?.visibility !== 'hidden'), width: Math.round(navRect?.width || 0), height: Math.round(navRect?.height || 0) }; })(),
      font: { body: pick('body'), heading: pick('h1, h2, h3'), label: pick('.panel-head > div > span'), numeric: pick('.numeric, .kpi > b, .pulse-card b'), select: pick('select') },
      baseline: { sectionHeight: Math.round(rect(section)?.height || 0), updateHeight: Math.round(rect(update)?.height || 0), labelHeight: Math.round(rect(label)?.height || 0), numericHeight: Math.round(rect(numeric)?.height || 0), selectHeight: Math.round(rect(select)?.height || 0) }
    };
  })()`, returnByValue: true });
  const metrics = metricResult?.result?.value;
  if (!metrics?.section || metrics.scrollWidth > metrics.viewport + 1 || metrics.dir !== expectedDir || (width > 860 && !metrics.desktopNav?.visible)) throw new Error(`${name} typography layout check failed: ${JSON.stringify(metrics)}`);
  await sleep(250);
  const screenshot = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(`${outputDir}/${name}.png`, Buffer.from(screenshot.data, 'base64'));
  return metrics;
}

const results = [];
results.push(await capture({ name: 'desktop-zh-overview', width: 1440, height: 900, locale: 'zh', anchor: 'overview' }));
results.push(await capture({ name: 'mobile-zh-pulse', width: 390, height: 900, locale: 'zh', anchor: 'protocol-pulse' }));
results.push(await capture({ name: 'desktop-ja-discover', width: 1440, height: 900, locale: 'ja', anchor: 'discover' }));
results.push(await capture({ name: 'mobile-ar-holders', width: 390, height: 900, locale: 'ar', anchor: 'holders', expectedDir: 'rtl' }));
socket.close();
console.log(JSON.stringify({ status: 'pass', results }, null, 2));
