import { mkdir, writeFile } from 'node:fs/promises';

const baseUrl = process.argv[2] || 'http://127.0.0.1:8792/';
const outputDir = process.argv[3] || '/tmp/tapeout-ux-loop';
const debugPort = process.argv[4] || '9245';
await mkdir(outputDir, { recursive: true });
const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
const pageTarget = targets.find(target => target.type === 'page');
if (!pageTarget?.webSocketDebuggerUrl) throw new Error('No inspectable Chromium page');
const socket = new WebSocket(pageTarget.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
let sequence = 0;
const pending = new Map();
socket.addEventListener('message', event => { const payload = JSON.parse(event.data); if (payload.id && pending.has(payload.id)) { const { resolve, reject } = pending.get(payload.id); pending.delete(payload.id); payload.error ? reject(new Error(payload.error.message)) : resolve(payload.result); } });
const command = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function capture(name, width, height, target) {
  await command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width <= 480 });
  await command('Page.enable');
  await command('Network.enable');
  await command('Network.setCacheDisabled', { cacheDisabled: true });
  await command('Page.navigate', { url: `${baseUrl}?ux-loop=${Date.now()}#${target}` });
  await sleep(5200);
  await command('Runtime.evaluate', { expression: `state.lang='en';localStorage.setItem('tapeout-lang','en');renderAll();` });
  await sleep(180);
  const result = await command('Runtime.evaluate', { expression: `(() => {
    const section=document.querySelector('#${target}'); section?.scrollIntoView({block:'start'});
    const nav=[...document.querySelectorAll('.terminal-nav a')]; const pulse=document.querySelector('.pulse-panel'); const daily=document.querySelector('.daily-panel');
    const pulseReading=document.querySelector('.pulse-reading'); const rect=node=>node?.getBoundingClientRect(); const p=rect(pulse),d=rect(daily);
    return {section:Boolean(section),nav:nav.length,pulseReading:Boolean(pulseReading),outerWidth:document.documentElement.scrollWidth,viewport:window.innerWidth,pulseTop:Math.round(p?.top||0),dailyTop:Math.round(d?.top||0),pulseBottom:Math.round(p?.bottom||0),dailyBottom:Math.round(d?.bottom||0),pulseReadingTop:Math.round(rect(pulseReading)?.top||0),controls:[...document.querySelectorAll('.activity-controls select')].length};
  })()`, returnByValue: true });
  const value = result?.result?.value;
  if (!value?.section || value.nav !== 6 || !value.pulseReading || value.controls !== 4 || value.outerWidth > value.viewport + 1) throw new Error(`UX loop contract failed: ${JSON.stringify(value)}`);
  await sleep(350);
  const image = await command('Page.captureScreenshot', { format:'png', captureBeyondViewport:false });
  await writeFile(`${outputDir}/${name}.png`, Buffer.from(image.data, 'base64'));
  return value;
}
const desktopPulse = await capture('desktop-pulse', 1440, 980, 'protocol-pulse');
const desktopHero = await capture('desktop-hero', 1440, 900, 'overview');
const mobilePulse = await capture('mobile-pulse', 390, 900, 'protocol-pulse');
socket.close();
console.log(JSON.stringify({ desktopPulse, desktopHero, mobilePulse }, null, 2));
