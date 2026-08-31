import { mkdir, writeFile } from 'node:fs/promises';

const baseUrl = process.argv[2] || 'http://127.0.0.1:8796/';
const outputDir = process.argv[3] || '/tmp/tapeout-curated-ecosystem-ui';
const debugPort = process.argv[4] || '9264';
const locales = (process.env.CAPTURE_LOCALES || 'zh,en,ko,ja,es,ar,tr,de,ru').split(',').map(locale => locale.trim()).filter(Boolean);
const viewports = [{ name:'desktop', width:1440, height:1040, mobile:false }, { name:'mobile', width:390, height:844, mobile:true }];
await mkdir(outputDir, { recursive:true });
const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
const page = targets.find(target => target.type === 'page');
if (!page?.webSocketDebuggerUrl) throw new Error('No Chromium page available');
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve,reject) => { socket.addEventListener('open',resolve,{once:true}); socket.addEventListener('error',reject,{once:true}); });
let id = 0; const pending = new Map();
socket.addEventListener('message', event => { const message=JSON.parse(event.data); if (message.id && pending.has(message.id)) { const call=pending.get(message.id); pending.delete(message.id); message.error ? call.reject(new Error(message.error.message)) : call.resolve(message.result); } });
const command = (method,params={}) => new Promise((resolve,reject) => { const next=++id; pending.set(next,{resolve,reject}); socket.send(JSON.stringify({id:next,method,params})); });
const evaluate = async expression => (await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})).result?.value;
const pause = ms => new Promise(resolve => setTimeout(resolve,ms));
const waitFor = async (expression, label) => {
  for (let attempt=0; attempt<180; attempt+=1) { if (await evaluate(expression)) return; await pause(150); }
  throw new Error(`Timed out: ${label}`);
};
const metrics = () => evaluate(`(()=>{const updates=[...document.querySelectorAll('.update-card')];const tools=[...document.querySelectorAll('.tool-card')];const panel=document.querySelector('.ecosystem-grid');const toggle=document.querySelector('#tools-toggle');return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,lang:document.documentElement.lang,dir:document.documentElement.dir,selected:document.querySelector('#language-select')?.value,updates:updates.length,tools:tools.length,panelWidth:Math.round(panel?.getBoundingClientRect().width||0),toggleVisible:Boolean(toggle && !toggle.hidden),toggleExpanded:toggle?.getAttribute('aria-expanded'),localizedUpdate:updates[0]?.querySelector('h4')?.textContent?.trim()||'',localizedTool:tools[0]?.querySelector('h4')?.textContent?.trim()||'',hasRisk:(state.tools?.items||[]).every(item=>String(item.localized?.safety||'').trim().length>8),marketCommunity:(()=>{const tools=state.tools?.items||[];const market=tools.find(item=>item.id==='tool-tapeout-market');return market?.tier==='community'&&/community/i.test(market.operator||'')&&!tools.some(item=>item.id==='tool-market-qa')&&!tools.some(item=>item.id==='tool-tapeoutgo');})()};})()`);
const assertMetrics = (data, language, expectedTools, expectedExpanded, stage) => {
  const expectedDir=language==='ar'?'rtl':'ltr';
  if (data.scrollWidth > data.width + 1 || data.updates!==4 || data.tools!==expectedTools || !data.toggleVisible || data.toggleExpanded!==String(expectedExpanded) || data.selected!==language || data.dir!==expectedDir || data.localizedUpdate.length<4 || data.localizedTool.length<3 || !data.hasRisk || !data.marketCommunity) throw new Error(`${stage} ecosystem check failed: ${JSON.stringify(data)}`);
};

for (const viewport of viewports) for (const language of locales) {
  await command('Emulation.setDeviceMetricsOverride',{width:viewport.width,height:viewport.height,deviceScaleFactor:1,mobile:viewport.mobile});
  await command('Network.enable'); await command('Network.setCacheDisabled',{cacheDisabled:true});
  await command('Page.navigate',{url:`${baseUrl}?ecosystem=${Date.now()}-${viewport.name}-${language}#discover`});
  await waitFor(`typeof state !== 'undefined'`, `${viewport.name}-${language} application state`);
  await evaluate(`(async()=>{if(!state.updates?.items?.length) state.updates=await fetch('/api/v1/updates?page=1&page_size=12&locale='+encodeURIComponent(state.lang)).then(r=>r.json());if(!state.tools?.items?.length) state.tools=await fetch('/api/v1/tools?page=1&page_size=12&locale='+encodeURIComponent(state.lang)).then(r=>r.json());renderCuratedEcosystem();})()`);
  await waitFor(`Boolean(state.updates?.items?.length===4 && state.tools?.items?.length===8)`, `${viewport.name}-${language} ecosystem base data`);
  await evaluate(`(async()=>{await setLanguage(${JSON.stringify(language)});await loadCuratedEcosystem();})()`);
  await waitFor(`state.lang===${JSON.stringify(language)} && state.updates?.response_locale===${JSON.stringify(language)} && state.tools?.response_locale===${JSON.stringify(language)} && state.toolsExpanded===false`, `${viewport.name}-${language} localized collapsed state`);
  await evaluate(`document.querySelector('#discover')?.scrollIntoView({block:'start'});`); await pause(300);
  const collapsed = await metrics();
  assertMetrics(collapsed, language, 3, false, `${viewport.name}-${language}-collapsed`);
  const collapsedShot=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  await writeFile(`${outputDir}/${viewport.name}-${language}-ecosystem-collapsed.png`,Buffer.from(collapsedShot.data,'base64'));
  await evaluate(`document.querySelector('#tools-toggle')?.scrollIntoView({block:'center'});`); await pause(180);
  const collapsedToggleShot=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  await writeFile(`${outputDir}/${viewport.name}-${language}-tools-collapsed.png`,Buffer.from(collapsedToggleShot.data,'base64'));

  await evaluate(`document.querySelector('#tools-toggle')?.click()`);
  await waitFor(`state.toolsExpanded===true && document.querySelectorAll('.tool-card').length===8 && document.querySelector('#tools-toggle')?.getAttribute('aria-expanded')==='true'`, `${viewport.name}-${language} expanded state`);
  await pause(220);
  const expanded = await metrics();
  assertMetrics(expanded, language, 8, true, `${viewport.name}-${language}-expanded`);
  await evaluate(`document.querySelector('[data-tool-id="tool-tapeout-market"]')?.scrollIntoView({block:'center'});`); await pause(220);
  const expandedShot=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  await writeFile(`${outputDir}/${viewport.name}-${language}-tools-expanded.png`,Buffer.from(expandedShot.data,'base64'));

  await evaluate(`document.querySelector('#tools-toggle')?.click()`);
  await waitFor(`state.toolsExpanded===false && document.querySelectorAll('.tool-card').length===3 && document.querySelector('#tools-toggle')?.getAttribute('aria-expanded')==='false'`, `${viewport.name}-${language} re-collapsed state`);
  await writeFile(`${outputDir}/${viewport.name}-${language}.json`,JSON.stringify({collapsed, expanded},null,2));
}
socket.close();
console.log('PASS: curated ecosystem collapsed-and-expanded UI matrix completed');
