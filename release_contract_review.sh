#!/usr/bin/env bash
set -euo pipefail

base="${1:-http://localhost:8787}"
work="/tmp/tapeout-release-contract-review"
rm -rf "$work"
mkdir -p "$work"

curl -fsS "$base/api/v1/analytics" > "$work/analytics.json"
curl -fsS "$base/api/v1/daily-activity" > "$work/daily.json"
curl -fsS "$base/api/v1/daily-activity?range=1d&granularity=hour&timezone=Asia%2FShanghai" > "$work/activity-hour.json"
curl -fsS "$base/api/v1/daily-activity?range=30d&granularity=day&timezone=UTC" > "$work/activity-utc.json"
curl -fsS "$base/api/v1/daily-activity?range=all&granularity=day&timezone=Asia%2FShanghai" > "$work/activity-all.json"
curl -fsS "$base/api/v1/airdrop-overview" > "$work/airdrop.json"
curl -fsS "$base/api/v1/bem/overview" > "$work/bem-overview.json"
curl -fsS "$base/api/v1/bem/price" > "$work/bem-price.json"
curl -fsS "$base/api/v1/bem/tasks?page=1&page_size=10" > "$work/bem-tasks.json"
curl -fsS "$base/api/v1/bem/tasks?page=2&page_size=10" > "$work/bem-tasks-page2.json"
curl -fsS "$base/api/v1/bem/algorithm" > "$work/bem-algorithm.json"
curl -fsS "$base/api/v1/learn/resources?page=1&page_size=6" > "$work/learn-resources.json"
curl -fsS "$base/api/v1/learn/resources?tier=official&stage=pod" > "$work/learn-official-pod.json"
curl -fsS "$base/api/v1/learn/resources?tier=community&stage=safety" > "$work/learn-community-safety.json"
curl -fsS "$base/api/v1/learn/resources?tier=community&stage=basics&language=en&page_size=12" > "$work/learn-community-video.json"
curl -fsS "$base/api/v1/learn/resources?language=zh&page_size=12" > "$work/learn-zh.json"
curl -fsS "$base/api/v1/data-health" > "$work/health.json"
curl -fsS "$base/api/v1/official-assets/overview" > "$work/official-assets-overview.json"
curl -fsS "$base/api/v1/official-assets/addresses?view=mints&page=1&page_size=10" > "$work/official-assets-mints.json"
curl -fsS "$base/api/v1/official-assets/addresses?view=open_bids&page=1&page_size=10" > "$work/official-assets-bids.json"
curl -fsS "$base/api/v1/official-assets/health" > "$work/official-assets-health.json"
curl -fsS "$base/api/v1/community/processor-health" > "$work/community-processor-health.json"
curl -fsS "$base/api/v1/community/processor-leaderboard?page=1&page_size=10" > "$work/community-processor-board.json"
curl -fsS "$base/api/v1/processors?page=1&page_size=10&sort=circuits&completion=all&min_circuits=0" > "$work/processors.json"
curl -fsS "$base/" > "$work/index.html"

node --check src/worker.js
node --check public/app.js
node --check scripts/assert_bem_release_contract.mjs
node --check scripts/assert_activity_timeseries_contract.mjs
node --check scripts/assert_airdrop_health_contract.mjs
node --check scripts/assert_qa_ui_contract.mjs
node --check scripts/assert_learning_contract.mjs
node --check scripts/assert_registry_label_governance_contract.mjs
node --check scripts/assert_learning_layout_contract.mjs
node --check scripts/assert_startup_resilience_contract.mjs
node --check scripts/check_production_i18n.mjs
node --check scripts/check_production_registry_governance.mjs
node --check scripts/assert_api_i18n_contract.mjs
node --check scripts/assert_curated_ecosystem_contract.mjs
node --check scripts/assert_community_processor_board_contract.mjs
node --check scripts/assert_official_three_assets_contract.mjs
node --check scripts/assert_global_typography_contract.mjs
node --check scripts/assert_freshness_recovery_contract.mjs
node --check scripts/assert_bem_realtime_scheduler_contract.mjs
node --check scripts/assert_official_asset_schedule_contract.mjs
node --check scripts/assert_transistor_candle_contract.mjs
git diff --check

grep -q '"protocol_scope"' "$work/analytics.json"
grep -q '"airdrop"' "$work/analytics.json"
grep -q '"mode":"time_series"' "$work/daily.json"
grep -q '"granularity":"day"' "$work/daily.json"
grep -q '"timezone":"Asia/Shanghai"' "$work/daily.json"
grep -q '"buckets"' "$work/daily.json"
grep -q '"page_size":10' "$work/processors.json"
[ "$(grep -o '"address"' "$work/processors.json" | wc -l | tr -d ' ')" = "10" ]
node scripts/assert_bem_release_contract.mjs "$work"
node scripts/assert_activity_timeseries_contract.mjs "$work"
node scripts/assert_airdrop_health_contract.mjs "$work"
node scripts/assert_qa_ui_contract.mjs
node scripts/assert_learning_contract.mjs "$work"
node scripts/assert_registry_label_governance_contract.mjs "$PWD"
node scripts/assert_learning_layout_contract.mjs
node scripts/assert_startup_resilience_contract.mjs
node scripts/check_production_i18n.mjs "$base"
node scripts/check_production_registry_governance.mjs "$base"
node scripts/assert_api_i18n_contract.mjs "$base"
node scripts/assert_curated_ecosystem_contract.mjs "$base"
node scripts/assert_community_processor_board_contract.mjs "$base"
node scripts/assert_official_three_assets_contract.mjs "$base"
node scripts/assert_global_typography_contract.mjs
node scripts/assert_freshness_recovery_contract.mjs "$base"
node scripts/assert_bem_realtime_scheduler_contract.mjs "$PWD"
node scripts/assert_official_asset_schedule_contract.mjs
node scripts/assert_transistor_candle_contract.mjs "$base"
if [[ "$base" =~ ^http://(localhost|127\.0\.0\.1): && "${VERIFY_SCHEDULED:-0}" == "1" ]]; then
  curl -fsS --max-time 145 "$base/cdn-cgi/local/scheduled" > "$work/local-scheduled.txt"
  curl -fsS "$base/api/v1/data-health" > "$work/local-health-after-scheduled.json"
  grep -q '"registry":{"status":"healthy"' "$work/local-health-after-scheduled.json"
elif [[ "$base" =~ ^http://(localhost|127\\.0\\.0\\.1): ]]; then
  echo "NOTE: local scheduled-source run skipped; set VERIFY_SCHEDULED=1 to include the external-source isolation check."
fi
for id in language-select learn learn-map learn-steps learn-safety learn-search learn-tier learn-stage learn-language learn-resources learn-pagination discover updates-stream tools-directory holders official-asset-projects official-asset-address-rows official-asset-status transistor-candle-chart transistor-candle-interval transistor-candle-range protocol-scope activity-range activity-granularity activity-timezone daily-metric daily-chart daily-coverage daily-heatmap bem-mining-facts bem-price-facts bem-events bem-task-meta bem-task-engineering bem-tasks bem-task-pagination bem-algorithm leader-pagination creator-pagination page-prev page-next; do
  grep -q "id=\"${id}\"" "$work/index.html"
done
grep -q 'value="circuit_delta"' "$work/index.html"
grep -q 'value="7d"' "$work/index.html"
grep -q 'value="day"' "$work/index.html"
grep -q 'id="bem-task-kind"' "$work/index.html"
grep -q 'bem-top-grid' public/styles.css
grep -q 'bem-events-grid' public/styles.css
grep -q 'learn-grid' public/styles.css
grep -q 'learn-grid' public/learning.css
grep -q 'ecosystem-grid' public/learning.css
grep -q 'official-asset-panel' public/learning.css
grep -q 'transistor-candle-section' public/learning.css
! grep -q 'kpiRawMinted' public/app.js

echo "PASS: release contract review completed against ${base}"
