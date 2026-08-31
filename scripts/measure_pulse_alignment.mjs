const baseUrl = process.argv[2] || 'http://127.0.0.1:8788/';
const debugPort = process.argv[3] || '9225';
const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
const page = targets.find(target => target.type === 'page');
if (!page?.webSocketDebuggerUrl) throw new Error('No inspectable Chromium page');
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
let sequence = 0;
const pending = new Map();
socket.addEventListener('message', event => { const payload = JSON.parse(event.data); if (payload.id && pending.has(payload.id)) { const { resolve, reject } = pending.get(payload.id); pending.delete(payload.id); payload.error ? reject(new Error(payload.error.message)) : resolve(payload.result); } });
const command = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await command('Page.enable');
await command('Page.navigate', { url: baseUrl });
await sleep(4500);
const result = await command('Runtime.evaluate', { expression: `(() => {
  const rect = selector => { const el = document.querySelector(selector); if (!el) return null; const r = el.getBoundingClientRect(); return {top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height)}; };
  return {
    pulse: rect('.pulse-panel'), daily: rect('.daily-panel'),
    pulseHead: rect('.pulse-panel .panel-head'), dailyHead: rect('.daily-panel .panel-head'),
    pulseDescription: rect('.pulse-panel .panel-description'), dailyDescription: rect('.daily-panel .panel-description'),
    pulsePrimary: rect('#pulse-cards'), dailyPrimary: rect('#daily-chart')
  };
})()`, returnByValue: true });
socket.close();
console.log(JSON.stringify(result.result.value, null, 2));
