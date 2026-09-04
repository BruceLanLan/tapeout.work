import { readFile, readdir } from 'node:fs/promises';

const root = process.argv[2] || process.cwd();
// worker.js was split into domain modules: the Registry label function now lives in
// util.js and the Behemoth source-scoped address lives in constants.js. Scan the whole
// src/ directory for the negative WEBSITE_LABELS check so it stays meaningful regardless
// of which module a future change might touch.
const srcFiles = (await readdir(`${root}/src`)).filter(name => name.endsWith('.js'));
const srcContents = await Promise.all(srcFiles.map(name => readFile(`${root}/src/${name}`, 'utf8')));
const allSrc = srcContents.join('\n');
const [util, constants, app, page, evidence] = await Promise.all([
  readFile(`${root}/src/util.js`, 'utf8'),
  readFile(`${root}/src/constants.js`, 'utf8'),
  readFile(`${root}/public/app.js`, 'utf8'),
  readFile(`${root}/public/index.html`, 'utf8'),
  readFile(`${root}/video_and_registry_label_review_2026-08-26.md`, 'utf8'),
]);
const assert = (condition, message) => { if (!condition) throw new Error(`Registry-label governance contract failed: ${message}`); };

assert(!allSrc.includes('const WEBSITE_LABELS = new Map'), 'hard-coded Registry status map must not return');
assert(/function websiteLabel\(\)\s*\{\s*return null;\s*\}/.test(util), 'worker Registry label function must return null');
assert(constants.includes('processor_address: "0x1f5cb4aeae1807bf60c3b9c0d8adbcc14e91f12c"'), 'Behemoth source-scoped address observation must remain independently configured');
assert(!app.includes("segmentDimension: 'by_website_label'"), 'research mixer default must not group by website label');
assert(!app.includes("types:['processor.created','processor.mint_delta','processor.circuit_delta','processor.completed','attestation.website_label'"), 'legacy website-label events must not appear in user strategy defaults');
assert(app.includes("filter(type => type !== 'attestation.website_label')"), 'legacy saved website-label strategies must be stripped during hydration');
assert(/function websiteLabel\(\)\s*\{\s*return '';\s*\}/.test(app), 'frontend Registry label renderer must render no identity badge');
assert(app.includes("segmentDimension: 'by_completion_band'"), 'research mixer must default to verified completion bands');
assert(!page.includes('value="by_website_label"'), 'website-label mixer option must not be visible');
assert(!page.includes('value="attestation.website_label"'), 'website-label event option must not be visible');
assert(!page.includes('value="official_site_label"'), 'official-site-label trust option must not be visible');
assert(!page.includes('data-i18n="colOfficial"'), 'Registry table must not retain an Official column');
assert(page.includes('app.js?v=2026-09-01-features-r46'), 'page must use r12 application cache key');
assert(app.includes('/i18n/${language}.json?v=2026-09-01-features-r46') && app.includes('/i18n/learning/${language}.json?v=2026-09-01-features-r46'), 'dynamic UI and learning packs must use r12 cache keys');
assert(evidence.includes('Blonskr_No1') && evidence.includes('WEBSITE_LABELS') && evidence.includes('Behemoth 地址复核'), 'source review must document the error and the separate Behemoth evidence boundary');
console.log('PASS: Registry labels are neutral, completion-band analytics is active, and Behemoth remains source-scoped only.');
