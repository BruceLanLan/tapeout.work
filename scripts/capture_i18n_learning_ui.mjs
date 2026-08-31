import { mkdir, writeFile } from 'node:fs/promises';

const baseUrl = process.argv[2] || 'http://127.0.0.1:8796/';
const outputDir = process.argv[3] || '/tmp/tapeout-i18n-learning-ui';
const debugPort = process.argv[4] || '9262';
const locales = ['ko', 'ja', 'es', 'ar'];
const viewports = [
  { name: 'desktop', width: 1440, height: 1040, mobile: false },
  { name: 'mobile', width: 390, height: 844, mobile: true }
];
await mkdir(outputDir, { recursive: true });
const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
const page = targets.find(target => target.type === 'page');
if (!page?.webSocketDebuggerUrl) throw new Error('No Chromium page available');
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
let id = 0;
const pending = new Map();
socket.addEventListener('message', event => { const message = JSON.parse(event.data); if (message.id && pending.has(message.id)) { const entry = pending.get(message.id); pending.delete(message.id); message.error ? entry.reject(new Error(message.error.message)) : entry.resolve(message.result); } });
const command = (method, params = {}) => new Promise((resolve, reject) => { const next = ++id; pending.set(next, { resolve, reject }); socket.send(JSON.stringify({ id: next, method, params })); });
const evaluate = async expression => (await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

for (const viewport of viewports) {
  for (const language of locales) {
    await command('Emulation.setDeviceMetricsOverride', { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: viewport.mobile });
    await command('Network.enable');
    await command('Network.setCacheDisabled', { cacheDisabled: true });
    await command('Page.navigate', { url: `${baseUrl}?i18n=${Date.now()}-${viewport.name}-${language}#learn` });
    for (let attempt = 0; attempt < 80; attempt += 1) {
      const ready = await evaluate(`Boolean(window.state?.summary && window.state?.analytics && window.state?.learning && document.querySelectorAll('#learn-steps li').length===6)`);
      if (ready) break;
      await pause(150);
    }
    await evaluate(`setLanguage(${JSON.stringify(language)})`);
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const ready = await evaluate(`state.lang===${JSON.stringify(language)} && document.documentElement.lang===LANGUAGE_CONFIG[${JSON.stringify(language)}].htmlLang && document.querySelectorAll('#learn-steps li').length===6 && Object.keys(state.learningLocalization[${JSON.stringify(language)}] || {}).length===12`);
      if (ready) break;
      await pause(150);
    }
    await evaluate(`document.querySelector('#learn')?.scrollIntoView({block:'start'});`);
    await pause(300);
    const pathMetrics = await evaluate(`(()=>{const path=document.querySelector('.learn-path-panel');const safety=document.querySelector('.learn-safety-panel');const resource=document.querySelector('.learn-resource');const title=resource?.querySelector('h4')?.textContent?.trim()||'';return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,lang:document.documentElement.lang,dir:document.documentElement.dir,selected:document.querySelector('#language-select')?.value,steps:document.querySelectorAll('#learn-steps li').length,safety:document.querySelectorAll('#learn-safety li').length,localizedResources:Object.keys(state.learningLocalization[state.lang]||{}).length,pathHeight:Math.round(path?.getBoundingClientRect().height||0),safetyHeight:Math.round(safety?.getBoundingClientRect().height||0),resourceTitle:title,resourceTitleLength:title.length};})()`);
    const expectedDir = language === 'ar' ? 'rtl' : 'ltr';
    if (pathMetrics.scrollWidth > pathMetrics.width + 1 || pathMetrics.steps !== 6 || pathMetrics.safety !== 5 || pathMetrics.localizedResources !== 12 || pathMetrics.selected !== language || pathMetrics.dir !== expectedDir || pathMetrics.resourceTitleLength < 4) throw new Error(`${viewport.name}-${language} path check failed: ${JSON.stringify(pathMetrics)}`);
    const pathShot = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await writeFile(`${outputDir}/${viewport.name}-${language}-path.png`, Buffer.from(pathShot.data, 'base64'));
    await evaluate(`document.querySelector('.learn-resources-panel')?.scrollIntoView({block:'start'});`);
    await pause(250);
    const resourceMetrics = await evaluate(`(()=>{const panel=document.querySelector('.learn-resources-panel');const card=document.querySelector('.learn-resource');const controls=document.querySelector('.learn-resource-controls');return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,panelWidth:Math.round(panel?.getBoundingClientRect().width||0),cardWidth:Math.round(card?.getBoundingClientRect().width||0),controlsWidth:Math.round(controls?.getBoundingClientRect().width||0),title:card?.querySelector('h4')?.textContent?.trim()||'',summary:card?.querySelector('p')?.textContent?.trim()||''};})()`);
    if (resourceMetrics.scrollWidth > resourceMetrics.width + 1 || !resourceMetrics.title || !resourceMetrics.summary) throw new Error(`${viewport.name}-${language} resource check failed: ${JSON.stringify(resourceMetrics)}`);
    const resourceShot = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await writeFile(`${outputDir}/${viewport.name}-${language}-resources.png`, Buffer.from(resourceShot.data, 'base64'));
    await writeFile(`${outputDir}/${viewport.name}-${language}.json`, JSON.stringify({ pathMetrics, resourceMetrics }, null, 2));
  }
}
socket.close();
console.log('PASS: i18n learning UI matrix completed');
