import { readFileSync } from 'node:fs';
const app = readFileSync('public/app.js','utf8');
const required = [
  ['AbortController', 'per-request timeout controller'],
  ['timeoutMs = 12000', 'bounded frontend request timeout'],
  ['const optionalPromise=Promise.allSettled', 'optional-source settlement isolation'],
  ["Promise.all([fetchJSON('/api/summary'),fetchJSON('/api/analytics'),fetchJSON(activityQuery())])", 'core-only initial render dependency'],
  ["void loadMoreEvents({reset:true}).catch", 'event-stream isolation'],
  ["setTimeout(()=>boot().catch", 'core retry path after locale initialization'],
  ["auxiliary source(s) delayed", 'explicit optional-source degradation state']
];
for (const [token,label] of required) if (!app.includes(token)) throw new Error(`Missing startup resilience contract: ${label}`);
console.log(JSON.stringify({status:'pass',checks:required.length}));
