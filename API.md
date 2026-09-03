# Tapeout Public Research API

## Base URL

```text
https://tapeout.work
```

(The prior `https://tapeout-public-monitor.tapeout-labs.workers.dev` entrypoint remains live and serves identical content.)

The service is public and read-only. Protocol-level Registry totals use the TapeOut **Day 1 zero baseline** (the public Saturday-night / Sunday-morning launch window in Asia/Shanghai), rather than the later date when this monitor began recording D1 snapshots. It checks TapeOut’s public Processor registry every five minutes, records D1 snapshots only when the Registry content changes, and retains the latest verified snapshot if an optional source is delayed. D1 continuous history begins on 2026-08-19 and is explicitly a monitor-observation boundary, not the protocol statistical start. All public Processor endpoints are populated **after** server-side structural validation and exclusion of protected records.

## Discovery

| Endpoint | Use |
| --- | --- |
| `/api/v1/catalog` | Compact machine-readable endpoint catalog, source, cadence and `protocol_time_basis`. |
| `/api/v1/openapi.json` | Lightweight OpenAPI 3.1 description for Agent tooling. |
| `/api/v1/source-status` | Source URLs, cadence, event-trust boundary and market provider configuration state. |
| `/api/v1/data-health` | Registry, public Airdrop-contract and optional market-source freshness; last run and explicit degradation status. |

## Core data

| Endpoint | Use |
| --- | --- |
| `/api/v1/summary` | Latest global public snapshot. |
| `/api/v1/analytics` | Completion/circuit distributions, website-label and completion cross-sections, Processor scatter data, all-public-Registry protocol scope, public Airdrop summary, latest Registry pulse, D1 snapshot history, and `protocol_time_basis`. The history is a monitor series; the current protocol totals use the Day 1 zero baseline. |
| `/api/v1/daily-activity` | 默认返回**过去 7 天、按北京时间自然日**聚合的真实公开 Registry 观察序列；可选择 1 天、7 天、30 天或全部已观察历史，以及小时/日粒度和北京时间/UTC 日界线。响应披露实际 D1 覆盖期、首个部分桶与新增/累计指标；监控覆盖前不会补零。 |
| `/api/v1/protocol-pulse` | Current UTC-day aggregate of **all publicly listed TapeOut Processors after server-side privacy filtering**, including website-labelled and unlabelled public records. It is not a complete on-chain transaction count. |
| `/api/v1/airdrop-overview` | Cached, independently health-checked summary from the public TapeOut Airdrop contract: total/active/cancelled pools, remaining transistor units, observed claims and current items. `checked_at` is the latest successful contract read; `observed_at` is the last content-changing snapshot. |
| `/api/v1/market-overview` | Confirmed Circuit Market `Sold` logs, bounded by disclosed scan coverage. `coverage.through_block` is the last scanned block and `coverage.gaps` lists block ranges that were never scanned (the public log provider serves recent windows only, so a stale checkpoint is skipped rather than replayed); counts are "since coverage", never all-time. |
| `/api/v1/processors` | Paginated full public Processor registry. |
| `/api/v1/creators` | Current public Creator concentration aggregates. |
| `/api/v1/attestations` | Tapeout 官网公开展示的项目标签及其证据链接；只返回已经通过隐私过滤的 Processor。 |
| `/api/v1/export.csv` | CSV export of a filtered current public Processor view. |
| `/api/v1/learn/resources` | Governed public TapeOut learning-resource catalog, with source tier, stage, language, pagination and dual-language copy. |
| `/api/v1/ecosystem/health` | Read-only reachability of every catalogued tool, refreshed on the five-minute schedule. |
| `/api/v1/self-audit` | 本站对自身目录的自审：已收录工具页面与更新/教程背后来源的指纹漂移（审核日期之后发生变化的进 `review_queue`，带 `kind`），目录不变量检查（`findings`），以及以实测数字公布的覆盖率（`coverage`，各桶加总必等于总数）。"不在队列"不等于已认证，响应内写明限制。 |
| `/api/v1/changelog` | 目录种子与语种文件的公开变更记录，构建时从本仓库 git 历史生成。 |

## Learning resources

`/api/v1/learn/resources` is a curated public index used by the newcomer learning center. It does **not** scrape or endorse arbitrary posts in real time. Every item is reviewed and labeled `official`, `community`, or `reference`; community explanations do not inherit official status, and concept references are not TapeOut operating instructions. Material that promises returns, routes users through private messages, asks for sensitive wallet material, or makes unverifiable claims is excluded.

Supported filters are `q`, `tier` (`official`, `community`, `reference`), `stage` (`basics`, `canvas`, `tapeout`, `pod`, `safety`, `logic`), `language` (`zh`, `en`), `page`, and `page_size` (maximum 24). The response returns `reviewed_at` and a fixed `catalog_version`, not fabricated freshness.

```bash
# Official Proof of Design reading path
curl 'https://tapeout.work/api/v1/learn/resources?tier=official&stage=pod'
```

> The learning center explains mechanism, steps, observable conditions and risk boundaries. It does not promise a return, recommend a trade, or treat market quotes, creator minting or Proof of Design output as guaranteed income.

## $BEM · Proof of Design

| Endpoint | Use |
| --- | --- |
| `/api/v1/bem/overview` | $BEM 全网挖矿快照：当前速率、按当前速率推算的日产出、在挖 / 已验证矿机、权重、累计已铸、永久放弃、上链题数与最近公开流片事件。 |
| `/api/v1/bem/price` | BSC 上 BEM 为 base token 的最高正流动性交易对之第三方聚合行情；返回美元价格、流动性、24 小时成交额、涨跌、买卖笔数和池链接。 |
| `/api/v1/bem/tasks` | 官网公开题库的服务端分页与筛选。默认每页 10 条，支持 `page`、`page_size`（最大 50）、`q`、`tier`、`kind`、`onchain`、`group`。 |
| `/api/v1/bem/algorithm` | 官网公开的 Proof of Design 规则、公式、题库元数据及其展示边界。 |
| `/api/v1/bem/holders` | 持币地址数，两条口径并列：`third_party`（GeckoTerminal 公开代币信息接口的持币人数与前十大分布，第三方口径，5 分钟一存）与链上 `Transfer` 全量普查（`holder_count`，需归档节点；`coverage` 给出普查区块范围，`census_status` 未到 `ok` 前是下界）。`status` 在普查健康时为 `ok`，否则持有第三方值时为 `third_party`；`reconciliation` 给出两者之差。 |
| `/api/v1/bem/leaderboard` | 由官网公开矿机索引独立计算的钱包/题目电路计数排行与矿池权重增长序列；按电路数排名，不是协议的 H 权重公式，不表述为 BEM/日。 |
| `/api/v1/bem/trending` | 过去 24 小时电路数增长最快的题目与钱包，仅由本站自身的排行快照差分得出；没有可比 24 小时前快照的条目不显示。 |
| `/api/v1/bem/trades` | 跨 BSC 上主要 BEM 池聚合的大额成交与买卖流向（GeckoTerminal 公开成交流），`coverage` 披露每个被跟踪池的份额与新鲜度；大额阈值取存储窗口的第 95 百分位。 |

矿池端点优先读取 TapeOut 公开的 [`pod-stats.json`](https://tapeout.net/pod/pod-stats.json)；只有其在采集时超过官网前端使用的 180 秒新鲜度阈值或读取失败时，才通过 TapeOut 根域名公开 RPC `https://tapeout.net/rpc` 对 PodMining 做受限批量只读回退。`/api/v1/data-health` 单列 `bem.mining`、`bem.taskbank`、`bem.miner_index` 和 `bem.price`。任何失败都会保留最后成功快照并显示 `stale`、`pending` 或 `error`，绝不伪造零值或“实时”。

> `$BEM` 价格来自 DexScreener 的第三方聚合，不是 TapeOut 官方价格，也不是投资建议。系统先在 BEM token 聚合响应中选择 **BEM 为 base token、正流动性最高**的 BSC 交易对；若该端点暂时被限流，则先读取已经验证的 PancakeSwap BEM/USDT V3 交易对 `0x2f5ec19ab0583D3FCd9bcbcD9AB416d2858EeA38`；若该直接端点同样不可用，才读取同一已验证池的 GeckoTerminal 第三方聚合响应。接口会披露实际使用的端点、提供者、是否触发回退、池地址、流动性和风险提示；早期流动性可能较浅，价格可能剧烈波动。

> 算法端点仅解释官网已公开的规则：`b* = n + λ·m`、`A = g + λ·s`、`C = A · max(d,1)^β`、`q = clamp(C_ref / C, 1/Q, Q)` 与 `H = (b* + K_task·q) × P`。它不对未公开验证的 `λ`、`β`、`Q` 数值作断言，也不生成收益预测。

### $BEM 题库查询示例

```bash
curl 'https://tapeout.work/api/v1/bem/tasks?page=1&page_size=10&kind=seq&onchain=true'
```

### 多周期协议活动查询示例

```bash
# 默认：过去 7 天，按北京时间自然日
curl 'https://tapeout.work/api/v1/daily-activity'

# 近 24 小时，按小时桶
curl 'https://tapeout.work/api/v1/daily-activity?range=1d&granularity=hour&timezone=Asia%2FShanghai'

# 全部已观察历史，按 UTC 自然日
curl 'https://tapeout.work/api/v1/daily-activity?range=all&granularity=day&timezone=UTC'
```

`range` 支持 `1d`、`7d`、`30d`、`all`；`granularity` 支持 `hour`、`day`；`timezone` 支持 `Asia/Shanghai`、`UTC`。每个 bucket 含有 `new_processors`、`minting_processors`、`circuit_delta`、`active_creators` 和原始 `mint_delta`，以及由已验证 Registry 快照提供的 `processor_total`、`circuit_total`。`mint_delta` 是来源原始单位，不是交易额、收入、估值或市场规模。

> `coverage_start`、`coverage_end`、`coverage_days` 与 `partial_first_bucket` 是响应的一部分。它们描述 D1 的真实连续监控覆盖，而不是协议 Day 1 的统计起点；首个部分日/小时桶会明确标记，D1 开始前没有“零活动”桶。

### Processor query example

```bash
curl 'https://tapeout.work/api/v1/processors?page=1&page_size=50&completion=75%E2%80%9399%25&min_circuits=3&sort=circuits'
```

Supported filters are `q`, `creator`, `completion`, `min_circuits`, `min_minted`, `min_supply`, `sort`, `page`, and `page_size`. The response includes a deterministic `official_url` for each public Processor, following Tapeout’s official `#p/{address}` route.

## Evidence event stream

```bash
curl 'https://tapeout.work/api/v1/events?type=processor.circuit_delta&page_size=25'
```

Each event contains `event_type`, `observed_at`, Processor/Creator addresses, evidence URL, observed metric and source-derived details. Events are cursor-paginated: call with `page_size` (1–100) and pass the returned `next_cursor` as `cursor` to fetch the next page. The response also includes `has_more`. Current automatic event classes are:

| Type | Meaning |
| --- | --- |
| `processor.created` | A valid new public Processor appeared between registry snapshots. |
| `processor.mint_delta` | The observed Mint amount increased. |
| `processor.circuit_delta` | The observed Circuit count increased. |
| `processor.completed` | Mint completion first reached declared supply. |
| `attestation.website_label` | A project label explicitly displayed by the public Tapeout website, linked to that website as evidence. |
| `market.circuit_sold_large` | A confirmed Circuit Market `Sold` event whose `paidToSeller + fee` is at least 0.5 BNB, linked to its BscScan transaction. |

> `trust: "protocol_observed"` means the event was derived from a public Tapeout registry observation and links to Tapeout’s official Processor page. It is **not** an official project endorsement, a community certification, a market signal, or investment advice.

> `trust: "official_site_label"` means the public Tapeout website currently displays the associated label. The API preserves the website’s `official`, `certified`, or `community` wording and evidence URL; it does not infer labels from wallet ownership, activity, trading, or third-party claims.

> `trust: "chain_observed"` means a confirmed public BNB Chain log decoded against a stated Tapeout market ABI. Market coverage is incremental and its terminal block is returned by `/api/v1/market-overview`; do not interpret it as all-time or daily market activity outside that explicit scanned range.

> The core Registry path does not depend on chain RPC: it checks TapeOut’s public `processors.json` every five minutes and writes D1 only on content change. The public Airdrop path uses the TapeOut website’s disclosed Airdrop contract and `getDrops(uint256,uint256)` read method; it is separately cache-backed and health-checked. For unchanged contract reads, health freshness follows the latest successful `checked_at`, while `observed_at` remains the last data-changing snapshot. The $BEM mining, taskbank/miner-index and price paths are likewise independent of the Registry and one another. The market path is deliberately disabled unless the Cloudflare Worker Secret `BSC_LOGS_RPC_URL` contains a dedicated, quota-backed BSC provider URL. `/api/v1/data-health` exposes `healthy`, `stale`, `not_configured`, `pending`, `error`, or `unavailable` instead of silently treating a provider failure as zero activity.

## Strategy schema

`/api/v1/strategies/schema` exposes the rule fields supported by the visual strategy composer. Strategies are browser-local or URL-fragment configurations. They never execute transactions, submit orders, or request a wallet connection.

## Numeric handling

Mint, supply and BNB wei values are serialized as decimal strings. Consumers should parse them using arbitrary-precision integer types rather than JavaScript `Number`. The public registry can contain unusually large integers; this API returns those as source observations and does not treat them as prices, volume, valuation, or financial advice.
