import { mkdir, writeFile } from 'node:fs/promises';

const baseUrl = process.argv[2] || 'http://127.0.0.1:8810/';
const outputDir = process.argv[3] || '/tmp/tapeout-freshness-ui';
const debugPort = process.argv[4] || '9282';
await mkdir(outputDir, { recursive: true });
const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
const page = targets.find(target => target.type === 'page');
if (!page?.webSocketDebuggerUrl) throw new Error('No inspectable Chromium page');
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
let sequence = 0;
const pending = new Map();
socket.addEventListener('message', event => { const value = JSON.parse(event.data); if (value.id && pending.has(value.id)) { const { resolve, reject } = pending.get(value.id); pending.delete(value.id); value.error ? reject(new Error(value.error.message)) : resolve(value.result); } });
const command = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function capture(name, width, height, locale, expectedDir = 'ltr') {
  await command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width <= 480 });
  await command('Page.enable');
  await command('Network.enable');
  await command('Network.setCacheDisabled', { cacheDisabled: true });
  await command('Page.navigate', { url: `${baseUrl}?freshness-ui=${Date.now()}#bem` });
  await sleep(6500);
  await command('Runtime.evaluate', { expression: `setLanguage(${JSON.stringify(locale)})`, awaitPromise: true });
  await sleep(900);
  const evaluated = await command('Runtime.evaluate', { expression: `(() => {
    const section = document.querySelector('#bem'); section?.scrollIntoView({ block: 'start' });
    const meta = document.querySelector('#bem-price-meta');
    const facts = document.querySelector('#bem-price-facts');
    const select = document.querySelector('#language-select');
    const card = document.querySelector('.bem-price-panel');
    return {
      lang: document.documentElement.lang,
      dir: document.documentElement.dir,
      viewport: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      options: select?.options.length || 0,
      facts: facts?.textContent?.trim() || '',
      meta: meta?.textContent?.trim() || '',
      cardHeight: Math.round(card?.getBoundingClientRect().height || 0),
      metaHeight: Math.round(meta?.getBoundingClientRect().height || 0)
    };
  })()`, returnByValue: true });
  const metrics = evaluated.result.value;
  if (metrics.options !== 11 || !metrics.facts || !metrics.meta || metrics.scrollWidth > metrics.viewport + 1 || metrics.dir !== expectedDir) throw new Error(`${name} failed: ${JSON.stringify(metrics)}`);
  await sleep(200);
  const screenshot = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(`${outputDir}/${name}.png`, Buffer.from(screenshot.data, 'base64'));
  return metrics;
}

const results = [];
results.push(await capture('desktop-zh-bem', 1440, 900, 'zh'));
results.push(await capture('desktop-de-bem', 1440, 900, 'de'));
results.push(await capture('mobile-ar-bem', 390, 900, 'ar', 'rtl'));
socket.close();
console.log(JSON.stringify({ status: 'pass', results }, null, 2));
