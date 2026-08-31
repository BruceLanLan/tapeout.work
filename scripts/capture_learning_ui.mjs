import { mkdir, writeFile } from 'node:fs/promises';

const baseUrl = process.argv[2] || 'http://127.0.0.1:8792/';
const outputDir = process.argv[3] || '/tmp/tapeout-learning-screens';
const debugPort = process.argv[4] || '9231';
await mkdir(outputDir, { recursive: true });
const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
const page = targets.find(target => target.type === 'page');
if (!page?.webSocketDebuggerUrl) throw new Error('No inspectable Chromium page');
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
let sequence = 0;
const pending = new Map();
socket.addEventListener('message', event => { const payload = JSON.parse(event.data); if (payload.id && pending.has(payload.id)) { const { resolve, reject } = pending.get(payload.id); pending.delete(payload.id); payload.error ? reject(new Error(payload.error.message)) : resolve(payload.result); } });
const command = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function capture(name, width, height) {
  await command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width <= 480 });
  await command('Page.enable');
  await command('Network.enable');
  await command('Network.setCacheDisabled', { cacheDisabled: true });
  await command('Page.navigate', { url: `${baseUrl}?learning-qa=${Date.now()}#learn` });
  await sleep(5200);
  await command('Runtime.evaluate', { expression: `state.lang='en';localStorage.setItem('tapeout-lang','en');renderAll();` });
  await sleep(200);
  const before = await command('Runtime.evaluate', { expression: `(() => {
    const panel=document.querySelector('#learn'); const resources=[...document.querySelectorAll('#learn-resources .learn-resource')];
    panel?.scrollIntoView({block:'start'});
    const grid=document.querySelector('.learn-grid'); const style=grid?getComputedStyle(grid):null; return {panel:Boolean(panel),steps:document.querySelectorAll('#learn-steps li').length,safety:document.querySelectorAll('#learn-safety li').length,resources:resources.length,outerWidth:document.documentElement.scrollWidth,viewport:window.innerWidth,learnGrid:style?.gridTemplateColumns||null,media680:matchMedia('(max-width:680px)').matches};
  })()`, returnByValue: true });
  const value = before?.result?.value;
  if (!value?.panel || value.steps !== 6 || value.safety !== 5 || value.resources < 1 || value.outerWidth > value.viewport + 1) throw new Error(`Learning initial render failed: ${JSON.stringify(value)}`);
  await sleep(500);
  const image = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(`${outputDir}/${name}.png`, Buffer.from(image.data, 'base64'));
  const after = await command('Runtime.evaluate', { expression: `(() => {
    const tier=document.querySelector('#learn-tier'); if (!tier) return {error:'no tier select'};
    tier.value='official'; tier.dispatchEvent(new Event('change',{bubbles:true})); return true;
  })()`, returnByValue: true });
  await sleep(900);
  const filtered = await command('Runtime.evaluate', { expression: `(() => ({tiers:[...document.querySelectorAll('#learn-resources .learn-tier')].map(n=>n.textContent.trim()),count:document.querySelectorAll('#learn-resources .learn-resource').length}))()`, returnByValue: true });
  const result=filtered?.result?.value;
  if (!result || !result.count || result.tiers.some(tier=>!['官方','Official'].includes(tier))) throw new Error(`Learning official filter failed: ${JSON.stringify(result)}`);
  await command('Runtime.evaluate', { expression: `(() => { const stage=document.querySelector('#learn-stage'); stage.value='pod'; stage.dispatchEvent(new Event('change',{bubbles:true})); })()` });
  await sleep(900);
  const pod = await command('Runtime.evaluate', { expression: `(() => ({cards:[...document.querySelectorAll('#learn-resources .learn-resource')].map(card=>card.innerText),count:document.querySelectorAll('#learn-resources .learn-resource').length}))()`, returnByValue: true });
  const podValue=pod?.result?.value;
  if (!podValue?.count || podValue.cards.some(card=>!/Proof of Design|PoD/i.test(card))) throw new Error(`Learning PoD stage filter failed: ${JSON.stringify(podValue)}`);
  await command('Runtime.evaluate', { expression: `state.lang='zh';localStorage.setItem('tapeout-lang','zh');renderAll();` });
  await sleep(250);
  const chinese = await command('Runtime.evaluate', { expression: `(() => ({title:document.querySelector('#learn h2')?.textContent,firstStep:document.querySelector('#learn-steps b')?.textContent}))()`, returnByValue: true });
  const chineseValue=chinese?.result?.value;
  if (!/教学中心/.test(chineseValue?.title || '') || !/四类对象/.test(chineseValue?.firstStep || '')) throw new Error(`Learning Chinese render failed: ${JSON.stringify(chineseValue)}`);
  return { initial:value, filtered:result, pod:podValue, chinese:chineseValue, after };
}
const desktop=await capture('learning-desktop',1440,900);
const mobile=await capture('learning-mobile',390,900);
socket.close();
console.log(JSON.stringify({desktop,mobile},null,2));
