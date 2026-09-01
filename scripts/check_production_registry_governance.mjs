const base = process.argv[2] || 'https://tapeout-public-monitor.tapeout-labs.workers.dev';
const getJson = async path => {
  const response = await fetch(`${base}${path}${path.includes('?') ? '&' : '?'}registry-governance-qa=${Date.now()}`);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
};
const assert = (condition, message) => { if (!condition) throw new Error(`Production Registry governance check failed: ${message}`); };
const [page, app, registry, assets] = await Promise.all([
  fetch(`${base}/?registry-governance-qa=${Date.now()}`).then(response => response.text()),
  fetch(`${base}/app.js?v=2026-09-01-features-r40&registry-governance-qa=${Date.now()}`).then(response => response.text()),
  getJson('/api/v1/processors?q=BLONSKR&page=1&page_size=10'),
  getJson('/api/v1/official-assets/overview'),
]);
assert(page.includes('app.js?v=2026-09-01-features-r40'), 'r12 app asset is not referenced by production HTML');
assert(!page.includes('value="by_website_label"') && !page.includes('value="attestation.website_label"') && !page.includes('data-i18n="colOfficial"'), 'production HTML exposes a retired label control or Official column');
assert(/function websiteLabel\(\)\s*\{\s*return '';\s*\}/.test(app), 'production app still renders Registry identity badges');
assert(!app.includes("types:['processor.created','processor.mint_delta','processor.circuit_delta','processor.completed','attestation.website_label'"), 'production app still offers legacy website-label strategy events');
assert(app.includes("filter(type => type !== 'attestation.website_label')"), 'production app must strip legacy website-label strategies from old saved rules');
const blonskr = (registry.items || []).find(item => /blonskr/i.test(String(item.name || '')) || String(item.address || '').toLowerCase() === '0x1f5cb4aeae1807bf60c3b9c0d8adbcc14e91f12c');
assert(blonskr, 'Blonskr query must return the public Registry row');
assert(blonskr.website_label == null, 'Blonskr Registry row must not return an official/certified/community label');
const behemoth = assets.projects?.find(project => project.project_key === 'behemoth');
assert(behemoth?.processor_address?.toLowerCase() === '0x1f5cb4aeae1807bf60c3b9c0d8adbcc14e91f12c', 'source-scoped Behemoth address observation is unexpectedly absent');
console.log(JSON.stringify({
  status: 'pass',
  blonskr: { name: blonskr.name, address: blonskr.address, website_label: blonskr.website_label ?? null },
  behemoth_address_observation: behemoth.processor_address,
}, null, 2));
