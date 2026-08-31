import { mkdir, writeFile } from 'node:fs/promises';

const baseUrl = process.argv[2] || 'http://127.0.0.1:8820/';
const outputDir = process.argv[3] || '/tmp/tapeout-transistor-candles-ui';
const debugPort = process.argv[4] || '9288';
const cases = [
  { name:'desktop-zh', language:'zh', width:1440, height:1040, mobile:false, project:'behemoth', asset:'nand', interval:'1h', range:'24h' },
  { name:'desktop-ja', language:'ja', width:1440, height:1040, mobile:false, project:'tapeout', asset:'latch', interval:'1h', range:'24h' },
  { name:'mobile-zh', language:'zh', width:390, height:844, mobile:true, project:'genesis', asset:'nand', interval:'1h', range:'24h' },
  { name:'mobile-ar', language:'ar', width:390, height:844, mobile:true, project:'tapeout', asset:'latch', interval:'1h', range:'24h' },
];
await mkdir(outputDir,{recursive:true});
const targets=await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
const page=targets.find(target=>target.type==='page');
if(!page?.webSocketDebuggerUrl) throw new Error('No Chromium page available');
const socket=new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
let id=0;const pending=new Map();
socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id&&pending.has(message.id)){const call=pending.get(message.id);pending.delete(message.id);message.error?call.reject(new Error(message.error.message)):call.resolve(message.result);}});
const command=(method,params={})=>new Promise((resolve,reject)=>{const next=++id;pending.set(next,{resolve,reject});socket.send(JSON.stringify({id:next,method,params}));});
const evaluate=async expression=>(await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})).result?.value;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const waitFor=async(expression,label)=>{for(let attempt=0;attempt<110;attempt+=1){if(await evaluate(expression))return;await pause(150);}throw new Error(`Timed out: ${label}`);};
const metrics=()=>evaluate(`(()=>{const section=document.querySelector('#transistor-candle-chart')?.closest('.transistor-candle-section');const chart=document.querySelector('#transistor-candle-chart');const data=state.transistorCandleByKey?.[transistorCandleKey?.()];const buttons=[...document.querySelectorAll('[data-transistor-candle-asset]')];return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,lang:document.documentElement.lang,dir:document.documentElement.dir,selected:document.querySelector('#language-select')?.value,project:state.officialAssetProject,asset:state.transistorCandleAsset,interval:state.transistorCandleInterval,range:state.transistorCandleRange,candles:data?.candles?.length||0,status:data?.status||'',tier:data?.source?.tier||'',source:data?.source?.provider||'',boundary:document.querySelector('#transistor-candle-boundary')?.textContent?.trim()||'',chartTag:chart?.querySelector('svg')?.tagName||'',empty:chart?.querySelector('.transistor-candle-empty')?.textContent?.trim()||'',ohlc:document.querySelectorAll('#transistor-candle-ohlc span').length,activeAssets:buttons.filter(button=>button.getAttribute('aria-selected')==='true').length,selectedAsset:buttons.find(button=>button.getAttribute('aria-selected')==='true')?.dataset.transistorCandleAsset||'',sectionWidth:Math.round(section?.getBoundingClientRect().width||0),sectionText:section?.textContent?.trim()||''};})()`);
for(const item of cases){
  await command('Emulation.setDeviceMetricsOverride',{width:item.width,height:item.height,deviceScaleFactor:1,mobile:item.mobile});
  await command('Network.enable');await command('Network.setCacheDisabled',{cacheDisabled:true});
  await command('Page.navigate',{url:`${baseUrl}?transistor-candles-qa=${Date.now()}-${item.name}#holders`});
  await waitFor(`typeof state!=='undefined' && Boolean(document.querySelector('#transistor-candle-chart'))`,`${item.name} application`);
  await evaluate(`(async()=>{if(!state.officialAssets?.projects?.length){const [overview,addresses]=await Promise.all([fetch('/api/v1/official-assets/overview').then(r=>r.json()),fetch('/api/v1/official-assets/addresses?view=mints&project=behemoth&page=1&page_size=10').then(r=>r.json())]);state.officialAssets=overview;state.officialAssetAddresses=addresses;state.officialAssetAddressByProject={behemoth:addresses};state.officialAssetProject='behemoth';renderOfficialAssetObservation();}await setLanguage(${JSON.stringify(item.language)});renderOfficialAssetObservation();})()`);
  await waitFor(`state.lang===${JSON.stringify(item.language)} && document.querySelector('#language-select')?.value===${JSON.stringify(item.language)}`,`${item.name} language`);
  await evaluate(`document.querySelector('[data-official-asset-project=${JSON.stringify(item.project)}]')?.click()`);
  await waitFor(`state.officialAssetProject===${JSON.stringify(item.project)}`,`${item.name} project`);
  await evaluate(`document.querySelector('[data-transistor-candle-asset=${JSON.stringify(item.asset)}]')?.click();const interval=document.querySelector('#transistor-candle-interval');interval.value=${JSON.stringify(item.interval)};interval.dispatchEvent(new Event('change',{bubbles:true}));const range=document.querySelector('#transistor-candle-range');range.value=${JSON.stringify(item.range)};range.dispatchEvent(new Event('change',{bubbles:true}));`);
  await waitFor(`Boolean(state.transistorCandleByKey?.[transistorCandleKey?.()]) && !state.transistorCandleLoading`,`${item.name} candle data`);
  await evaluate(`document.querySelector('#transistor-candle-chart')?.closest('.transistor-candle-section')?.scrollIntoView({block:'start'});`);await pause(260);
  const data=await metrics(),expectedDir=item.language==='ar'?'rtl':'ltr',expectedHtmlLang=item.language==='zh'?'zh-CN':item.language;
  if(data.scrollWidth>data.width+1||data.lang!==expectedHtmlLang||data.selected!==item.language||data.dir!==expectedDir||data.project!==item.project||data.asset!==item.asset||data.interval!==item.interval||data.range!==item.range||data.tier!=='third_party'||!data.source||data.activeAssets!==1||data.selectedAsset!==item.asset||data.boundary.length<30||!data.sectionText||data.sectionWidth<100) throw new Error(`${item.name} candle UI check failed: ${JSON.stringify(data)}`);
  if(data.candles>0&&(!data.chartTag||data.ohlc!==5)) throw new Error(`${item.name} candle rendering missing: ${JSON.stringify(data)}`);
  if(data.candles===0&&!data.empty) throw new Error(`${item.name} candle empty state missing: ${JSON.stringify(data)}`);
  const shot=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  await writeFile(`${outputDir}/${item.name}-${item.project}-${item.asset}.png`,Buffer.from(shot.data,'base64'));
  await writeFile(`${outputDir}/${item.name}-${item.project}-${item.asset}.json`,JSON.stringify(data,null,2));
}
socket.close();console.log('PASS: transistor candle UI matrix completed');
