import { mkdir, writeFile } from 'node:fs/promises';

const baseUrl = process.argv[2] || 'http://127.0.0.1:8794/';
const outputDir = process.argv[3] || '/tmp/tapeout-learning-resource-visual';
const debugPort = process.argv[4] || '9256';
await mkdir(outputDir, { recursive: true });
const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
const page = targets.find(target => target.type === 'page');
if (!page?.webSocketDebuggerUrl) throw new Error('No Chromium page available');
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once:true }); socket.addEventListener('error', reject, { once:true }); });
let sequence = 0;
const pending = new Map();
socket.addEventListener('message', event => { const payload = JSON.parse(event.data); if (payload.id && pending.has(payload.id)) { const request = pending.get(payload.id); pending.delete(payload.id); payload.error ? request.reject(new Error(payload.error.message)) : request.resolve(payload.result); } });
const command = (method, params={}) => new Promise((resolve,reject) => { const id=++sequence; pending.set(id,{resolve,reject}); socket.send(JSON.stringify({id,method,params})); });
const evaluate = async expression => (await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})).result?.value;
const sleep = ms => new Promise(resolve => setTimeout(resolve,ms));
for (const viewport of [{name:'desktop',width:1440,height:980,mobile:false},{name:'mobile',width:390,height:844,mobile:true}]) {
  await command('Emulation.setDeviceMetricsOverride',{width:viewport.width,height:viewport.height,deviceScaleFactor:1,mobile:viewport.mobile});
  await command('Network.enable'); await command('Network.setCacheDisabled',{cacheDisabled:true});
  await command('Page.navigate',{url:`${baseUrl}?resource-visual=${Date.now()}-${viewport.name}#learn`});
  for (let n=0;n<40;n+=1) { const ready=await evaluate(`document.querySelectorAll('#learn-resources .learn-resource').length === 6`); if (ready) break; await sleep(250); }
  const layout = await evaluate(`(() => { const panel=document.querySelector('.learn-resources-panel'); panel?.scrollIntoView({block:'start'}); const controls=[...document.querySelectorAll('.learn-resource-controls .select-field > span')].map(node=>({text:node.textContent.trim(),height:Math.round(node.getBoundingClientRect().height),width:Math.round(node.getBoundingClientRect().width)})); const cards=[...document.querySelectorAll('#learn-resources .learn-resource')].slice(0,3).map(node=>Math.round(node.getBoundingClientRect().width)); return {scrollWidth:document.documentElement.scrollWidth,viewport:window.innerWidth,controls,cards}; })()`);
  await sleep(160);
  const image = await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  await writeFile(`${outputDir}/${viewport.name}-resources.png`,Buffer.from(image.data,'base64'));
  await writeFile(`${outputDir}/${viewport.name}-layout.json`,JSON.stringify(layout,null,2));
  if (layout.scrollWidth > layout.viewport + 1 || layout.controls.some(item => item.height > 28)) throw new Error(`${viewport.name} resource controls are not readable`);
}
socket.close();
console.log('PASS: desktop and mobile resource controls are readable and contained');
