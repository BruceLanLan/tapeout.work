const base = process.argv[2] || 'https://tapeout-public-monitor.tapeout-labs.workers.dev';
const getJson = async path => {
  const response = await fetch(`${base}${path}`);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
};
const [catalog, officialPod, communitySafety, communityVideo, page] = await Promise.all([
  getJson('/api/v1/learn/resources?page=1&page_size=6'),
  getJson('/api/v1/learn/resources?tier=official&stage=pod'),
  getJson('/api/v1/learn/resources?tier=community&stage=safety&page_size=12'),
  getJson('/api/v1/learn/resources?tier=community&stage=basics&language=en&page_size=12'),
  fetch(`${base}/?learning-production-qa=${Date.now()}`).then(response => response.text()),
]);
const assert = (condition, message) => { if (!condition) throw new Error(`Production learning check failed: ${message}`); };
assert(catalog.catalog_version === '2026-08-26' && catalog.total === 14 && catalog.items.length === 6, 'default governed catalog is incomplete');
assert(officialPod.items.length >= 3 && officialPod.items.every(item => item.tier === 'official' && item.stages.includes('pod')), 'official PoD filtering failed');
assert(communitySafety.items.some(item => item.id === 'community-something-logic-intro' && item.tier === 'community' && item.language?.includes('zh')), 'community Something Labs teaching card missing');
const video = communityVideo.items.find(item => item.id === 'community-93bitmap-video-intro');
assert(video?.tier === 'community' && video.language?.length === 1 && video.language[0] === 'en' && video.url === 'https://x.com/93bitmap/status/2092453478530691106', '93.bitmap English community video missing or misclassified');
assert(/not an official source|不代表官网规则/.test(`${video.summary_zh} ${video.summary_en}`), '93.bitmap video governance boundary missing');
assert(page.includes('id="learn"') && page.includes('id="learning-nav-menu"') && page.includes('id="mechanics"') && page.includes('official-asset-source-strip') && page.includes('id="official-asset-lens-grid"') && page.includes('id="transistor-candle-chart"') && page.includes('learning.css?v=2026-09-01-features-r40') && page.includes('app.js?v=2026-09-01-features-r40'), 'learning navigation, mechanics section or versioned responsive asset missing');
console.log(JSON.stringify({
  catalog_version: catalog.catalog_version,
  total: catalog.total,
  official_pod_resources: officialPod.items.map(item => item.id),
  community_safety_resources: communitySafety.items.map(item => item.id),
  community_video_resources: communityVideo.items.map(item => item.id),
  responsive_asset: 'learning.css?v=2026-09-01-features-r40',
  app_asset: 'app.js?v=2026-09-01-features-r40',
}, null, 2));
