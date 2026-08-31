import { mkdir, writeFile } from 'node:fs/promises';

const baseUrl = process.argv[2] || 'http://127.0.0.1:8788/';
const outputDir = process.argv[3] || '/tmp/tapeout-heatmap-screens';
const debugPort = process.argv[4] || '9225';
await mkdir(outputDir, { recursive: true });

const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
const page = targets.find(target => target.type === 'page');
if (!page?.webSocketDebuggerUrl) throw new Error('No inspectable Chromium page');
const socket = new WebSocket(page.webSocketDebuggerUrl);
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
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function capture(name, width, height) {
  await command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width <= 480 });
  await command('Page.enable');
  await command('Page.navigate', { url: baseUrl });
  await sleep(4500);
  const state = await command('Runtime.evaluate', {
    expression: `(() => {
      const panel = document.querySelector('#heatmap');
      const labels = [...document.querySelectorAll('#daily-heatmap .heatmap-days span')];
      const rows = [...document.querySelectorAll('#daily-heatmap .heatmap-row')];
      const cells = rows.map(row => row.querySelectorAll('div > i').length);
      panel?.scrollIntoView({ block: 'start' });
      return { labels: labels.length, rows: rows.length, cells, text: panel?.innerText || '' };
    })()`,
    returnByValue: true
  });
  const value = state?.result?.value;
  if (!value || value.labels < 1 || value.rows !== 4 || value.cells.some(count => count !== value.labels)) {
    throw new Error(`Heatmap alignment failed: ${JSON.stringify(value)}`);
  }
  await sleep(700);
  const image = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(`${outputDir}/${name}.png`, Buffer.from(image.data, 'base64'));
  return value;
}

const desktop = await capture('heatmap-scripted-desktop', 1440, 900);
const mobile = await capture('heatmap-scripted-mobile', 390, 900);
socket.close();
console.log(JSON.stringify({ desktop, mobile }, null, 2));
