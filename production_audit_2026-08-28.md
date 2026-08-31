# 生产验收记录（2026-08-28）

生产地址：[TapeOut Intelligence](https://tapeout-public-monitor.tapeout-labs.workers.dev/)。本轮新增：电路计数排行榜（钱包/题目集中度 + 处理器分布 + 挖矿池权重增长）。方法：先本地 `wrangler dev` + 真实官方数据源验证，再真实 Chromium 人工复核双语渲染，最后走完整发布契约脚本。

## 背景与方法论边界

用户提供了社区 Dune 看板 [TapeOut Mining Intelligence](https://dune.com/ekonomeest/tapeout-mining-intelligence)（作者 `@ekonomeest`），要求参考其图表选题、反向解析并整合进本站。审阅该看板后确认其钱包/电路/题目排行榜基于对链上事件的自有解码得到精确的 H 权重（`H=(b*+K_task·q)×P`），本站未复现该解码管线，因此**不追求数字对齐**，改为独立可验证的替代方案：

- 数据源：官网公开挖矿地址索引 `tapeout.net/pod/pod-miners.json`（钱包 → 电路列表，1283 个钱包 / 13304 条电路记录），本站 `syncBemCatalog` 每轮同步本就已拉取该文件用于 `miner_index_count`/`owner_count` 聚合，此次复用同一次拉取結果，不新增抓取成本。
- 指标：改为**电路计数**口径（钱包排行榜、题目集中度、Top-10 钱包占比、处理器分布），在服务端与前端所有位置都明确标注"不是协议 H 权重公式"，从不以 BEM/天或官方产出份额呈现，避免与 Dune 看板的权重口径混淆。
- 已在页面头部与 API `source.inspiration` 字段致谢原看板与作者，注明图表选题受其启发，但数据独立计算、不抓取不复制 Dune 内容。

| 验收域 | 方法 | 生产结果 |
| --- | --- | --- |
| 后端聚合 | 本地 `wrangler dev` 触发 `/cdn-cgi/local/scheduled` 后直接 curl 新端点 | `/api/v1/bem/leaderboard` 返回 `total_circuit_count=13304`、`top10_wallet_share_pct=19.73`、`cpu_counts={Behemoth:1920,TapeOut:11384}`，与手工 Python 聚合原始 JSON 的结果一致。新表 `bem_leaderboard_snapshots` 与既有 `bem_miner_index_snapshots` 共用同一次 `pod-miners.json` 拉取和哈希去重判断，零新增外部请求。 |
| 前端渲染（真实数据，非 mock） | 绕过本地全新 D1 尚缺 Registry 域 `snapshots` 表导致的 `load()` 早退（与本次改动无关的既有本地环境缺口），直接调用页面内 `window.load()` 触发真实渲染路径 | 统计条、处理器分布横向条形图（复用站内既有 `bars()` 组件与 cyan 配色）、挖矿池权重增长折线图（复用 `.history-chart` SVG 组件与既有 cyan/amber 配色）、两张排行榜表格（复用 `.table-wrap`/`table` 组件）全部使用站内已有组件与已验证配色，零新增 CSS 变量，样式与全站保持一致。 |
| 双语核查 | 真实 Chromium 切换到中文后截图复核 | 全部标签、表头、图例、致谢链接正确翻译，无中文/英文混排残留，无布局挤压或溢出。 |
| 契约脚本基线 | 全量 `assert_*.mjs` | `pass=8 fail=11`，与改动前基线一致（失败项均为需要专属本地端口的脚本，与本次改动无关）。缓存版本号按惯例 lockstep bump 至 `2026-08-28-leaderboard-r20`（覆盖 `app.js`/`index.html` 共 2 处引用 + 6 个契约脚本硬编码引用）。 |

> 数据边界：`/api/v1/bem/leaderboard` 明确标注方法论（电路计数，非官方 H 权重）、来源（官网 `pod-miners.json`）与致谢（Dune 看板 `@ekonomeest`，仅图表选题参考，非数据来源）。不引入钱包身份推断，不新增外部信任边界。

## 第二轮：接口延迟优化（`/api/v1/data-health`、`/api/v1/official-assets/overview`、`/api/analytics`、`/api/v1/official-assets/addresses`）

延续本会话早前发现的问题：首屏并发加载时这四个接口各自耗时 460–730ms。用真实代码走读（而非猜测）定位到统一的反模式——`await ensureXFresh(env)` 写在读取之前，强制"先等一次新鲜度检查的 D1 往返，再并发读"，把本可并发的查询拆成了两轮串行网络往返；`officialAssetOverview`/`officialAssetAddresses` 还各自多出一次纯粹为"确认快照存在"的冗余查询（与紧跟着的正式查询重复读同一行）；`officialAssetOverview` 里"取上一份快照 id→再按 id 查上一份快照行"也是两轮串行，其实可以用相关子查询一次拿到。

| 验收域 | 方法 | 结果 |
| --- | --- | --- |
| 根因定位 | 逐行读 `official_assets.js`/`analytics.js`/`airdrop.js`/`community.js`/`router.js`，数清每个请求的 D1 往返次数与真实先后依赖 | `officialAssetOverview` 单次请求原有 8 次 D1 查询，其中 5 次在关键路径上严格串行（bootstrap 存在性检查→新鲜度检查→健康度读取→当前/上一份快照 id→上一份快照行），其余 3 个受影响接口是同一反模式的变体。新鲜度检查本身只在触发后台同步时才需要阻塞（罕见），健康场景下就是又一次可并发的读。 |
| 修复方式 | 5 个函数改为"新鲜度检查与展示读一起并发"，删除 2 处 overview/addresses 独有的冗余存在性检查（改为仅当真的没有快照时才补一次），2 处"先查上一份快照 id 再查其行"改为相关子查询一次并发拿到 | `officialAssetsHealth`/`airdropOverview`/`communityProcessorBoardHealth`/`dataHealth`/`analytics`/`/api/summary` 共 6 处；每处改动只调整了 `Promise.all` 的组队方式或用子查询合并两次查询，未改变任何返回字段或业务逻辑。 |
| 正确性验证（真实数据，非 mock） | 本地 `wrangler dev` 补齐核心 schema（`schema.sql`/`schema_events.sql`/`schema_workbench.sql`，本地全新 D1 默认没有——发现 `schema.sql` 里的 `processors_current` 定义比线上代码少了 `creator_address`/`transistor_address` 两列，是历史遗留的过期引导脚本，线上表已通过别的迁移方式补齐，本轮不改，仅记录供以后排查参考）后跑通全部四个接口 | `/api/summary`（823 处理器）、`/api/analytics`（`counts`/`segments`/`scatter`/`pulse`/`airdrop` 全部正常）、`/api/v1/data-health`（`registry.status=healthy`）、`/api/v1/official-assets/overview`（3 个项目，`change_from_previous_snapshot` 差值正确）、`/api/v1/official-assets/addresses`（155 条按钱包聚合，差值正确）——与改动前返回结构逐字段核对一致，子查询合并未改变任何数值。 |
| 契约脚本基线 | 全量 `assert_*.mjs` | `pass=8 fail=11`，与改动前一致。缓存版本号 lockstep bump 至 `2026-08-28-perf-r21`。 |

> 说明：本轮是纯查询编排重构（改并发顺序 + 子查询合并），不改变任何 API 返回字段、不改变新鲜度判定阈值、不改变前端代码。生产环境下每次 D1 网络往返的真实耗时才是本次瓶颈的主因（本地内存态 SQLite 无法复现该延迟，故本轮把验证重心放在"正确性不回归"而非本地测速）。

**部署后生产实测**（真实 Chromium，同一套 `performance.getEntriesByType` 并发首屏加载测量法，与本次优化前的原始发现方法一致）：

| 接口 | 优化前 | 优化后 | 变化 |
| --- | --- | --- | --- |
| `/api/v1/data-health` | ~700–730ms | 381ms | ↓ 约 48% |
| `/api/v1/official-assets/overview` | ~700–730ms | 449ms | ↓ 约 37% |
| `/api/analytics` | ~700–730ms | 362ms | ↓ 约 48% |
| `/api/v1/official-assets/addresses` | ~700–730ms | 354ms | ↓ 约 50% |

（对照：不含 D1 查询的纯静态接口 `/api/v1/catalog` 热连接下约 74–100ms，说明剩余耗时大头是 Cloudflare Worker↔D1 跨网络往返本身，而非代码逻辑；本轮消除的是"本可并发却被串行等待"的那部分往返，不是全部。）

## 第三轮：板块间距统一

用户反馈"有些板块间隔特别大、丑、要么统一要么对齐"。用真实 DOM 量出全站每个顶层 `<section>` 之间的实际间距（`getBoundingClientRect` 差值），发现除 `#learn`（84px）与 `#discover`（最高 104px）两处外，其余全部标题区块与上一板块之间的间距都是 0px——即全站本就统一依赖 `.section-heading` 自身的 54px 顶部内边距做视觉分隔，不额外加 margin。这两处各自带着一条历史遗留的 bespoke `margin-top`（`styles.css` 里 `.learn-heading{margin-top:5.25rem}`，`learning.css` 里 `.discover-heading{margin-top:clamp(3rem,7vw,6.5rem)}`，含各自的移动端变体），与其余板块的节奏脱节，正是用户看到的"缝"。

删除这四条多余规则（桌面+移动端各一对），让 `#learn`/`#discover` 与其余所有板块共用同一套间距节奏。生产部署后用相同的 DOM 量测方法复核：两处间距均已归零，与其余板块完全一致。契约脚本基线不变（`pass=8 fail=11`），缓存版本 bump 至 `2026-08-28-spacing-r22`。
