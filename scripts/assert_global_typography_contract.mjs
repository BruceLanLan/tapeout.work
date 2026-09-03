import { readFile } from 'node:fs/promises';

const root = new URL('..', import.meta.url);
const read = name => readFile(new URL(name, root), 'utf8');
const [html, css, capture] = await Promise.all([
  read('public/index.html'),
  read('public/learning.css'),
  read('scripts/capture_global_typography_ui.mjs'),
]);

const required = [
  [html, 'learning.css?v=2026-09-01-features-r43', 'versioned global typography and candle asset'],
  [css, 'Global typography alignment r1', 'global typography layer'],
  [css, '--font-ui:', 'script-aware UI font token'],
  [css, '--font-numeric:', 'numeric font token'],
  [css, 'font-variant-numeric: tabular-nums lining-nums', 'tabular numeric alignment'],
  [css, 'html:lang(zh)', 'Chinese font stack'],
  [css, 'html:lang(ja)', 'Japanese font stack'],
  [css, 'html:lang(ko)', 'Korean font stack'],
  [css, 'html:lang(ar)', 'Arabic font stack'],
  [css, '.section-heading .updated-label', 'mobile snapshot alignment'],
  [css, 'white-space: nowrap', 'single-line mobile timestamp'],
  [css, 'select, .language-toggle select', 'shared control baseline'],
  [css, '.official-asset-tab.is-active', 'official project tab active state'],
  [css, '.official-asset-projects dl { grid-template-columns: repeat(4', 'official project desktop metric grid'],
  [css, '.learning-nav-desktop a:focus-visible', 'desktop learning navigation focus state'],
  [css, 'Desktop learning navigation r8', 'desktop learning navigation visibility layer'],
  [css, '.learning-nav-desktop {', 'desktop learning navigation container styling'],
  [css, '.learning-nav-mobile:not([hidden])', 'mobile learning navigation reading state'],
  [css, '.mechanics-grid', 'mechanics reading-card grid'],
  [css, '.mechanics-boundary', 'mechanics interpretation boundary'],
  [css, '.official-asset-source-strip', 'official asset source contract typography'],
  [css, '.official-asset-lens-grid', 'official asset evidence lens typography'],
  [css, '.official-asset-lens-grid article>b', 'official asset numeric lens hierarchy'],
  [css, '.official-asset-address-section', 'official address-set reading structure'],
  [css, '.updates-panel,\n.tools-panel', 'audited ecosystem panel inset'],
  [css, '.leader-meta', 'leader address and provenance grouping'],
  [css, '.updates-panel .panel-head,', 'audited ecosystem content left inset'],
  [css, '.transistor-candle-section', 'third-party candle section boundary'],
  [css, '.transistor-candle-chart', 'candle chart SVG container'],
  [css, '.transistor-candle-boundary', 'third-party candle provenance copy'],
  [css, '#transistor-candle-ohlc', 'candle OHLC hierarchy'],
  [css, '@media (max-width:720px){.transistor-candle-section', 'candle narrow-screen containment'],
  [capture, 'setLanguage(${JSON.stringify(locale)})', 'real async locale switching in visual capture'],
  [capture, 'expectedDir', 'RTL visual assertion'],
  [capture, 'desktopNav:', 'desktop learning navigation visibility metrics'],
  [capture, 'metrics.desktopNav?.visible', 'desktop learning navigation visibility assertion'],
  [capture, 'scrollWidth > metrics.viewport + 1', 'visual overflow assertion'],
];
for (const [source, token, label] of required) {
  if (!source.includes(token)) throw new Error(`Missing typography contract: ${label}`);
}
console.log(JSON.stringify({ status: 'pass', checks: required.length }, null, 2));
