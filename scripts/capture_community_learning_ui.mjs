import { mkdir, writeFile } from 'node:fs/promises';

const baseUrl=(process.argv[2]||'http://127.0.0.1:8787/').replace(/\/$/,'');
const outputDir=process.argv[3]||'/tmp/tapeout-community-learning-ui';
const debugPort=process.argv[4]||'9288';
const locales=['zh','en','ar'];
const viewports=[{name:'desktop',width:1440,height:1040,mobile:false},{name:'mobile',width:390,height:844,mobile:true}];
await mkdir(outputDir,{recursive:true});
const targets=await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
const page=targets.find(target=>target.type==='page');
if(!page?.webSocketDebuggerUrl) throw new Error('No Chromium page available');
const socket=new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
let sequence=0; const pending=new Map();
socket.addEventListener('message',event=>{const payload=JSON.parse(event.data);if(payload.id&&pending.has(payload.id)){const item=pending.get(payload.id);pending.delete(payload.id);payload.error?item.reject(new Error(payload.error.message)):item.resolve(payload.result);}});
const command=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>(await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})).result?.value;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const waitFor=async(expression,label)=>{for(let n=0;n<160;n+=1){if(await evaluate(expression))return;await sleep(150);}throw new Error(`Timed out: ${label}`);};
for(const viewport of viewports) for(const language of locales){
  await command('Emulation.setDeviceMetricsOverride',{width:viewport.width,height:viewport.height,deviceScaleFactor:1,mobile:viewport.mobile});
  await command('Network.enable'); await command('Network.setCacheDisabled',{cacheDisabled:true});
  await command('Page.navigate',{url:`${baseUrl}/?community-video-r12=${Date.now()}-${viewport.name}-${language}#learn`});
  await waitFor(`typeof state!=='undefined'`,`${viewport.name}-${language} state`);
  await evaluate(`(async()=>{await setLanguage(${JSON.stringify(language)});state.learningTier='community';state.learningStage='basics';state.learningLanguage='all';state.learningSearch='';await loadLearning(1);})()`);
  await waitFor(`state.lang===${JSON.stringify(language)}&&state.learning?.items?.some(item=>item.id==='community-93bitmap-video-intro')`,`${viewport.name}-${language} video`);
  const metrics=await evaluate(`(()=>{try{const cards=[...document.querySelectorAll('#learn-resources .learn-resource')];const video=cards.find(node=>/93\\.bitmap|science primer|科普第一集|تمهيد علمي/i.test(node.textContent||''));document.querySelector('#learn-resources')?.scrollIntoView({block:'start'});const widths=cards.map(node=>({scrollWidth:node.scrollWidth,clientWidth:node.clientWidth}));return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,lang:document.documentElement.lang,dir:document.documentElement.dir,selected:document.querySelector('#language-select')?.value,tier:document.querySelector('#learn-tier')?.value,stage:document.querySelector('#learn-stage')?.value,cards:cards.length,widths,videoText:video?.textContent?.trim()||'',videoCommunity:Boolean(video?.querySelector('.learn-tier.community')),videoExternalLink:Boolean(video?.querySelector('a[target=\\"_blank\\"]')),communityLabels:cards.filter(node=>node.querySelector('.learn-tier.community')).length};}catch(error){return {error:String(error)}}})()`);
  const expectedDir=language==='ar'?'rtl':'ltr';
  if(!metrics||metrics.error||metrics.scrollWidth>metrics.width+1||metrics.lang!==(language==='zh'?'zh-CN':language)||metrics.dir!==expectedDir||metrics.selected!==language||metrics.tier!=='community'||metrics.stage!=='basics'||metrics.cards<2||metrics.communityLabels!==metrics.cards||!metrics.videoCommunity||!metrics.videoExternalLink||metrics.videoText.length<100||metrics.widths.some(item=>item.scrollWidth>item.clientWidth+1)) throw new Error(`${viewport.name}-${language} community-video check failed: ${JSON.stringify(metrics)}`);
  await sleep(220);
  const shot=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  await writeFile(`${outputDir}/${viewport.name}-${language}-community-video.png`,Buffer.from(shot.data,'base64'));
  await writeFile(`${outputDir}/${viewport.name}-${language}-community-video.json`,JSON.stringify(metrics,null,2));
}
socket.close();
console.log('PASS: r12 community video UI matrix complete');
