const base = process.argv[2] || 'http://127.0.0.1:8796';
const locales = ['zh', 'en', 'ko', 'ja', 'es', 'ar', 'tr', 'fr', 'de', 'ru', 'pt'];
const get = async path => {
  const response = await fetch(`${base}${path}`);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
};
const assert = (condition, message) => { if (!condition) throw new Error(`API i18n contract failed: ${message}`); };
const [metadata, legacy] = await Promise.all([
  get('/api/v1/i18n'),
  get('/api/v1/learn/resources?page=1&page_size=12')
]);
assert(metadata.response_locale_parameter === 'locale', 'response locale parameter missing');
assert(metadata.source_language_parameter === 'language', 'source language parameter missing');
assert(JSON.stringify(metadata.supported_response_locales) === JSON.stringify(locales), 'supported locale list changed');
assert(legacy.total === 14 && legacy.items.length === 12 && !('localized' in legacy.items[0]), 'legacy no-locale response changed');
assert(legacy.filters.locale === null, 'legacy response unexpectedly sets locale');
const legacyFirst = legacy.items[0];
for (const locale of locales) {
  const data = await get(`/api/v1/learn/resources?page=1&page_size=12&locale=${locale}`);
  assert(data.total === 14 && data.items.length === 12, `${locale} catalog cardinality`);
  assert(data.requested_locale === locale, `${locale} requested locale echo`);
  assert(data.response_locale === locale, `${locale} response locale`);
  assert(['canonical', 'localized'].includes(data.locale_status), `${locale} locale status`);
  assert(data.items.every(item => item.localized?.locale === locale && item.localized.title && item.localized.summary), `${locale} localized cards`);
  assert(data.items[0].id === legacyFirst.id && data.items[0].url === legacyFirst.url && data.items[0].title_en === legacyFirst.title_en && data.items[0].title_zh === legacyFirst.title_zh, `${locale} invariant source fields`);
  assert(data.localization.source_language_parameter === 'language', `${locale} source-language semantics metadata`);
  const videoData = await get(`/api/v1/learn/resources?tier=community&stage=basics&language=en&page_size=12&locale=${locale}`);
  const video = videoData.items.find(item => item.id === 'community-93bitmap-video-intro');
  assert(video?.tier === 'community' && video.language?.length === 1 && video.language[0] === 'en' && video.url === 'https://x.com/93bitmap/status/2092453478530691106', `${locale} 93.bitmap source fields`);
  assert(video.localized?.title && video.localized?.summary && video.localized.summary.length > 40, `${locale} 93.bitmap localized summary`);
  assert(/not an official source/.test(video.summary_en || '') && /不代表官网规则/.test(video.summary_zh || ''), `${locale} 93.bitmap immutable governance boundary`);
}
const fallback = await get('/api/v1/learn/resources?page=1&page_size=12&locale=it');
assert(fallback.requested_locale === 'it' && fallback.response_locale === 'en' && fallback.locale_status === 'fallback', 'unsupported locale fallback');
assert(fallback.items.every(item => item.localized?.locale === 'en'), 'fallback localized cards');
const sourceFiltered = await get('/api/v1/learn/resources?page=1&page_size=12&language=zh&locale=ja');
assert(sourceFiltered.filters.language === 'zh' && sourceFiltered.response_locale === 'ja', 'source filter and locale conflict');
assert(sourceFiltered.items.length > 0 && sourceFiltered.items.every(item => item.language.includes('zh') && item.localized.locale === 'ja'), 'source filter behavior changed');
console.log(JSON.stringify({ status: 'pass', locales, legacy_items: legacy.items.length, japanese_source_filtered_items: sourceFiltered.items.length }, null, 2));
