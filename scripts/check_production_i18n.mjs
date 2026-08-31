const base = process.argv[2] || 'https://tapeout-public-monitor.tapeout-labs.workers.dev';
const locales = ['ko', 'ja', 'es', 'ar', 'tr', 'fr', 'de', 'ru', 'pt'];
const getJson = async path => {
  const response = await fetch(`${base}${path}?i18n-production-qa=${Date.now()}`);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
};
const page = await fetch(`${base}/?i18n-production-qa=${Date.now()}`).then(response => response.text());
if (!page.includes('id="language-select"') || !page.includes('app.js?v=2026-08-31-features-r36')) throw new Error('Production i18n check failed: locale selector or r12 app asset missing');
const results = await Promise.all(locales.map(async locale => {
  const [ui, learning, ecosystem] = await Promise.all([getJson(`/i18n/${locale}.json`), getJson(`/i18n/learning/${locale}.json`), getJson(`/i18n/ecosystem/${locale}.json`)]);
  if (Object.keys(ui).length < 360) throw new Error(`Production i18n check failed: ${locale} UI pack incomplete`);
  for (const key of ['navMenu','navStart','navMining','navMechanics','navEcosystem','navData','mechanicsLabel','mechanicsTitle','mechanicsIntro','mechanicsBoundary','officialAssetOfficialSource','officialAssetThirdPartyPending','officialAssetLensLabel','officialAssetLensTitle','officialAssetNoCurrentBalance','officialAssetAddressSet','officialAssetAddressesHeading','officialAssetAddressesDescription','officialAssetContract','officialAssetScope','officialAssetLensHolders','officialAssetLensMinters','officialAssetLensMinted','officialAssetLensBids','officialAssetLensChange','officialAssetLensHoldersDescription','officialAssetLensMintersDescription','officialAssetLensMintedDescription','officialAssetLensBidsDescription','officialAssetLensChangeDescription','candleLabel','candleTitle','candleDescription','candleApiLink','candleNand','candleLatch','candleInterval','candleRange','candle1h','candle1d','candle24h','candle7d','candle30d','candleLoading','candleNoTrades','candleHealthy','candleStale','candleBoundary','candleCoverage','candleTrades','candleOpen','candleHigh','candleLow','candleClose','officialSiteLabel','streamDescription','protocolScope','eventWebsiteLabel','labelShareLabel','labelShareTitle','labelShareDescription','mixerDimension']) if (typeof ui[key] !== 'string' || !ui[key].trim()) throw new Error(`Production i18n check failed: ${locale} learning-navigation key ${key} missing`);
  if (Object.keys(learning.translations || {}).length !== 14 || !learning.translations?.['community-something-logic-intro'] || !learning.translations?.['community-93bitmap-video-intro']) throw new Error(`Production i18n check failed: ${locale} learning pack incomplete`);
  if (Object.keys(ecosystem.translations?.updates || {}).length !== 4 || Object.keys(ecosystem.translations?.tools || {}).length !== 8 || ecosystem.translations?.updates?.['community-something-workflow-note'] || ecosystem.translations?.tools?.['tool-tapeoutgo']) throw new Error(`Production i18n check failed: ${locale} ecosystem pack incomplete`);
  return { locale, ui_keys: Object.keys(ui).length, learning_cards: Object.keys(learning.translations).length, ecosystem_updates: Object.keys(ecosystem.translations.updates).length, ecosystem_tools: Object.keys(ecosystem.translations.tools).length };
}));
console.log(JSON.stringify({ status: 'pass', locales: results }, null, 2));
