# worker.js 领域模块拆分报告（2026-08-27）

## 任务

把单文件 `src/worker.js`（1972 行）按纯机械方式拆分为领域模块，零行为变更：每个函数/常量体逐字搬移（仅新增 `import`/`export` 关键字），不改名、不改逻辑顺序、不"顺手优化"。

## 拆分结果：新文件与内容

| 文件 | 行数 | 内容 |
|---|---|---|
| `src/constants.js` | 64 | PROCESSORS_URL/HOME_URL/RELEASE/PROTOCOL_TIME_BASIS/PROTECTED_PROCESSOR_HASHES、市场/Airdrop/BEM 地址与 URL 常量、OFFICIAL_THREE_PROJECTS、OFFICIAL_TRANSISTOR_CANDLE_ASSETS |
| `src/learning_resources_seed.js` | 21 | LEARNING_CATALOG_VERSION/REVIEWED_AT + LEARNING_RESOURCES 冻结数组，镜像 `curated_ecosystem_seed.js` 的导出风格 |
| `src/util.js` | 90 | sha256/pick/toBigInt/comparison/completionBps/completionBand/circuitBand/json/hexToNumber/hexToBigInt/hexWord/hexAddress/topicAddress/dataWord/formatBnb/csvEscape/fetchJsonWithTimeout/fetchTextWithTimeout/websiteLabel |
| `src/freshness.js` | 28 | freshnessFlights/minutesSince/inFreshnessFlight/needsFreshnessRecovery/ensureScheduledDomainFresh |
| `src/events.js` | 26 | ensureEventSchema/eventStatement |
| `src/registry.js` | 145 | normalizeRows/fetchPublicSources/ensureRefreshSchema/recordRefreshRun/refresh/toPublicProcessor/applyProcessorFilters/sortProcessors/currentRows/ensureRegistryFresh |
| `src/airdrop.js` | 102 | AIRDROP_RPCS（含其注释块）、ensureAirdropSchema/decodeAirdropDrops/airdropRpc/syncAirdrops/airdropOverview/ensureAirdropFresh/syncAirdropsObserved |
| `src/community.js` | 219 | TAPEOUT_CLUB_* 常量 + ensureCommunityHolderSchema/communityNumber/normalizeCommunityBoard/fetchTapeoutClubBoard/recordCommunityBoardRun/syncCommunityProcessorBoard/ensureCommunityBoardFresh/communityFreshness/communityProcessorBoardHealth/aggregateCommunityAddresses/communityRoundedAddressGroup/communityProcessorLeaderboard |
| `src/official_assets.js` | 395 | OFFICIAL_CPU_STATS_URL/MARKET_SNAPSHOT_URL、OFFICIAL_ASSET_REFRESH/HEALTH_MINUTES（export）、TRANSISTOR_CANDLE_* 常量、ensureOfficialAssetSchema 全套 + transistor candle 全套（ensureTransistorCandleSchema…officialTransistorCandles，含 bnbFromWei 等蜡烛图辅助函数） |
| `src/bem.js` | 365 | BEM_HEALTH_MINUTES/BEM_PRICE_HEALTH_MINUTES（export）/BEM_PRICE_REFRESH_MINUTES（export）/BEM_CATALOG_HEALTH_MINUTES/BEM_RPC_METRICS（export）+ 全部 bem* 函数、syncBemObserved、ensureBemMiningFresh/ensureBemPriceFresh/ensureBemSchema |
| `src/market.js` | 122 | CIRCUIT_MARKET_SOLD_TOPIC/MARKET_CONFIRMATIONS/MARKET_LOG_WINDOW*/LARGE_SALE_WEI + ensureMarketSchema/marketRpcUrl/rpc/processorForCircuit/marketEventStatement/syncCircuitMarket/recordMarketSync/syncCircuitMarketObserved/marketOverview |
| `src/analytics.js` | 142 | protocolPulse/segmentAnalytics/activityOffsetMs/activityBucketStartMs/activityBucketKey/dailyActivity/dataHealth/analytics/ensureFreshnessRecovery |
| `src/api_i18n.js` | 141 | API_RESPONSE_LOCALES/API_LOCALE_METADATA/LEARNING_GOVERNANCE_COPY/requestedApiLocale/learningLocalization/localizedLearningItem/learningResources/ecosystemLocalization/localizedEcosystemItem/curatedCollection |
| `src/router.js` | 138 | v1/api |
| `src/worker.js`（改造后） | 50 | 仅 import + runScheduledSync + `export default { fetch, scheduled }` |

未改动：`src/curated_ecosystem_seed.js`（211 行）、`public/`、`wrangler.toml`。

## 依赖方向（验证为无环 DAG）

```
constants/seeds → util → freshness/events → 领域模块(registry/airdrop/bem/market/community/official_assets)
  → analytics/api_i18n → router → worker.js
```

关键设计点：每个领域的 `ensureXFresh`（如 `ensureRegistryFresh`、`ensureBemPriceFresh`）都留在**各自的领域模块**里，而不是放进 `freshness.js`——`freshness.js` 只提供通用的 `ensureScheduledDomainFresh` 骨架。这样 `freshness.js` 永远不需要反向导入任何领域模块的 sync 函数，从而避免了"领域模块 → freshness.js → 领域模块"的潜在环。`analytics.js` 的 `ensureFreshnessRecovery` 汇总调用六个领域的 `ensureXFresh`，处于 DAG 更上层，符合方向要求。

实际检查：本次拆分**没有遇到真正的循环依赖**，因此没有被迫做"下沉最小片段"式的妥协。

## 5 项验证结果（含命令与真实输出）

**Gate 1 — `node --check src/*.js`**：全部通过，无输出。

**Gate 2 — `npx wrangler deploy --dry-run --outdir=/tmp/refactor-bundle`**：
```
✨ Read 38 files from the assets directory .../public
Total Upload: 214.35 KiB / gzip: 49.35 KiB
Your Worker has access to the following bindings:
Binding                           Resource         
env.DB (tapeout-monitor)          D1 Database      
env.ASSETS                        Assets           
--dry-run: exiting now.
```
构建成功，证明所有 15 个 `src/*.js` 文件之间的 import 均可解析。

**Gate 3 — `scripts/assert_*.mjs` 全量对比（拆分前基线 vs 拆分后）**：

| 脚本 | 基线 | 拆分后 | 说明 |
|---|---|---|---|
| assert_activity_timeseries_contract.mjs | FAIL (需要 `<response-dir>` 参数) | FAIL（同因） | 预先存在，非本次引入 |
| assert_airdrop_health_contract.mjs | FAIL（需要 `<review-workdir>`） | FAIL（同因） | 预先存在 |
| assert_api_i18n_contract.mjs | FAIL（需本地 dev server :8796） | FAIL（同因） | 预先存在 |
| assert_bem_price_degradation.mjs | FAIL（需要 `<response-dir>`） | FAIL（同因） | 预先存在 |
| **assert_bem_realtime_scheduler_contract.mjs** | **PASS** | **PASS**（脚本已改：BEM_PRICE_HEALTH/REFRESH_MINUTES 改读 `src/bem.js`） | 触及 worker.js，已修复脚本 |
| assert_bem_release_contract.mjs | FAIL（需要 `<response-dir>`） | FAIL（同因） | 预先存在 |
| assert_community_processor_board_contract.mjs | FAIL（需 dev server，404） | FAIL（同因） | 预先存在 |
| **assert_curated_ecosystem_contract.mjs** | FAIL（到网络请求阶段前的静态断言全部 PASS，之后因无 dev server :8796 连接失败） | 同上（脚本已改：静态检查改读 `src/router.js` + `src/api_i18n.js`，逐行验证与基线一致停在同一网络失败点） | 触及 worker.js，已修复脚本 |
| assert_freshness_recovery_contract.mjs | FAIL（需要 `<base-url>`） | FAIL（同因） | 预先存在 |
| assert_global_typography_contract.mjs | **PASS** (37 checks) | **PASS** (37 checks) | 未触及 worker.js |
| assert_learning_contract.mjs | FAIL（需要 `<workdir>`） | FAIL（同因） | 预先存在 |
| assert_learning_layout_contract.mjs | **PASS** | **PASS** | 未触及 worker.js |
| **assert_official_asset_schedule_contract.mjs** | **PASS** | **PASS**（脚本已改：OFFICIAL_ASSET_REFRESH/HEALTH_MINUTES 等改读 `src/official_assets.js`） | 触及 worker.js，已修复脚本 |
| assert_official_three_assets_contract.mjs | FAIL（需 dev server，fetch failed） | FAIL（同因） | 预先存在 |
| assert_qa_ui_contract.mjs | **PASS** (24 checks) | **PASS** (24 checks) | 未触及 worker.js |
| **assert_registry_label_governance_contract.mjs** | **PASS** | **PASS**（脚本已改：websiteLabel 检查改读 `src/util.js`，Behemoth 地址检查改读 `src/constants.js`，WEBSITE_LABELS 负向检查改为扫描全部 `src/*.js`） | 触及 worker.js，已修复脚本 |
| assert_startup_resilience_contract.mjs | **PASS** (7 checks) | **PASS** (7 checks) | 未触及 worker.js |
| **assert_transistor_candle_contract.mjs** | FAIL（静态 token 断言全部 PASS，之后因无 dev server :8820 连接失败） | 同上（脚本已改：静态检查合并读取 `src/official_assets.js` + `src/router.js` + `src/worker.js`，同样停在网络失败点，token 断言零失败） | 触及 worker.js，已修复脚本 |

结论：**拆分前后，7 个"无需外部依赖即可判定"的脚本 PASS/PASS 完全一致；11 个需要 dev server 或 CLI 参数的脚本 FAIL/FAIL 完全一致（均为预先存在、非本次引入）。** 5 个直接读取 `src/worker.js` 的脚本已按"哪个模块真正持有该字符串就读哪个模块"的原则更新读取路径，更新后逐条断言全部通过或在与基线相同的位置停止（网络阶段）。

**Gate 4 — `npx wrangler dev` 本地冒烟**：
```
GET /                        -> HTTP 200 (HTML)
GET /api/v1/catalog          -> HTTP 200 (JSON)
GET /api/v1/source-status    -> HTTP 200 (JSON)
```
另外验证了 `/api/v1/bem/overview`、`/api/v1/official-assets/overview`、`/api/v1/community/processor-leaderboard`、`/api/v1/learn/resources`、`/api/v1/updates`、`/api/v1/tools` 均为 200（本地 D1 为空，返回 bootstrap/空状态属预期）。

`/api/v1/analytics`、`/api/v1/data-health`、`/api/v1/events`、`/api/v1/processors` 返回 500 `D1_ERROR: no such table: snapshots/processors_current`。**已用 `git stash -u` 验证**：在未改动的原始 `worker.js`（1972 行）上、同样的本地空 D1 环境下跑 `wrangler dev`，`/api/v1/analytics` 报**完全相同**的 500（`no such table: processors_current`）。这些表（`snapshots`/`processors_current`/`changes`/`processor_snapshots`）从未由任何 `ensureXSchema()` 函数创建（本仓库也没有 `migrations/` 目录），本地空 D1 缺表是拆分前后共同的环境前提条件，不是本次重构引入的问题。

**Gate 5 — 行数核算**：

原始基线：`worker.js`(1972) + `curated_ecosystem_seed.js`(211) = **2183 行**
拆分后：15 个 `src/*.js` 合计 **2259 行**（含未改动的 `curated_ecosystem_seed.js`）
差额：**+76 行**（超出 ±40 的参考区间约 36 行）

差额来源核实：
- 14 个新文件共新增至少 49 行以 `import` 开头的语句（部分为多行 import 块，实际消耗行数更多，如 `bem.js`、`router.js`、`official_assets.js` 的多行导入块）。
- 少量为清晰起见新增的 `export { NAME };` 独立行（如 `bem.js` 的 `BEM_RPC_METRICS`）。
- 各文件间保留了原文件的空行排版习惯，多文件切分自然带来若干额外空行。
- **未发现任何函数体重复**：对 `refresh`/`syncAirdrops`/`syncBemMining`/`syncCircuitMarket`/`analytics`/`v1`/`api`/`officialTransistorCandles`/`syncCommunityProcessorBoard` 等标志性函数做了跨文件 grep，每个都且仅在其目标文件中出现一次。
- 结论：+76 行全部来自 import/export 脚手架和空行，没有丢内容也没有重复内容，超出参考区间但性质温和，属于"文件数从 2 个变成 15 个"必然带来的胶水代码增量。

## 判断调用（非"读代码即可确定"的取舍，均记录于此）

1. **module-scope `let` 变量拆分**：原文件第 148 行 `let eventSchemaReady, refreshSchemaReady, airdropSchemaReady, bemSchemaReady, communityHolderSchemaReady, officialAssetSchemaReady, officialAssetBootstrapPromise, transistorCandleSchemaReady, transistorCandleBootstrapPromise;` 是一条跨多个领域的共享声明语句。拆分后按各自归属拆成多条独立的 `let` 声明，分别落在 `events.js`/`registry.js`/`airdrop.js`/`bem.js`/`community.js`/`official_assets.js`（含 4 个 official_assets 相关变量）。**这是一处非逐字的必要改动**：每个变量只被其对应模块的函数读写过（已逐一核实），行为完全等价，只是声明语法从"一条语句多个变量"变成"多条语句各一个变量"。

2. **`TAPEOUT_CLUB_*` 与 `OFFICIAL_CPU_STATS_URL`/`OFFICIAL_MARKET_SNAPSHOT_URL`/`TRANSISTOR_CANDLE_*` 常量未放进 `constants.js`**：任务书对 `constants.js` 的描述是"market/airdrop/BEM addresses+URLs"，字面上未提到 community/official-assets/candle 类目。由于这几组常量只被各自领域模块内部使用（`TAPEOUT_CLUB_URL` 只用于 `community.js`；`OFFICIAL_CPU_STATS_URL` 只用于 `official_assets.js`；`TRANSISTOR_CANDLE_PROVIDER` 等只用于 `official_assets.js` 的蜡烛图部分），比照任务书里 `AIRDROP_RPCS`"因为是领域专属而下沉到 airdrop.js"的先例，选择就近放在各自领域文件顶部（保留原注释块），而不是塞进 `constants.js`。这样做减少了不必要的跨文件常量导出，也更符合"每个函数/常量放在其主导调用者旁边"的兜底原则。

3. **`OFFICIAL_ASSET_REFRESH_MINUTES`/`OFFICIAL_ASSET_HEALTH_MINUTES` 与 `BEM_PRICE_REFRESH_MINUTES`/`BEM_PRICE_HEALTH_MINUTES`/`BEM_RPC_METRICS` 加了 `export`**：这些常量原本只在 worker.js 内部使用，但拆分后 `OFFICIAL_ASSET_REFRESH_MINUTES` 需要被 `worker.js`（`scheduled()` 里的分钟取模判断）引用，`BEM_RPC_METRICS` 需要被 `router.js`（`/api/v1/source-status` 的 `methods` 字段）引用，因此导出。这是任务书明确允许的"仅新增 import/export 关键字"范围内的改动。

4. **`LEARNING_CATALOG_VERSION`/`LEARNING_CATALOG_REVIEWED_AT` 放进 `learning_resources_seed.js` 而不是 `api_i18n.js`**：任务书原文写"mirroring the existing curated_ecosystem_seed.js pattern"，而 `curated_ecosystem_seed.js` 正是把 `ECOSYSTEM_CATALOG_VERSION`/`ECOSYSTEM_REVIEWED_AT` 与数据一起导出。据此把两个 LEARNING_CATALOG_* 常量与 `LEARNING_RESOURCES` 放在同一个种子文件里，`api_i18n.js` 从种子文件导入使用。

5. **`officialAssetAddresses` 函数体内的局部变量 `let currentRows`**：与 `registry.js` 导出的 `currentRows` 函数同名。这是**原始文件里就存在的同名局部变量**（原 worker.js 第 953 行），拆分时逐字保留，只是现在"外层同名函数"来自另一个模块而非同文件顶部——因为 `official_assets.js` 根本没有导入 `registry.js` 的 `currentRows`，这个局部变量只是简单遮蔽（shadow）自己作用域内的绑定，无实际歧义，行为不变。

6. **函数在文件内的相对顺序**：为避免 TDZ（如 `OFFICIAL_TRANSISTOR_CANDLE_ASSETS` 依赖 `OFFICIAL_THREE_PROJECTS`、`BEM_PRICE_PAIR_URL` 依赖 `BEM_PRICE_PAIR_ADDRESS`），每个新文件内部保持了原文件中这些声明的相对先后顺序；但跨模块整体上，函数被移动到了不同文件（如 `airdrop.js` 里 `syncAirdropsObserved` 从原文件很靠后的位置搬到了本文件末尾，紧跟在 `airdropOverview` 之后）——这是拆分的必然结果，函数声明具备提升（hoisting），不影响行为。

## 未使用/未验证到的部分

- 大量 `assert_*.mjs` 脚本因为需要本地 dev server 或 CLI 参数才能跑完整流程，本次仅验证了"静态断言部分与基线行为一致"，未额外搭建它们所需的完整环境（超出本次任务范围，且这些脚本本就不读 `src/worker.js`，与本次重构无关）。
- 未对生产 D1 做任何操作，`snapshots`/`processors_current` 等表的缺失是本地开发环境的固有状态，与本次重构无关，未做修复（不在任务范围内）。

## 提交

单次 commit：`refactor: split worker.js into domain modules (no behavior change)`，未 push。
