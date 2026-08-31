# $BEM Proof of Design 数据域规范

> 目标：在不依赖钱包、不执行链上写操作的前提下，为 TapeOut Intelligence 提供可验证、独立健康检查、可降级的 $BEM 挖矿、价格、题库与算法数据域。

## 1. 数据来源与信任边界

| 数据域 | 首选来源 | 回退来源 | 更新频率 | 对外标记 |
| --- | --- | --- | --- | --- |
| 矿池全网状态 | `https://tapeout.net/pod/pod-stats.json` | `https://tapeout.net/rpc` 对 PodMining 的只读批量 `eth_call` | 每 5 分钟 | `official_public_snapshot`；回退时 `official_public_rpc` |
| 题库、题目字段 | `https://tapeout.net/pod/pod-taskbank.json` | 无；保留最后成功 D1 快照 | 每 5 分钟检查，哈希未变不写入 | `official_static_catalog` |
| 矿工索引 | `https://tapeout.net/pod/pod-miners.json` | 无；保留最后成功 D1 快照 | 每 5 分钟检查，哈希未变不写入 | `official_static_index` |
| 算法说明 | 已核验的官网公开规则、`pod-mainnet.json` 和题库字段 | 无 | 静态版本化 | `official_public_rules` |
| 价格与流动性 | DexScreener token endpoint，限 BSC、BEM 为 base token | DexScreener 已验证 PancakeSwap BEM/USDT V3 pair endpoint；若两者均限流，则使用同一已验证池的 GeckoTerminal 聚合响应；再失败时保留最后成功 D1 快照 | 每 5 分钟 | `third_party_aggregated_market_data` |

矿池采集器、题库采集器和价格采集器彼此独立；其错误不得导致 Registry、空投或可选市场同步失败。任何失败均不得转换为 `0`、空列表或“实时”。

## 2. 指标归属与单位

矿池快照必须只接受下列字段：`block`、`blockTime`、`totalVerifWeight`、`totalUnverWeight`、`currentRate`、`minerCount`、`verifMinerCount`、`unverifiedBps`、`totalForgone`、`totalMined`、`taskCount`、`startTime`、`ownerHeadStart`、`tasksFrozen` 和官网事件摘要。整数大于 JavaScript 安全整数的字段必须以十进制字符串存储与返回。

`currentRate` 以 BEM 的最小单位 / 秒记录；在前端显示为 BEM 时，采用官方网页相同的 8 位小数转换。`daily_emission` 是派生值 `currentRate × 86,400`，并明确标为“按当前速率推算”，不是承诺收益。已验证比例使用 `100 - unverifiedBps / 100`；验证权重比例在双方权重均可用时单独计算。矿工索引的 `count` 与 `minerCount` 不是同一概念，必须分别标示为“官网维护索引记录数”和“链上在挖矿机数”。

## 3. D1 表与写入规则

```sql
CREATE TABLE IF NOT EXISTS bem_mining_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  observed_at TEXT NOT NULL,
  source_generated_at TEXT,
  source_hash TEXT NOT NULL,
  provider TEXT NOT NULL,
  block_number INTEGER,
  raw_json TEXT NOT NULL,
  total_verif_weight TEXT,
  total_unver_weight TEXT,
  current_rate TEXT,
  miner_count INTEGER,
  verif_miner_count INTEGER,
  unverified_bps INTEGER,
  total_forgone TEXT,
  total_mined TEXT,
  task_count INTEGER,
  tasks_frozen INTEGER
);
CREATE INDEX IF NOT EXISTS bem_mining_snapshots_observed_idx ON bem_mining_snapshots(observed_at DESC);

CREATE TABLE IF NOT EXISTS bem_mining_sync_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attempted_at TEXT NOT NULL,
  status TEXT NOT NULL,
  provider TEXT,
  source_generated_at TEXT,
  source_hash TEXT,
  error TEXT
);
CREATE INDEX IF NOT EXISTS bem_mining_sync_runs_attempted_idx ON bem_mining_sync_runs(attempted_at DESC);

CREATE TABLE IF NOT EXISTS bem_catalog_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  observed_at TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  task_count INTEGER NOT NULL,
  raw_taskbank_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS bem_catalog_snapshots_observed_idx ON bem_catalog_snapshots(observed_at DESC);

CREATE TABLE IF NOT EXISTS bem_miner_index_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  observed_at TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  source_generated_at TEXT,
  block_number INTEGER,
  miner_index_count INTEGER NOT NULL,
  owner_count INTEGER NOT NULL,
  cpu_counts_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS bem_miner_index_snapshots_observed_idx ON bem_miner_index_snapshots(observed_at DESC);

CREATE TABLE IF NOT EXISTS bem_catalog_sync_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attempted_at TEXT NOT NULL,
  status TEXT NOT NULL,
  taskbank_hash TEXT,
  miners_hash TEXT,
  error TEXT
);
CREATE INDEX IF NOT EXISTS bem_catalog_sync_runs_attempted_idx ON bem_catalog_sync_runs(attempted_at DESC);

CREATE TABLE IF NOT EXISTS bem_price_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  observed_at TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  provider TEXT NOT NULL,
  pair_address TEXT NOT NULL,
  raw_json TEXT NOT NULL,
  price_usd TEXT,
  quote_symbol TEXT,
  liquidity_usd REAL,
  volume_h24 REAL,
  price_change_h24 REAL,
  buys_h24 INTEGER,
  sells_h24 INTEGER
);
CREATE INDEX IF NOT EXISTS bem_price_snapshots_observed_idx ON bem_price_snapshots(observed_at DESC);

CREATE TABLE IF NOT EXISTS bem_price_sync_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attempted_at TEXT NOT NULL,
  status TEXT NOT NULL,
  provider TEXT,
  pair_address TEXT,
  error TEXT
);
CREATE INDEX IF NOT EXISTS bem_price_sync_runs_attempted_idx ON bem_price_sync_runs(attempted_at DESC);
```

所有快照仅在内容指纹变化时写入。同步运行记录可以在每次执行中写入一行，以便区分“最近检查”与“最近数据变化”。题库与矿工索引分别按各自内容指纹存储，避免官网矿工索引的高频变动重复写入静态题库。矿工索引仅保留公开聚合摘要（索引记录数、钱包数、CPU 分布、来源时间与区块），不在 D1 保存或对外输出钱包到电路的完整映射。

## 4. 健康与陈旧阈值

| 域 | `healthy` | `stale` | `error` / `pending` |
| --- | --- | --- | --- |
| `bem_mining` | 首选快照或 RPC 在 12 分钟内成功 | 最近成功快照存在，但最近运行失败或超过 12 分钟 | 从未成功且本轮失败 / 从未成功且未运行 |
| `bem_taskbank` | 题库快照在 24 小时内成功 | 有最后成功题库，但超过 24 小时或最新运行失败 | 无题库快照 |
| `bem_miner_index` | 矿工索引聚合快照在 12 分钟内成功 | 有最后成功聚合，但最近运行失败或超过 12 分钟 | 无索引聚合快照 |
| `bem_price` | 第三方市场快照在 12 分钟内成功，且选中对的 BEM 是 base token、流动性为正 | 有最后成功价格，但最近运行失败或超过 12 分钟 | 无最后成功价格；不会返回 `$0` |

`/api/v1/data-health` 必须单列以上三项，并保留 `provider`、`observed_at`、`last_run`、`age_minutes`、`freshness_policy` 与可读的 `note`。价格健康状态不代表链上定价、官方价格或任何投资建议。

## 5. API 契约

| 端点 | 作用 | 关键响应字段 |
| --- | --- | --- |
| `/api/v1/bem/overview` | 矿池全网快照和链上回退信息 | `status`、`observed_at`、`provider`、`metrics`、`derived`、`contracts`、`recent_events`、`source` |
| `/api/v1/bem/price` | 第三方聚合行情 | `status`、`observed_at`、`provider`、`pair`、`price_usd`、`liquidity_usd`、`volume_h24`、`price_change_h24`、`warning` |
| `/api/v1/bem/tasks` | 题库的服务端分页与筛选 | `status`、`observed_at`、`pagination`、`filters`、`meta`、`items`；默认和最大 `page_size` 为 10 / 50 |
| `/api/v1/bem/algorithm` | 静态公开规则说明 | `source_type`、`formulae`、`terms`、`boundaries`、`source_urls`、`taskbank_meta` |

`/api/v1/bem/tasks` 支持 `page`、`page_size`、`q`、`tier`、`kind`、`onchain`、`group`；严格校验并返回稳定排序的结果。每个任务只返回公开字段：`id`、`name`、`tier`、`group`、`kind`、`nIn`、`nOut`、`cycles`、`refGates`、`refNand`、`refLatch`、`refDepth`、`K`、`area`、`Cref`、`runGas`、`onchain`、`trivial`。

## 6. 失败处理

多数外部抓取使用 8 秒 `AbortController` 超时；约 0.5 MB 的官网矿工索引使用隔离 15 秒上限。矿池首选源失败后，最多一次根 RPC 批量回退；回退失败后写入错误运行记录，返回最后成功快照。价格源不调用 BSC RPC：先请求 token 聚合端点，限流或失败时只请求已验证的 PancakeSwap BEM/USDT V3 pair `0x2f5ec19ab0583D3FCd9bcbcD9AB416d2858EeA38`，再失败才保留最后成功第三方快照。`/api/v1/bem/price` 的 `source.endpoint` 和 `source.fallback_used` 披露实际路径。任何未知数据均为 `null` 并配合健康状态、而非伪造为零。

新采集器必须通过 `Promise.allSettled` 与 Registry、空投和市场任务隔离，避免一个来源 502 影响其他数据域。接口响应缓存 5 分钟，D1 快照保存的是最后成功数据，采集 cadence 为 5 分钟。

## 7. 展示边界

界面将矿池读数标示为“官网公开快照 / 官方根 RPC 只读回退”，将题库和算法标示为“官网公开规则”，将价格标示为“第三方聚合行情”。价格卡固定显示“流动性浅、波动极大；非投资建议”，并显示所选 PancakeSwap 池与聚合页外链。算法区只解释已经公开的公式，不展示挖矿收益预测、价格目标或隐含参数数值。
