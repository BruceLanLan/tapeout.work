import { mkdir, writeFile } from 'node:fs/promises';

const baseUrl = (process.argv[2] || 'http://127.0.0.1:8787').replace(/\/$/, '');
const outputDir = process.argv[3] || '/tmp/tapeout-registry-label-governance-ui';
const debugPort = process.argv[4] || '9288';
await mkdir(outputDir, { recursive: true });
const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
const page = targets.find(target => target.type === 'page');
if (!page?.webSocketDebuggerUrl) throw new Error('No inspectable Chromium page');
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
let id = 0; const pending = new Map();
socket.addEventListener('message', event => { const message = JSON.parse(event.data); if (message.id && pending.has(message.id)) { const call = pending.get(message.id); pending.delete(message.id); message.error ? call.reject(new Error(message.error.message)) : call.resolve(message.result); } });
const command = (method, params = {}) => new Promise((resolve, reject) => { const next = ++id; pending.set(next, { resolve, reject }); socket.send(JSON.stringify({ id: next, method, params })); });
const evaluate = async expression => (await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const waitFor = async (expression, label) => { for (let attempt = 0; attempt < 120; attempt += 1) { if (await evaluate(expression)) return; await sleep(150); } throw new Error(`Timed out: ${label}`); };
const snapshot = () => evaluate(`(()=>{const panel=document.querySelector('.registry-panel');const wrap=panel?.querySelector('.table-wrap');const row=[...document.querySelectorAll('#processors tr')].find(node=>/Blonskr_No1/i.test(node.textContent||''));return {page:state.registry?.page,total:state.registry?.total,apiLabel:state.registry?.items?.find(item=>/Blonskr_No1/i.test(item.name||''))?.website_label ?? null,search:document.querySelector('#search')?.value,rowText:row?.textContent?.trim()||'',rowBadge:Boolean(row?.querySelector('.website-label')),headerCount:panel?.querySelectorAll('thead th')?.length||0,headerText:panel?.querySelector('thead')?.textContent?.trim()||'',documentWidth:document.documentElement.scrollWidth,viewport:innerWidth,tableOverflow:wrap ? wrap.scrollWidth > wrap.clientWidth : false,status:document.querySelector('#page-status')?.textContent?.trim()||'',dir:document.documentElement.dir,lang:document.documentElement.lang};})()`);
for (const item of [
  { name: 'desktop-zh-blonskr', lang: 'zh', width: 1440, height: 1000, mobile: false },
  { name: 'mobile-zh-blonskr', lang: 'zh', width: 390, height: 900, mobile: true },
  { name: 'mobile-ar-blonskr', lang: 'ar', width: 390, height: 900, mobile: true },
]) {
  await command('Emulation.setDeviceMetricsOverride', { width: item.width, height: item.height, deviceScaleFactor: 1, mobile: item.mobile });
  await command('Network.enable'); await command('Network.setCacheDisabled', { cacheDisabled: true });
  await command('Page.navigate', { url: `${baseUrl}/?registry-label-r12=${Date.now()}-${item.name}#registry` });
  await waitFor(`Boolean(typeof state !== 'undefined' && state.registry && document.querySelector('#processors')?.textContent?.trim())`, `${item.name} base registry`);
  await evaluate(`(async()=>{await setLanguage(${JSON.stringify(item.lang)});document.querySelector('#registry')?.scrollIntoView({block:'start'});})()`);
  await evaluate(`(()=>{const input=document.querySelector('#search');input.value='BLONSKR_NO1';input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await waitFor(`state.search==='BLONSKR_NO1' && state.registry?.filters?.q==='BLONSKR_NO1' && state.registry?.items?.some(item=>item.name==='Blonskr_No1') && document.querySelector('#processors')?.textContent?.includes('Blonskr_No1')`, `${item.name} Blonskr search`);
  const found = await snapshot();
  const expectedDir = item.lang === 'ar' ? 'rtl' : 'ltr';
  const expectedLang = item.lang === 'zh' ? 'zh-CN' : item.lang;
  if (found.apiLabel !== null || found.rowBadge || !/Blonskr_No1/i.test(found.rowText) || /Official|官方|رسمي/i.test(found.headerText) || found.headerCount !== 5 || found.documentWidth > found.viewport + 1 || found.dir !== expectedDir || found.lang !== expectedLang || (item.mobile && !found.tableOverflow) || (!item.mobile && found.tableOverflow)) throw new Error(`${item.name} Registry governance audit failed: ${JSON.stringify(found)}`);
  await sleep(220);
  const image = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(`${outputDir}/${item.name}.png`, Buffer.from(image.data, 'base64'));
  await writeFile(`${outputDir}/${item.name}.json`, JSON.stringify(found, null, 2));
}
socket.close();
console.log('PASS: r12 Registry label governance UI audit complete');
