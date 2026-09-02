// Build gate: every locale must carry a translation made from the current source
// text of every catalogue entry. Derived from per-entry source hashes, the same
// ones the site's self-audit reads, so the build and the site cannot disagree.
import { freshnessReport } from "./translate_catalog.mjs";
const report = await freshnessReport();
let stale = 0;
for (const [locale, r] of Object.entries(report)) {
  stale += r.stale.length;
  if (r.stamp_lag?.length) { stale++; console.log(`FAIL ${locale} version stamp lags the catalogue in ${r.stamp_lag.join(", ")} — run node scripts/translate_catalog.mjs`); }
  console.log(`${r.stale.length ? "FAIL" : "PASS"} ${locale} translation freshness (${r.total - r.stale.length}/${r.total})${r.stale.length ? ": " + r.stale.map(s => `${s.id} ${s.reason}`).join(", ") : ""}`);
}
if (stale) { console.error(`FAIL: ${stale} stale translation(s). Run: node scripts/translate_catalog.mjs`); process.exit(1); }
console.log("PASS translation freshness contract");
