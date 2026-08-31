import { mkdir, writeFile } from 'node:fs/promises';

const baseUrl = process.argv[2] || 'http://127.0.0.1:8799/';
const outputDir = process.argv[3] || '/tmp/tapeout-learning-navigation-ui';
const debugPort = process.argv[4] || '9288';
const cases = [
  { name:'desktop-zh', language:'zh', width:1440, height:1040, mobile:false },
  { name:'desktop-ja', language:'ja', width:1440, height:1040, mobile:false },
  { name:'mobile-zh', language:'zh', width:390, height:844, mobile:true },
  { name:'mobile-ar', language:'ar', width:390, height:844, mobile:true },
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
const waitFor=async(expression,label)=>{for(let attempt=0;attempt<100;attempt+=1){if(await evaluate(expression))return;await pause(150);}throw new Error(`Timed out: ${label}`);};
const shot=async file=>{const result=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(`${outputDir}/${file}.png`,Buffer.from(result.data,'base64'));};
const metrics=()=>evaluate(`(()=>{const menu=document.querySelector('#learning-nav-menu'),toggle=document.querySelector('#learning-nav-toggle'),mechanics=document.querySelector('#mechanics'),desktop=document.querySelector('.learning-nav-desktop');return {viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,lang:document.documentElement.lang,dir:document.documentElement.dir,selected:document.querySelector('#language-select')?.value,desktopLinks:desktop?.querySelectorAll('a').length||0,mobileLinks:menu?.querySelectorAll('a').length||0,mobileHidden:menu?.hidden,toggleExpanded:toggle?.getAttribute('aria-expanded'),toggleVisible:getComputedStyle(toggle).display!=='none',mechanicsCards:mechanics?.querySelectorAll('.mechanics-card').length||0,mechanicsSources:mechanics?.querySelectorAll('a[href^="https://tapeout.net/"]').length||0,mechanicsText:mechanics?.textContent?.trim()||'',mechanicsTop:Math.round(mechanics?.getBoundingClientRect().top||0),activeElement:document.activeElement?.id||''};})()`);
for(const item of cases){
  await command('Emulation.setDeviceMetricsOverride',{width:item.width,height:item.height,deviceScaleFactor:1,mobile:item.mobile});
  await command('Network.enable');await command('Network.setCacheDisabled',{cacheDisabled:true});
  await command('Page.navigate',{url:`${baseUrl}?learning-nav-r5=${Date.now()}-${item.name}`});
  await waitFor(`Boolean(typeof state!=='undefined'&&state.summary&&document.querySelector('#mechanics'))`,`${item.name} base state`);
  await evaluate(`setLanguage(${JSON.stringify(item.language)})`);
  await waitFor(`state.lang===${JSON.stringify(item.language)}&&document.querySelector('#mechanics')?.textContent?.trim()`,`${item.name} localized state`);
  let data=await metrics(); const expectedDir=item.language==='ar'?'rtl':'ltr';
  if(data.scrollWidth>data.viewport+1||data.desktopLinks!==6||data.mobileLinks!==6||data.mechanicsCards!==4||data.mechanicsSources!==5||data.selected!==item.language||data.dir!==expectedDir||data.mechanicsText.length<250) throw new Error(`${item.name} initial learning-navigation check failed: ${JSON.stringify(data)}`);
  if(item.mobile){
    if(!data.toggleVisible||!data.mobileHidden||data.toggleExpanded!=='false') throw new Error(`${item.name} mobile navigation initial state failed: ${JSON.stringify(data)}`);
    await evaluate(`document.querySelector('#learning-nav-toggle')?.click()`);
    await waitFor(`!document.querySelector('#learning-nav-menu')?.hidden&&document.querySelector('#learning-nav-toggle')?.getAttribute('aria-expanded')==='true'`,`${item.name} menu open`);
    await shot(`${item.name}-learning-nav-open`);
    await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))`);
    await waitFor(`document.querySelector('#learning-nav-menu')?.hidden&&document.querySelector('#learning-nav-toggle')?.getAttribute('aria-expanded')==='false'`,`${item.name} menu escape close`);
    await evaluate(`document.querySelector('#learning-nav-menu a[href="#mechanics"]')?.click()`);
    await evaluate(`document.querySelector('#mechanics')?.scrollIntoView({block:'start'});`);
  }else{
    if(data.toggleVisible) throw new Error(`${item.name} desktop toggle should be hidden: ${JSON.stringify(data)}`);
    await evaluate(`document.querySelector('#mechanics')?.scrollIntoView({block:'start'});`);
  }
  await pause(250);data=await metrics();
  if(data.scrollWidth>data.viewport+1||data.mechanicsTop>130||data.mechanicsCards!==4||data.mobileHidden===false) throw new Error(`${item.name} mechanics reading view failed: ${JSON.stringify(data)}`);
  await shot(`${item.name}-mechanics`);
  await writeFile(`${outputDir}/${item.name}.json`,JSON.stringify(data,null,2));
}
socket.close();
console.log('PASS: learning navigation UI matrix completed');
