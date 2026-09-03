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
