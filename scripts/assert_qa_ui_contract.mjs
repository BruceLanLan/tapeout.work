import { readFile } from 'node:fs/promises';

const root = new URL('..', import.meta.url);
const read = name => readFile(new URL(name, root), 'utf8');
const [html, app, css, uxCss] = await Promise.all([
  read('public/index.html'),
  read('public/app.js'),
  read('public/styles.css'),
  read('public/ux-loop.css')
]);
const required = [
  [html, 'id="pulse-window"', 'selected-window summary mount'],
  [html, 'id="segment-mode"', 'segment count/share selector'],
  [html, 'class="bem-details"', 'collapsible BEM resources'],
  [html, 'id="bem-price-risk"', 'BEM market risk badge'],
  [html, 'id="creator-concentration"', 'creator concentration mount'],
  [html, '<article class="panel daily-panel"><div class="panel-head activity-head"><div>', 'daily panel heading is structurally independent from controls'],
  [app, 'hasCoverage=rows.length > 0 && Number(data.coverage_days || 0) > 0', 'no-coverage guard'],
  [app, 'eventSummary(event)', 'localized event summaries'],
  [app, 'sourceUnitDisplay', 'source-unit compression'],
  [app, 'segmentMode', 'segment view state'],
  [app, 'renderPulse(); renderDaily(); renderHeatmap();', 'selected-window summary refresh'],
  [app, '<div class="heatmap-days"><i aria-hidden="true"></i>', 'heatmap label-column placeholder'],
  [css, '.daily-heatmap:not(.is-pending) .heatmap-row>div{grid-column:2 / -1', 'heatmap data-grid spans all observed buckets'],
  [css, 'QA mobile containment', 'mobile containment section'],
  [css, 'grid-template-columns:minmax(0,1fr)!important', 'mobile grid shrink guard'],
  [css, '.pulse-card.is-unavailable', 'unavailable summary styling'],
  [css, 'Protocol pulse alignment', 'desktop protocol panel alignment section'],
  [css, '.daily-panel .activity-head{order:1;min-height:53px}', 'daily title baseline alignment'],
  [html, 'class="pulse-reading"', 'selected-window reading guide'],
  [html, 'href="/ux-loop.css?v=2026-08-24-ux-loop-r5"', 'versioned UX loop asset'],
  [app, "pulseReadingTitle:'Use the chart for change; use the heatmap for shape.'", 'reading guide copy'],
  [uxCss, 'Dedicated UX loop overrides', 'dedicated UX style source'],
  [uxCss, '.pulse-panel #market-facts .market-empty', 'compact optional-market status'],
  [uxCss, '.terminal-nav a{min-height:46px', 'desktop navigation hit-area']
];
for (const [source, token, label] of required) if (!source.includes(token)) throw new Error(`Missing UI contract: ${label}`);
console.log(JSON.stringify({ status: 'pass', checks: required.length }, null, 2));
