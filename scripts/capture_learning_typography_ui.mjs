import { mkdir, writeFile } from 'node:fs/promises';

const baseUrl=process.argv[2] || 'http://127.0.0.1:8796/';
const outputDir=process.argv[3] || '/tmp/tapeout-learning-typography-full';
const debugPort=process.argv[4] || '9260';
await mkdir(outputDir,{recursive:true});
const targets=await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
const page=targets.find(target=>target.type==='page');
if(!page?.webSocketDebuggerUrl) throw new Error('No Chromium page available');
const socket=new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
let id=0;const pending=new Map();
socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id&&pending.has(message.id)){const entry=pending.get(message.id);pending.delete(message.id);message.error?entry.reject(new Error(message.error.message)):entry.resolve(message.result);}});
const command=(method,params={})=>new Promise((resolve,reject)=>{const next=++id;pending.set(next,{resolve,reject});socket.send(JSON.stringify({id:next,method,params}));});
const evaluate=async expression=>(await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})).result?.value;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
for(const viewport of [{name:'desktop',width:1440,height:1040,mobile:false},{name:'mobile',width:390,height:844,mobile:true}]){
  for(const language of ['zh','en']){
    await command('Emulation.setDeviceMetricsOverride',{width:viewport.width,height:viewport.height,deviceScaleFactor:1,mobile:viewport.mobile});
    await command('Network.enable');await command('Network.setCacheDisabled',{cacheDisabled:true});
    await command('Page.navigate',{url:`${baseUrl}?typography=${Date.now()}-${viewport.name}-${language}#learn`});
    for(let attempt=0;attempt<60;attempt+=1){const ready=await evaluate(`document.querySelectorAll('#learn-steps li').length===6&&document.querySelectorAll('#learn-safety li').length===5`);if(ready)break;await pause(200);}
    await evaluate(`state.lang=${JSON.stringify(language)};localStorage.setItem('tapeout-lang',${JSON.stringify(language)});renderAll();document.querySelector('#learn')?.scrollIntoView({block:'start'});`);
    await pause(220);
    const metrics=await evaluate(`(()=>{const learn=document.querySelector('#learn');const path=document.querySelector('.learn-path-panel');const safety=document.querySelector('.learn-safety-panel');const cards=[...document.querySelectorAll('.learn-steps li')];const resource=document.querySelector('.learn-resource');return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,learnTop:Math.round(learn?.getBoundingClientRect().top||0),pathHeight:Math.round(path?.getBoundingClientRect().height||0),safetyHeight:Math.round(safety?.getBoundingClientRect().height||0),stepMinHeight:Math.min(...cards.map(node=>Math.round(node.getBoundingClientRect().height))),resourceTitleLineHeight:getComputedStyle(resource?.querySelector('h4')).lineHeight};})()`);
    if(metrics.scrollWidth>metrics.width+1||metrics.stepMinHeight<60)throw new Error(`${viewport.name}-${language} typography containment failed: ${JSON.stringify(metrics)}`);
    const shot=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    await writeFile(`${outputDir}/${viewport.name}-${language}.png`,Buffer.from(shot.data,'base64'));
    await writeFile(`${outputDir}/${viewport.name}-${language}.json`,JSON.stringify(metrics,null,2));
  }
}
socket.close();
console.log('PASS: learning typography visual matrix completed');
