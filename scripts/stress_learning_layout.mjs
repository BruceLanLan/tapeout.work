import { mkdir, writeFile } from 'node:fs/promises';

const baseUrl = process.argv[2] || 'https://tapeout-public-monitor.tapeout-labs.workers.dev/';
const outputDir = process.argv[3] || '/tmp/tapeout-learning-stress';
const debugPort = process.argv[4] || '9256';
await mkdir(outputDir, { recursive: true });
const list = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
const target = list.find(item => item.type === 'page');
if (!target?.webSocketDebuggerUrl) throw new Error('No inspectable Chromium page');
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
let sequence = 0;
const pending = new Map();
socket.addEventListener('message', event => { const payload = JSON.parse(event.data); if (payload.id && pending.has(payload.id)) { const promise = pending.get(payload.id); pending.delete(payload.id); payload.error ? promise.reject(new Error(payload.error.message)) : promise.resolve(payload.result); } });
const command = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const viewports = [
  { name:'mobile360', width:360, height:800 },
  { name:'mobile390', width:390, height:844 },
  { name:'mobile412', width:412, height:915 },
  { name:'tablet768', width:768, height:1024 },
  { name:'laptop1024', width:1024, height:900 },
  { name:'desktop1440', width:1440, height:960 }
];
const languages = ['zh', 'en'];
const filters = [
  { name:'all', tier:'all', stage:'all', language:'all' },
  { name:'official', tier:'official', stage:'all', language:'all' },
  { name:'community', tier:'community', stage:'all', language:'all' },
  { name:'reference', tier:'reference', stage:'all', language:'all' },
  { name:'pod', tier:'all', stage:'pod', language:'all' },
  { name:'canvas', tier:'all', stage:'canvas', language:'all' },
  { name:'safety', tier:'all', stage:'safety', language:'all' },
  { name:'zhresources', tier:'all', stage:'all', language:'zh' },
  { name:'enresources', tier:'all', stage:'all', language:'en' }
];
const testResult = [];

async function evaluate(expression) { return (await command('Runtime.evaluate', { expression, returnByValue:true, awaitPromise:true }))?.result?.value; }
async function screenshot(name) { const image = await command('Page.captureScreenshot', { format:'png', captureBeyondViewport:false }); await writeFile(`${outputDir}/${name}.png`, Buffer.from(image.data, 'base64')); }
async function setSelect(id, value) { await evaluate(`(() => { const n=document.querySelector('#${id}'); if (!n) return false; n.value=${JSON.stringify(value)}; n.dispatchEvent(new Event('change',{bubbles:true})); return true; })()`); }
async function waitForLearningFilter(filter) { const expected=[filter.tier,filter.stage,filter.language].join('|'); for (let attempt=0; attempt<48; attempt+=1) { const ready=await evaluate(`(() => { const root=document.querySelector('#learn-resources'); return root?.dataset.filterKey===${JSON.stringify(expected)} && (root.querySelectorAll('.learn-resource').length > 0 || root.querySelector('.daily-empty')); })()`); if (ready) return true; await sleep(200); } return false; }

for (const viewport of viewports) {
  for (const lang of languages) {
    await command('Emulation.setDeviceMetricsOverride', { width:viewport.width, height:viewport.height, deviceScaleFactor:1, mobile:viewport.width <= 480 });
    await command('Page.enable'); await command('Network.enable'); await command('Network.setCacheDisabled',{cacheDisabled:true});
    await command('Page.navigate', { url:`${baseUrl}?learning-stress=${Date.now()}-${viewport.name}-${lang}#learn` });
    await sleep(2600);
    await evaluate(`document.querySelector('button[data-lang="${lang}"]')?.click()`);
    for (let ready = 0; ready < 16; ready += 1) {
      const hydrated = await evaluate(`document.querySelectorAll('#learn-steps li').length === 6 && document.querySelectorAll('#learn-safety li').length === 5`);
      if (hydrated) break;
      await sleep(250);
    }
    for (const filter of filters) {
      await setSelect('learn-tier', filter.tier);
      await sleep(100);
      await setSelect('learn-stage', filter.stage);
      await sleep(100);
      await setSelect('learn-language', filter.language);
      await sleep(160);
      const learningReady=await waitForLearningFilter(filter);
      const result = await evaluate(`(() => {
        const root=document.querySelector('#learn'); root?.scrollIntoView({block:'start'});
        const viewport=window.innerWidth;
        const allowedScrollable=new Set(['TABLE','SELECT']);
        const scopes=['#learn','.learn-intro-panel','.learn-map','.learn-grid','.learn-path-panel','.learn-safety-panel','.learn-resources-panel','.learn-resource-controls','.learn-resources','.learn-resource'];
        const violations=[];
        for (const selector of scopes) for (const node of document.querySelectorAll(selector)) {
          const r=node.getBoundingClientRect(); if (r.left < -1 || r.right > viewport + 1) violations.push({selector,left:Math.round(r.left),right:Math.round(r.right),width:Math.round(r.width)});
        }
        const textViolations=[];
        for (const node of document.querySelectorAll('#learn h2,#learn h3,#learn h4,#learn p,#learn b,#learn span,#learn a,#learn li,#learn input,#learn select')) {
          const r=node.getBoundingClientRect(); const style=getComputedStyle(node);
          if (!allowedScrollable.has(node.tagName) && style.position !== 'fixed' && r.width > 0 && (r.left < -1 || r.right > viewport + 1)) textViolations.push({tag:node.tagName,cls:node.className||'',right:Math.round(r.right),text:(node.textContent||'').trim().slice(0,60)});
        }
        const cards=[...document.querySelectorAll('#learn-resources .learn-resource')];
        const controls=[...document.querySelectorAll('.learn-resource-controls select')];
        const visualIssues=[];
        for (const label of document.querySelectorAll('.learn-resource-controls .select-field > span')) { const r=label.getBoundingClientRect(); if (r.height > 28) visualIssues.push({type:'compressed_filter_label',text:label.textContent?.trim(),height:Math.round(r.height)}); }
        const safetyPanel=document.querySelector('.learn-safety-panel'), safetyLink=document.querySelector('.learn-safety-link');
        if (safetyPanel && safetyLink && safetyPanel.getBoundingClientRect().bottom - safetyLink.getBoundingClientRect().bottom > 42) visualIssues.push({type:'stretched_safety_panel',gap:Math.round(safetyPanel.getBoundingClientRect().bottom - safetyLink.getBoundingClientRect().bottom)});
        return {viewport,scrollWidth:document.documentElement.scrollWidth,root:Boolean(root),cards:cards.length,controls:controls.length,steps:document.querySelectorAll('#learn-steps li').length,safety:document.querySelectorAll('#learn-safety li').length,violations,textViolations,visualIssues};
      })()`);
      const name=`${viewport.name}-${lang}-${filter.name}`;
      const pass=Boolean(learningReady) && Boolean(result?.root) && result.cards >= 0 && result.controls === 3 && result.steps === 6 && result.safety === 5 && result.scrollWidth <= result.viewport + 1 && result.violations.length === 0 && result.textViolations.length === 0 && result.visualIssues.length === 0;
      testResult.push({ name, pass, learningReady, ...result });
      if (!pass || (viewport.name === 'mobile390' && filter.name === 'all') || (viewport.name === 'desktop1440' && filter.name === 'all')) await screenshot(name);
    }
  }
}
await writeFile(`${outputDir}/results.json`, JSON.stringify(testResult, null, 2));
const failures=testResult.filter(row=>!row.pass);
console.log(JSON.stringify({ total:testResult.length, passed:testResult.length-failures.length, failed:failures.length, failures:failures.slice(0,20) },null,2));
socket.close();
if (failures.length) process.exitCode=1;
