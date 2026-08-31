import { GLOSSARY, GLOSSARY_VERSION, GLOSSARY_REVIEWED_AT } from '../src/glossary_seed.js';
import { readFileSync } from 'node:fs';
const fail = message => { throw new Error(`Glossary contract: ${message}`); };
if (!/^\d{4}-\d{2}-\d{2}-glossary-r\d+$/.test(GLOSSARY_VERSION)) fail('version must be dated and revisioned');
if (!/^\d{4}-\d{2}-\d{2}$/.test(GLOSSARY_REVIEWED_AT)) fail('reviewed_at must be a date');
if (GLOSSARY.length < 12) fail(`needs at least 12 terms, has ${GLOSSARY.length}`);
const ids = new Set();
for (const item of GLOSSARY) {
  if (!item.id || ids.has(item.id)) fail(`missing or duplicate id: ${item.id}`);
  ids.add(item.id);
  for (const field of ['term_en','term_zh','def_en','def_zh']) if (!String(item[field] || '').trim()) fail(`${item.id}: empty ${field}`);
  if (!/^https:\/\/tapeout\.net(\/|$)/.test(item.evidence_url)) fail(`${item.id}: evidence must cite an official tapeout.net page`);
  const copy = `${item.def_en} ${item.def_zh}`.toLowerCase();
  for (const banned of ['profit','guarantee','apy','回本','收益率','稳赚']) if (copy.includes(banned)) fail(`${item.id}: definition contains return language: ${banned}`);
}
const app = readFileSync('public/app.js','utf8');
for (const token of ["['glossary','/api/v1/glossary']", 'function renderGlossary', "glossaryLabel:'TAPEOUT GLOSSARY'", "glossaryLabel:'TAPEOUT 术语百科'"]) if (!app.includes(token)) fail(`app.js missing: ${token}`);
const page = readFileSync('public/index.html','utf8');
for (const token of ['id="glossary"', 'id="glossary-search"', 'id="glossary-grid"']) if (!page.includes(token)) fail(`index.html missing: ${token}`);
const router = readFileSync('src/router.js','utf8');
for (const token of ['"/api/v1/glossary"', 'GLOSSARY_VERSION']) if (!router.includes(token)) fail(`router.js missing: ${token}`);
console.log(JSON.stringify({ status: 'pass', terms: GLOSSARY.length, version: GLOSSARY_VERSION }));
