const baseUrl = process.argv[2] || 'http://127.0.0.1:8794/';
const debugPort = process.argv[3] || '9256';
const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
const page = targets.find(target => target.type === 'page');
if (!page?.webSocketDebuggerUrl) throw new Error('No Chromium page available');
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{ socket.addEventListener('open',resolve,{once:true}); socket.addEventListener('error',reject,{once:true}); });
let sequence=0; const pending=new Map();
socket.addEventListener('message',event=>{ const message=JSON.parse(event.data); if(message.id && pending.has(message.id)){ const request=pending.get(message.id); pending.delete(message.id); message.error?request.reject(new Error(message.error.message)):request.resolve(message.result); } });
const command=(method,params={})=>new Promise((resolve,reject)=>{ const id=++sequence; pending.set(id,{resolve,reject}); socket.send(JSON.stringify({id,method,params})); });
const evaluate=async expression=>(await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})).result?.value;
await command('Network.enable'); await command('Network.setCacheDisabled',{cacheDisabled:true});
const token=`degradation-test=${Date.now()}`;
await command('Page.navigate',{url:`${baseUrl}?${token}`});
for (let attempt=0;attempt<60;attempt+=1) { const loaded=await evaluate(`location.href.includes(${JSON.stringify(token)}) && document.readyState !== 'loading'`); if(loaded) break; await new Promise(resolve=>setTimeout(resolve,250)); }
for (let attempt=0;attempt<60;attempt+=1) { const ready=await evaluate(`typeof load === 'function' && document.querySelectorAll('#summary .kpi').length === 4 && document.querySelectorAll('#learn-steps li').length === 6`); if(ready) break; await new Promise(resolve=>setTimeout(resolve,250)); }
await evaluate(`(() => { const originalFetch=window.fetch.bind(window); window.__simulatedLearnFailure=false; window.fetch=(input,init) => { const url=String(input); if (url.includes('/api/v1/learn/resources')) { window.__simulatedLearnFailure=true; return Promise.reject(new Error('simulated optional source delay')); } return originalFetch(input,init); }; })()`);
await command('Runtime.evaluate',{expression:'load()',awaitPromise:true,returnByValue:true});
for (let attempt=0;attempt<60;attempt+=1) { const settled=await evaluate(`/延迟|delayed/i.test(document.querySelector('#updated')?.textContent || '')`); if(settled) break; await new Promise(resolve=>setTimeout(resolve,250)); }
const result=await evaluate(`(() => ({ kpis:document.querySelectorAll('#summary .kpi').length, steps:document.querySelectorAll('#learn-steps li').length, status:document.querySelector('#updated')?.textContent || '', simulated:Boolean(window.__simulatedLearnFailure), dataUnavailable:(document.querySelector('#updated')?.textContent || '').includes('Data unavailable') }))()`);
if (result.kpis !== 4 || result.steps !== 6 || !result.simulated || result.dataUnavailable) throw new Error(`Optional-source degradation failed: ${JSON.stringify(result)}`);
socket.close();
console.log('PASS: optional source failure leaves core dashboard rendered',result);
