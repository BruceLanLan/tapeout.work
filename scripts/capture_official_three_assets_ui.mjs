import { mkdir, writeFile } from 'node:fs/promises';

const baseUrl = process.argv[2] || 'http://127.0.0.1:8799/';
const outputDir = process.argv[3] || '/tmp/tapeout-official-three-assets-ui';
const debugPort = process.argv[4] || '9273';
const cases = [
  { name:'desktop-zh', language:'zh', width:1440, height:1040, mobile:false },
  { name:'mobile-zh', language:'zh', width:390, height:844, mobile:true },
  { name:'desktop-ja', language:'ja', width:1440, height:1040, mobile:false },
  { name:'mobile-ar', language:'ar', width:390, height:844, mobile:true },
];
const projects=['behemoth','tapeout','genesis'];
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
const waitFor = async (expression,label) => { for(let attempt=0;attempt<100;attempt+=1) { if(await evaluate(expression)) return; await pause(150); } throw new Error(`Timed out: ${label}`); };
const metrics = () => evaluate(`(()=>{const section=document.querySelector('#holders');const rows=[...document.querySelectorAll('#official-asset-address-rows tr')];const data=state.officialAssets;const active=state.officialAssetProject;const activeRows=state.officialAssetAddressByProject?.[active];const activeTab=document.querySelector('[data-official-asset-project="'+active+'"]');return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,lang:document.documentElement.lang,dir:document.documentElement.dir,selected:document.querySelector('#language-select')?.value,projects:data?.projects?.map(project=>project.project_key),rows:rows.length,status:data?.status,active,activeFilter:activeRows?.filters?.project,activeBreakdownOnly:(activeRows?.items||[]).every(item=>Object.keys(item.project_breakdown||{}).every(key=>key===active)),sectionWidth:Math.round(section?.getBoundingClientRect().width||0),tableWidth:Math.round(document.querySelector('.official-asset-table table')?.getBoundingClientRect().width||0),addressText:rows[0]?.querySelector('.mono')?.textContent?.trim()||'',boundary:document.querySelector('.official-asset-footer small:last-child')?.textContent?.trim()||'',minterHint:rows[0]?.querySelector('td small')?.textContent?.trim()||'',projectCards:document.querySelectorAll('.official-asset-projects article').length,projectCardKey:document.querySelector('.official-asset-projects article')?.dataset.projectKey||'',tabCount:document.querySelectorAll('[data-official-asset-project]').length,activeSelected:activeTab?.getAttribute('aria-selected'),headerColumns:document.querySelectorAll('.official-asset-table th').length,officialSource:document.querySelector('.asset-source-chip.is-official')?.textContent?.trim()||'',thirdPartyPending:document.querySelector('.asset-source-chip.is-standby')?.textContent?.trim()||'',contract:document.querySelector('#official-asset-contract')?.textContent?.trim()||'',scope:document.querySelector('#official-asset-scope')?.textContent?.trim()||'',lensCards:document.querySelectorAll('#official-asset-lens-grid article').length,lensBoundary:document.querySelector('.official-asset-lens .panel-code')?.textContent?.trim()||'',lensText:document.querySelector('#official-asset-lens-grid')?.textContent?.trim()||'',addressSetDescription:document.querySelector('.official-asset-address-section>p')?.textContent?.trim()||''};})()`);
for (const item of cases) {
  await command('Emulation.setDeviceMetricsOverride',{width:item.width,height:item.height,deviceScaleFactor:1,mobile:item.mobile});
  await command('Network.enable'); await command('Network.setCacheDisabled',{cacheDisabled:true});
  await command('Page.navigate',{url:`${baseUrl}?official-project-tabs=${Date.now()}-${item.name}#holders`});
  await waitFor(`typeof state !== 'undefined'`, `${item.name} application state`);
  await evaluate(`(async()=>{if(!state.officialAssets?.projects?.length){const [overview,addresses]=await Promise.all([fetch('/api/v1/official-assets/overview').then(r=>r.json()),fetch('/api/v1/official-assets/addresses?view=mints&project=behemoth&page=1&page_size=10').then(r=>r.json())]);state.officialAssets=overview;state.officialAssetAddresses=addresses;state.officialAssetAddressByProject={behemoth:addresses};state.officialAssetProject='behemoth';renderOfficialAssetObservation();}})()`);
  await waitFor(`Boolean(state.officialAssets?.projects?.length===3 && state.officialAssetAddressByProject?.behemoth?.items?.length)`, `${item.name} official asset data`);
  await evaluate(`(async()=>{await setLanguage(${JSON.stringify(item.language)});renderOfficialAssetObservation();})()`);
  await waitFor(`state.lang===${JSON.stringify(item.language)} && document.querySelector('#official-asset-projects')?.textContent?.trim()`, `${item.name} localized state`);
  const results=[];
  for (const project of projects) {
    await evaluate(`document.querySelector('[data-official-asset-project="${project}"]')?.click()`);
    await waitFor(`state.officialAssetProject===${JSON.stringify(project)} && Boolean(state.officialAssetAddressByProject?.[${JSON.stringify(project)}]?.items?.length)`, `${item.name} ${project} project data`);
    await evaluate(`document.querySelector('#holders')?.scrollIntoView({block:'start'});`); await pause(260);
    const data=await metrics(), expectedDir=item.language==='ar'?'rtl':'ltr';
    if(data.scrollWidth>data.width+1 || data.rows<1 || data.status!=='healthy' || data.projectCards!==1 || data.projectCardKey!==project || data.active!==project || data.activeFilter!==project || !data.activeBreakdownOnly || data.tabCount!==3 || data.activeSelected!=='true' || data.headerColumns!==4 || data.projects?.sort().join(',')!=='behemoth,genesis,tapeout' || data.selected!==item.language || data.dir!==expectedDir || data.boundary.length<24 || !/^0x[a-f0-9]{8}/i.test(data.addressText) || !data.minterHint || data.officialSource.length<2 || data.thirdPartyPending.length<2 || data.contract.length<4 || data.scope.length<2 || data.lensCards!==4 || data.lensBoundary.length<2 || data.lensText.length<20 || data.addressSetDescription.length<8) throw new Error(`${item.name} ${project} official-project-tab UI check failed: ${JSON.stringify(data)}`);
    const shot=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    await writeFile(`${outputDir}/${item.name}-${project}-official-tab.png`,Buffer.from(shot.data,'base64'));
    results.push(data);
  }
  await writeFile(`${outputDir}/${item.name}.json`,JSON.stringify(results,null,2));
}
socket.close();
console.log('PASS: official three-project tab UI matrix completed');
