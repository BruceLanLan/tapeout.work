# Cloudflare deployment notes

## 2026-08-19 first Git build

The initial Cloudflare Workers build reached `npx wrangler deploy`, uploaded the three public assets, and then failed with code `10021`: the `DB` D1 binding did not contain a valid `database_id`.

The build log showed that the checked-out repository configuration still used `REPLACE_WITH_CLOUDFLARE_D1_DATABASE_ID`. The next deployment commit must update the repository's `wrangler.toml` to use the already-created `tapeout-monitor` database ID, while preserving the binding name `DB` and the hourly cron schedule.

## 2026-08-19 deployed and verified

The repository is now connected to Cloudflare Workers Builds. The `main` branch deploys `npx wrangler deploy` and uses the `DB` binding for `tapeout-monitor`.

The Worker has an hourly cron trigger at minute 15 UTC. The initial verified public snapshot was stored at `2026-08-19T07:22:18.425Z`, with 565 public processor records and 3,309 observed circuits. The public source returned 566 records at that time; one protected private record was excluded by the server-side SHA-256 filter.

The original public Worker was available under the account's initial default workers.dev subdomain, since migrated away (see the entry below). Public UI rendering escapes externally supplied Processor names and change text, while raw API values remain source-attributed observations.

## 2026-08-19 intelligence workbench and public event API

The account Workers subdomain was migrated to the neutral `tapeout-labs.workers.dev` namespace. The live public entrypoint is now `https://tapeout-public-monitor.tapeout-labs.workers.dev/`.

The current Worker stores public Creator and transistor-contract fields, address-level snapshots, and evidence-backed public events. It supports the full public Processor registry through server-side pagination, deterministic official Tapeout detail links, current Creator aggregates, current-view CSV exports, and client-side non-executing research strategies.

All public endpoints are discoverable under `/api/v1/catalog`; `/api/v1/openapi.json` provides a lightweight OpenAPI descriptor. The event stream at `/api/v1/events` currently emits only `protocol_observed` events derived from public registry changes: Processor creation, Mint deltas, Circuit deltas, and first observed supply completion. It deliberately does not infer official/community endorsements, creator wallet actions, marketplace sales, or price metrics without a public verifiable source.

At the latest validated refresh (`2026-08-19T08:36:27.931Z`), the public registry contained 568 structurally valid, privacy-filtered Processor rows and 3,512 observed circuits. API validation covered the catalog, OpenAPI description, final pagination page, evidence events, non-executing strategy schema, CSV header, and absence of protected-record data in the public catalog.

## 2026-08-28 custom domain

The user registered `tapeout.work` and added it to the same Cloudflare account as a zone (nameservers already active). Attached it to the Worker as a Custom Domain route via `wrangler.toml` (`[[routes]] pattern = "tapeout.work", custom_domain = true`) and `wrangler deploy`; confirmed in the deploy output (`tapeout.work (custom domain)`) and via public DNS (resolves to real Cloudflare edge IPs). `https://tapeout-public-monitor.tapeout-labs.workers.dev/` remains attached and serves identical content — no redirect was configured, both are live. `tapeout.work` is now the documented primary entrypoint (API.md updated); live reachability from this session's sandboxed network could not be independently confirmed (the sandbox's own outbound network policy does not yet recognize the brand-new domain, confirmed by testing a known-working domain over the same path) and should be checked directly by the user.

## 2026-09-03 Workers Paid：放置、日志、边缘缓存

账号升级到 Workers Paid（起因是 2026-09-02 撞上 D1 免费层每日写入上限，见 `FRESHNESS_INCIDENT_2026-09-02-d1-write-limit.md`）。升级后 D1 不再有每日硬上限，读写行数变成月度额度与账单；预计算与只写变化行的纪律不变。

基线（从亚洲访问，每接口 3 次）：所有 `/api/v1/*` 接口 0.45–0.7 秒，首页 0.5–1.0 秒；每个接口 3–8 次 D1 往返，API 响应 `cache-control: no-store`。

分两步上线，便于归因：

1. `[placement] mode = "smart"`（Worker 跑到 D1 旁边）+ `[observability] enabled = true`（Workers Logs）+ `transistor_candle_trade_rows(block_timestamp)` 索引（蜡烛覆盖读的 MIN/MAX 原来每次扫 ~870 行、每天 633 次）。
2. GET `/api/v1/*` 的边缘缓存（`router.js` 的 `EDGE_CACHE`）：目录类接口 60 秒、健康类 15 秒、其余 30 秒，只缓存 200；`bem/budget-quote`（实时遍历卖单簿）与 `export.csv` 不缓存。每个被缓存的响应都自带 `checked_at`/`observed_at`，短时边缘副本不歪曲新鲜度。`ship.mjs` 的生产核验 URL 带 nonce 绕过缓存。

未做：D1 读副本（放置后收益不大且要改所有查询）；蜡烛同步每天 16 万次 `INSERT OR IGNORE` 全是重复行（0 写入，约 10 秒 CPU/天，后续可加游标过滤）；Browser Rendering 已可用但未启用（能力变化、新增经常性费用，不在性能范围内）。

实测（服务端耗时 = TTFB − TLS 完成时刻，中位数，秒；nonce 绕过缓存为 miss）：

| 接口 | 缓存命中 | 未命中 |
|---|---|---|
| data-health | 0.103 | 0.431 |
| analytics | 0.094 | 0.224 |
| official-assets/addresses | 0.092 | 0.218 |
| bem/trades | 0.097 | 0.238 |
| self-audit | 0.095 | 0.266 |
| bem/leaderboard | 0.127 | 0.149 |
| tools（无 D1，对照） | 0.091 | 0.095 |

命中时所有接口都落到静态文件的地板（约 0.09 秒）；D1 接口未命中时 0.15–0.43 秒，这部分等 Smart Placement 生效后再测（上线 40 分钟内 `cf-placement` 仍为 `local-SIN`，放置需要观察流量后才切换）。

## 2026-09-03 BSC 日志提供方、持币地址数、本机合并即部署

- 免密钥公共 RPC 实测（`eth_getLogs`）：**PublicNode** 只服务近期窗口（历史区间报 "Archive requests require a personal token"），从 Cloudflare 出口约四轮成功一轮；**bloXroute `https://bsc.rpc.blxrbdn.com` 提供归档日志**（近期窗口与 PublicNode 逐条一致，历史 5000 块窗口可用）；官方 dataseed 系列一律 "limit exceeded"；1rpc 限 50 块；tatum 限 100 块；ankr/drpc/nodereal/zan/getblock 要 key 或超限；blastapi 限流；lava 已停；其余非 JSON。
- Circuit 市场扫描用 `BSC_LOGS_RPC_URL=PublicNode`，3 窗口/成功轮，过旧检查点跳到近期并公开 `coverage.gaps`。
- 持币地址数两条口径：**GeckoTerminal 代币信息接口的 `holders.count`**（第三方，立即可用，5 分钟一存，面板标注"GeckoTerminal 口径 · 第三方"）；**链上 Transfer 普查**用 `BSC_ARCHIVE_RPC_URL=bloXroute`，窗口 5000 块 × 12/轮，追平后成为主口径。两者在 `/api/v1/bem/holders` 并列，`status` 取普查健康时为 `ok`，否则有第三方值为 `third_party`。
- 部署：Cloudflare 的 OAuth 登录令牌无权创建 API token（`/user/tokens` 返回 Unauthorized），所以"合并即部署"改由本机 launchd 每 10 分钟监视 `origin/main` 完成（`scripts/deploy_watch.mjs`），不需要 token。

### 持币普查回填（2026-09-03）

bloXroute 从 Cloudflare 出口跑历史窗口会超时/502，从本机 5000 块窗口稳定。处理：撤掉 `BSC_ARCHIVE_RPC_URL` 暂停 Worker 普查 → 本机 `node scripts/backfill_bem_holders.mjs`（读取 D1 现有余额与检查点，从检查点+1 折算到 latest−12，零地址不计入，写绝对余额 + 检查点 + 一条 ok 运行记录）→ 重新 `wrangler secret put BSC_ARCHIVE_RPC_URL` 让 Worker 从头部增量继续（增量扫描遇超时会自动把窗口减半重试）。**两者绝不能同时跑**，否则重复应用增量。`/api/v1/bem/holders` 的 `reconciliation` 给出普查与 GeckoTerminal 计数之差。

回填结果（2026-09-03 09:56 UTC）：从区块 116,900,000 折算到 119,703,055，共 2,595,728 笔 Transfer，3,442 个地址、全部余额非负（起点早于首笔铸造，估计正确）；**链上普查 3,442 个持币地址，GeckoTerminal 同刻 3,428，相差 14**（聚合方自身的截止与计数规则）。本机 6 路并发、1000 块窗口约 45 分钟。回填期间 Worker 普查暂停（撤密钥），完成后恢复，增量从 119,703,055 起以 2000 块 × 3 窗口/轮继续。

## 2026-09-05 边缘缓存把新鲜度接口挂上了 4 小时浏览器缓存（真事故，已修）

`assert_freshness_recovery_contract.mjs` 从来没进过任何自动门禁（它要一个 base-url 参数，`ship.mjs` 的 LIVE 组只跑另外两个），这次手动跑才发现：**9/3 加的 `EDGE_CACHE` 让 `/api/v1/` 下的新鲜度接口带上了 `public`，于是被 Cloudflare 区域级的 Browser Cache TTL（默认 4 小时）改写成 `max-age=14400`**——读者的浏览器可以拿着 4 小时前的"数据新鲜度"面板，而面板正是用来回答"数据有多新"的。

两个原因让它藏了一天：① `curl -I`（HEAD）走的是 `ttl 0` 分支，头看着永远是 `no-store`，只有 GET 才复现；② `ship.mjs` 的生产核验每个 URL 都带 nonce 绕开缓存，测的是部署本身，永远看不到普通读者拿到什么。`/api/summary`、`/api/analytics` 没中招，因为它们不在 `/api/v1/` 下、压根不匹配缓存规则。

处置：`EDGE_CACHE` 增加一条最优先的 `ttl: 0` 规则，覆盖 data-health / self-audit / ecosystem-health / official-assets-health / community-processor-health / airdrop-overview / daily-activity / bem-price / bem-holders（原先那条"健康类 15 秒"规则被完全遮蔽，已删）；目录类接口（tools/updates/glossary 等）保留 60 秒边缘缓存不变，实测仍是 `max-age=60` 没被改写。**并且把这个契约加进 `ship.mjs` 的生产核验步骤**（用真实 URL、不带 nonce），这才是根因修复——契约早就写好了，只是没人跑。实测修复后九个新鲜度接口全部 `no-store`，契约通过。

## 2026-09-04 收尾四项

- **Smart Placement 不生效**：上线超过 26 小时后 `/api/v1/data-health` 的 `cf-placement` 仍是 `local-SIN`（首页命中边缘缓存不带这个头，探测要打无缓存的 API 路径）。站点当前流量级别下 Cloudflare 判定就近边缘已经最优，不会切换，**结论到此为止，不再周期性复查**。
- **持币普查加了新鲜度字段**：`bem_holders.js` 的 `census_status` 原来只看最近一次同步是否报错，现在同时看检查点 `updated_at` 的年龄——超过 90 分钟没推进即使没有报错也标 `stale`，`coverage.checkpoint_age_minutes` 一并暴露。原因：bloXroute 从 Workers 出口大约四轮成功一轮，静默卡住和显式报错对读者同样有误导性；`ok` 状态失守时前端会自动回退到 `third_party` 卡片。
- **白皮书从"跳过"改成真正的漂移哈希**：`official-whitepaper` 之前因为是 PDF（非 HTML）在 `self_audit.js` 里直接记 `skipped`，现在按 `content-type: application/pdf` 单独走一条路径，对响应字节做 SHA-256（超过 5MB 才退化为用 ETag/Content-Length 拼字符串），并把这个摘要写进学习资源路径实际读取的 `surface_fingerprint` 字段（首版误把它塞进了永远不被读取的 `asset_fingerprint`，当天验证时发现并改正）。官网悄悄换白皮书能被捕捉到。
- **`translate_catalog.mjs` 加了瞬时失败自动重试**：过去四批批处理里三批（tr "no verification verdict"、es/ja 各三条 "locale run failed"）靠人工 `--locales X` 重跑才过，重跑无一失败。现在 `translateStale` 在整批跑完后，把"整轮模型调用失败"或"验证器没有给出裁决"这两类失败（绝不包括真正的内容裁决失败，比如否定语气丢失、多加了断言）单独重跑一次，减少人工介入。
- 顺手把 `community-93bitmap-video-ep10-bitmap-nat` 的分类标签从 `logic` 改成 `basics`（讲的是位图/AI 主权推测，不是逻辑门基础），字段不参与哈希，不需要重译。
