import { readFile } from 'node:fs/promises';

const [work] = process.argv.slice(2);
if (!work) throw new Error('Usage: node scripts/assert_learning_contract.mjs <workdir>');
const readJson = name => readFile(`${work}/${name}`, 'utf8').then(JSON.parse);
const [catalog, officialPod, chinese, communitySafety, communityVideo] = await Promise.all([
  readJson('learn-resources.json'),
  readJson('learn-official-pod.json'),
  readJson('learn-zh.json'),
  readJson('learn-community-safety.json'),
  readJson('learn-community-video.json'),
]);
const allowedTiers = new Set(['official', 'community', 'reference']);
const allowedStages = new Set(['basics', 'canvas', 'tapeout', 'pod', 'safety', 'logic']);
const assert = (condition, message) => { if (!condition) throw new Error(`Learning contract failed: ${message}`); };
assert(catalog.catalog_version === '2026-08-26', 'catalog version must remain explicit');
assert(catalog.total === 19, 'reviewed catalog must contain exactly 19 governed resources');
assert(catalog.filters?.page === 1 && catalog.filters?.page_size === 6, 'default pagination must remain six cards per page');
assert(catalog.page_count === 3, '14-card catalog should remain paginated across three pages');
assert(catalog.items.length === 6, 'default page must contain exactly six cards');
for (const item of catalog.items) {
  assert(allowedTiers.has(item.tier), `unrecognized source tier for ${item.id}`);
  assert(Array.isArray(item.stages) && item.stages.length > 0 && item.stages.every(stage => allowedStages.has(stage)), `missing governed stages for ${item.id}`);
  assert(/^https:\/\//.test(item.url), `resource URL must be HTTPS for ${item.id}`);
  assert(item.title_zh && item.title_en && item.summary_zh && item.summary_en, `dual-language fields missing for ${item.id}`);
  assert(!/guaranteed\s+(?:return|profit|income)|稳赚|保本/i.test(`${item.title_zh} ${item.title_en} ${item.summary_zh} ${item.summary_en}`), `return-promise wording must not enter catalog: ${item.id}`);
}
assert(officialPod.filters?.tier === 'official' && officialPod.filters?.stage === 'pod', 'official PoD filter echo missing');
assert(officialPod.items.length >= 3 && officialPod.items.every(item => item.tier === 'official' && item.stages.includes('pod')), 'official PoD filter leaks non-official resource');
assert(chinese.filters?.language === 'zh' && chinese.items.length >= 3, 'Chinese language pagination contract missing');
assert(chinese.items.every(item => item.language.includes('zh')), 'Chinese filter leaks non-Chinese resource');
assert(chinese.items.some(item => item.id === 'community-something-logic-intro'), 'Chinese filter omits Something Labs community card');
assert(communitySafety.filters?.tier === 'community' && communitySafety.filters?.stage === 'safety', 'community safety filter echo missing');
const marketQa = communitySafety.items.find(item => item.id === 'community-market-qa');
assert(marketQa?.tier === 'community' && /tapeout\.market\/qa/.test(marketQa.url || ''), 'TapeOut Market Q&A must remain a community safety reference');
assert(!communitySafety.items.some(item => item.id === 'official-market-qa'), 'legacy official Market Q&A ID must not remain');
const something = communitySafety.items.find(item => item.id === 'community-something-logic-intro');
assert(something?.tier === 'community' && something.language?.includes('zh') && /官网仍是规则与合约的唯一权威来源/.test(something.summary_zh || '') && /不采纳文中的买入、囤积、挖矿或价格观点/.test(something.summary_zh || ''), 'Something Labs community mechanism primer must preserve source and return boundaries');
assert(communityVideo.filters?.tier === 'community' && communityVideo.filters?.language === 'en' && communityVideo.filters?.stage === 'basics', 'community English video filter echo missing');
const video = communityVideo.items.find(item => item.id === 'community-93bitmap-video-intro');
assert(video?.tier === 'community' && video.language?.length === 1 && video.language[0] === 'en', '93.bitmap video must remain a Community English-original card');
assert(video.url === 'https://x.com/93bitmap/status/2092453478530691106', '93.bitmap video must retain its original X URL');
assert(/community video|社区视频/i.test(`${video.title_zh} ${video.title_en} ${video.summary_zh} ${video.summary_en}`) && /not an official source|不代表官网规则/.test(`${video.summary_zh} ${video.summary_en}`), '93.bitmap video must preserve community-only and non-official boundaries');
console.log(`PASS: ${catalog.total} governed learning resources; official PoD, Chinese, community-safety and 93.bitmap video filters verified.`);
