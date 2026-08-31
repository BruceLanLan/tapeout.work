import { writeFile, mkdir } from 'node:fs/promises';

const baseUrl = process.argv[2] || 'http://127.0.0.1:8791/';
const outputDir = process.argv[3] || '/tmp/tapeout-source-update-screens';
const debugPort = process.argv[4] || '9288';
await mkdir(outputDir, { recursive: true });

const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
const page = targets.find(target => target.type === 'page');
if (!page?.webSocketDebuggerUrl) throw new Error('No inspectable browser page found');
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
let sequence = 0;
const pending = new Map();
socket.addEventListener('message', event => {
  const payload = JSON.parse(event.data);
  if (payload.id && pending.has(payload.id)) { const { resolve, reject } = pending.get(payload.id); pending.delete(payload.id); payload.error ? reject(new Error(payload.error.message)) : resolve(payload.result); }
});
const command = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
async function waitFor(expression, label) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result?.result?.value) return;
    await sleep(150);
  }
  throw new Error(`Timed out: ${label}`);
}

async function capture(name, width, height, selector = '#bem') {
  await command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width <= 480 });
  await command('Page.enable');
  await command('Page.navigate', { url: baseUrl });
  await sleep(4200);
  await command('Runtime.evaluate', { expression: `document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({block:'start'});` });
  await sleep(800);
  await waitFor(`Boolean(document.querySelector('#bem-mining-facts')?.textContent?.trim() && document.querySelector('#bem-price-facts')?.textContent?.trim())`, `${name} BEM data panels`);
  const image = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(`${outputDir}/${name}.png`, Buffer.from(image.data, 'base64'));
}

await capture('bem-scripted-desktop', 1440, 1080);
await capture('bem-scripted-mobile', 390, 920);
await capture('bem-events-mobile', 390, 920, '#bem-events');
socket.close();
console.log(`Saved $BEM source-update screenshots to ${outputDir}`);
