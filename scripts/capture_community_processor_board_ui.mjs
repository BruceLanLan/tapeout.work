import { mkdir, writeFile } from 'node:fs/promises';

const baseUrl = process.argv[2] || 'http://127.0.0.1:8797/';
const outputDir = process.argv[3] || '/tmp/tapeout-community-board-ui';
const debugPort = process.argv[4] || '9271';
const cases = [
  { name:'desktop-zh', language:'zh', width:1440, height:1040, mobile:false },
  { name:'mobile-zh', language:'zh', width:390, height:844, mobile:true },
  { name:'desktop-ja', language:'ja', width:1440, height:1040, mobile:false },
  { name:'mobile-ar', language:'ar', width:390, height:844, mobile:true },
];
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
for (const item of cases) {
  await command('Emulation.setDeviceMetricsOverride',{width:item.width,height:item.height,deviceScaleFactor:1,mobile:item.mobile});
  await command('Network.enable'); await command('Network.setCacheDisabled',{cacheDisabled:true});
  await command('Page.navigate',{url:`${baseUrl}?community-board=${Date.now()}-${item.name}#holders`});
  for(let attempt=0;attempt<100;attempt+=1) { const ready=await evaluate(`Boolean(window.state?.summary && window.state?.analytics && state.communityBoard?.items?.length)`); if(ready) break; await pause(150); }
  await evaluate(`setLanguage(${JSON.stringify(item.language)})`);
  for(let attempt=0;attempt<80;attempt+=1) { const ready=await evaluate(`state.lang===${JSON.stringify(item.language)} && document.querySelector('#holders')?.textContent.includes(state.lang==='zh'?'社区':'') !== false`); if(ready) break; await pause(120); }
  await evaluate(`document.querySelector('#holders')?.scrollIntoView({block:'start'});`); await pause(300);
  const metrics = await evaluate(`(()=>{const section=document.querySelector('#holders');const rows=[...document.querySelectorAll('#community-holder-rows tr')];const board=state.communityBoard;return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,lang:document.documentElement.lang,dir:document.documentElement.dir,selected:document.querySelector('#language-select')?.value,rows:rows.length,status:board?.status,addresses:board?.total,summary:document.querySelector('#community-holder-summary')?.textContent?.trim()||'',boundary:document.querySelector('.community-holder-footer small:last-child')?.textContent?.trim()||'',sectionWidth:Math.round(section?.getBoundingClientRect().width||0),tableWidth:Math.round(document.querySelector('.community-holder-table table')?.getBoundingClientRect().width||0),addressText:rows[0]?.querySelector('.mono')?.textContent?.trim()||''};})()`);
  const expectedDir=item.language==='ar'?'rtl':'ltr';
  if(metrics.scrollWidth > metrics.width + 1 || metrics.rows !== 10 || metrics.status !== 'healthy' || metrics.addresses < 1 || metrics.selected !== item.language || metrics.dir !== expectedDir || metrics.boundary.length < 50 || !/^0x[a-f0-9]{8}/i.test(metrics.addressText)) throw new Error(`${item.name} board check failed: ${JSON.stringify(metrics)}`);
  const shot=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  await writeFile(`${outputDir}/${item.name}-board.png`,Buffer.from(shot.data,'base64'));
  await writeFile(`${outputDir}/${item.name}.json`,JSON.stringify(metrics,null,2));
}
socket.close();
console.log('PASS: community processor board UI matrix completed');
