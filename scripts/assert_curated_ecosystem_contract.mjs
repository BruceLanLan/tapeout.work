import { readFile } from 'node:fs/promises';
// Counts come from the seed, not from frozen literals. Pinning them meant every
// legitimate catalogue addition broke the contract, so it was left failing and
// stopped guarding anything — while the localisation gap it should have caught
// (11 of 19 tools untranslated in nine locales) grew unnoticed underneath it.
import { CURATED_TOOLS, CURATED_UPDATES } from '../src/curated_ecosystem_seed.js';

const base = (process.argv[2] || 'http://127.0.0.1:8796').replace(/\/$/, '');
const root = new URL('..', import.meta.url);
const read = async relative => readFile(new URL(relative, root), 'utf8');
const requireMatch = (value, pattern, label) => { if (!pattern.test(value)) throw new Error(`FAIL ${label}`); console.log(`PASS ${label}`); };
const get = async path => { const response = await fetch(`${base}${path}`); if (!response.ok) throw new Error(`FAIL ${path} HTTP ${response.status}`); return response.json(); };

const locales = ['ko','ja','es','ar','tr','fr','de','ru','pt'];
const [router, apiI18n, app, indexHtml, seed, en, ...localizedFiles] = await Promise.all([
  read('src/router.js'), read('src/api_i18n.js'), read('public/app.js'), read('public/index.html'), read('src/curated_ecosystem_seed.js'), read('public/i18n/en.json'),
  ...locales.flatMap(locale => [read(`public/i18n/${locale}.json`), read(`public/i18n/ecosystem/${locale}.json`)])
]);
// worker.js was split into domain modules; the API-catalog surface this contract checks
// (routes + review-mode/governance copy) now lives in router.js and api_i18n.js.
const worker = `${router}\n${apiI18n}`;
for (const [name, body] of Object.entries({worker, app, seed})) requireMatch(body, /editorially reviewed public-content flow|EDITORIALLY REVIEWED|reviewed public/i, `${name} records audited-not-realtime boundary`);
requireMatch(worker, /\/api\/v1\/updates/, 'updates route exists');
requireMatch(worker, /\/api\/v1\/tools/, 'tools route exists');
requireMatch(worker, /community content never inherits official identity/i, 'community tier boundary exists');
requireMatch(worker, /private-key\/seed requests/i, 'unsafe content exclusion exists');
requireMatch(app, /Promise\.allSettled\(\[fetchJSON\(`\/api\/v1\/updates/, 'optional ecosystem loading is isolated');
requireMatch(app, /loadCuratedEcosystem\(\)/, 'language switch refreshes ecosystem content');
// r30: default flipped to expanded (grouped by tier) so newly reviewed tools
// are visible without an extra click; the collapse-to-3 toggle still exists
// for users who want the compact view, so its mechanism is still asserted.
requireMatch(app, /toolsExpanded:\s*true/, 'tools default to expanded, tier-grouped state');
requireMatch(app, /tools\.slice\(0,3\)/, 'collapsed view still renders only three cards');
requireMatch(app, /state\.toolsExpanded=!state\.toolsExpanded/, 'tools toggle updates rendering state');
requireMatch(indexHtml, /id="tools-toggle"[^>]*aria-controls="tools-directory"/, 'tools toggle is accessible and linked to directory');
requireMatch(app, /learnSafetyLink:'Read community market Q&A · not official rules ↗'/, 'learning safety link records Market Q&A as community');
const source = JSON.parse(en);
for (const [index, locale] of locales.entries()) {
  const localized = JSON.parse(localizedFiles[index * 2]);
  if (JSON.stringify(Object.keys(localized).sort()) !== JSON.stringify(Object.keys(source).sort())) throw new Error(`FAIL ${locale} UI key parity`);
  if (/official market Q&A/i.test(localized.learnSafetyLink || '')) throw new Error(`FAIL ${locale} Market Q&A incorrectly marked official in learning safety`);
  console.log(`PASS ${locale} UI key parity`);
}
for (const [index, locale] of locales.entries()) {
  const localized = JSON.parse(localizedFiles[index * 2 + 1]);
  const localizedUpdateCount = Object.keys(localized.translations?.updates || {}).length;
  const localizedToolCount = Object.keys(localized.translations?.tools || {}).length;
  if (localizedUpdateCount !== CURATED_UPDATES.length || localizedToolCount !== CURATED_TOOLS.length) {
    throw new Error(`FAIL ${locale} ecosystem localization coverage (${localizedToolCount}/${CURATED_TOOLS.length} tools, ${localizedUpdateCount}/${CURATED_UPDATES.length} updates)`);
  }
  console.log(`PASS ${locale} ecosystem localization coverage`);
}
const [updates, community, tools, communityTools, officialTools, localizedUpdates, localizedTools, fallback] = await Promise.all([
  get('/api/v1/updates?page_size=12'), get('/api/v1/updates?tier=community'), get('/api/v1/tools?page_size=12'), get('/api/v1/tools?tier=community&page_size=12'), get('/api/v1/tools?tier=official&page_size=12'), get('/api/v1/updates?locale=ja&page_size=12'), get('/api/v1/tools?locale=ar&page_size=12'), get('/api/v1/updates?locale=it&page_size=12')
]);
if (updates.total !== CURATED_UPDATES.length || updates.review_mode !== 'editorially verified public-content flow; not real-time X ingestion') throw new Error('FAIL update catalog baseline');
const seededCommunityUpdates = CURATED_UPDATES.filter(item => item.tier === 'community').length;
if (community.total !== seededCommunityUpdates || !community.items.every(item => item.tier === 'community')) throw new Error('FAIL community tier filter');
if (tools.total !== CURATED_TOOLS.length || !tools.items.every(item => item.safety_en && item.url && item.operator)) throw new Error('FAIL tool catalog evidence fields');
const communityIds = new Set(communityTools.items.map(item => item.id));
const officialIds = new Set(officialTools.items.map(item => item.id));
const expectedCommunityTools = ['tool-tapeout-club','tool-tapeout-firsto','tool-tapeout-market'];
if (!expectedCommunityTools.every(id => communityIds.has(id)) || expectedCommunityTools.some(id => officialIds.has(id))) throw new Error('FAIL community tool boundaries');
if (tools.items.some(item => item.id === 'tool-market-qa')) throw new Error('FAIL duplicate TapeOut Market Q&A remains in tool catalog');
if (!tools.items.filter(item => item.id === 'tool-tapeout-market').every(item => item.tier === 'community' && /community/i.test(item.operator || ''))) throw new Error('FAIL TapeOut Market community identity');
if (!/https:\/\/tapeout\.club\//.test(seed) || !/https:\/\/tapeout\.firsto\.ai\//.test(seed) || !/https:\/\/tapeout\.market\//.test(seed)) throw new Error('FAIL ecosystem site source URLs');
// tool-tapeoutgo was on this rejection list until it was reviewed on its merits
// and catalogued deliberately, with its wallet-signing actions spelled out in its
// safety boundary. The other two remain rejected, so the guard stays — it just no
// longer names an entry the catalogue now carries on purpose.
if (/community-something-workflow-note|community-93bitmap-ordinals/.test(seed)) throw new Error('FAIL rejected wallet-or-return-oriented community content entered ecosystem catalog');
if (localizedUpdates.response_locale !== 'ja' || localizedUpdates.locale_status !== 'localized' || !localizedUpdates.items.every(item => item.localized?.title && item.localized?.source_note)) throw new Error('FAIL Japanese update localization');
if (localizedTools.response_locale !== 'ar' || localizedTools.locale_status !== 'localized' || !localizedTools.items.every(item => item.localized?.title && item.localized?.safety)) throw new Error('FAIL Arabic tool localization');
if (fallback.response_locale !== 'en' || fallback.locale_status !== 'fallback') throw new Error('FAIL unsupported locale fallback');
console.log('PASS curated ecosystem API contract');
