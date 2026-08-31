# TapeOut 数据稳定性规范

> 目标是让核心 Dashboard 数据在任一补充源失效时仍可用；任何未成功验证的市场数据不得以零值或“实时”名义展示。

## 数据源分层

| 层级 | 数据 | 正式来源 | 调度 | 失败处理 | 展示状态 |
| --- | --- | --- | --- | --- | --- |
| Tier 0 | 处理器、已铸晶体管、电路、创建者、官网标签 | TapeOut `processors.json` 与 TapeOut 官网 | Cloudflare Cron 每小时 UTC 第 15 分钟 | 保留最后成功 D1 快照；不覆盖 | 正式数据 |
| Tier 1 | 日度新增处理器、已铸增量、电路增量、观察到的创建者 | Tier 0 快照差分写入 D1 事件账本 | 与 Tier 0 同步 | 使用最后成功聚合 | 正式数据 |
| Tier 2 | Circuit Market `Sold`、成交额、≥0.5 BNB 广播 | **配额化 BSC 索引/RPC URL**，优先 Alchemy BSC 或 Bitquery 合约事件 API | 独立于 Tier 0；仅在健康检查通过后采集 | 不写零值；保留最后成功市场快照，并标记 `stale` 或 `not_configured` | 试验数据，健康后才显示为正式 |
| Tier 3 | 创建者钱包标签、持仓、交易、PnL | 有凭据的 GMGN / 索引服务 | 独立计划任务 | 不做钱包身份推断；显示来源与更新时间 | 仅在 API Key 和字段验证后启用 |

## 禁止使用的生产路径

BNB Chain 官方文档明确说明其列出的主网公共端点禁用 `eth_getLogs`；因此它们不能作为 Circuit Market 事件采集的生产数据源。[1]

未授权的公共第三方 RPC 也不能作为生产承诺：它们没有对本项目的配额、SLA 或错误恢复保证。它们最多用于本地 ABI 验证，不可用于对外承诺的市场统计。

## Tier 2 的生产接入契约

1. 在 Cloudflare Worker Secret 中设置 `BSC_LOGS_RPC_URL` 或 `BSC_INDEXER_URL`，禁止把密钥提交至 Git。
2. 每次计划任务先进行轻量健康检查（最新区块或供应商 health endpoint），记录 `last_checked_at`、延迟、状态码和错误摘要。
3. 市场采集使用确认区块、单调 checkpoint、幂等交易 ID 和重试退避；每轮只推进一个有上限的区块窗口。
4. 连续失败三次时停止推进 checkpoint，读取最后成功的 D1 市场快照，并把 API 状态标为 `stale`；不把失败替换成 0。
5. `/api/v1/data-health` 对外返回各层的最后成功时间、状态、数据源和降级原因；前端显式展示“数据延迟”或“未配置”，而不是静默空白。

## $BEM Proof of Design 数据域

$BEM 采用与 Registry、空投和市场相互隔离的三条采集路径。完整表结构、响应字段和展示边界见 [`BEM_DATA_DOMAIN_SPEC.md`](./BEM_DATA_DOMAIN_SPEC.md)。

| 子域 | 首选来源 | 回退路径 | 检查与持久化 | 对外语义 |
| --- | --- | --- | --- | --- |
| `bem_mining` | TapeOut `https://tapeout.net/pod/pod-stats.json` | TapeOut `https://tapeout.net/rpc` 对 PodMining 的受限批量 `eth_call` | 每 5 分钟；内容指纹未变化不写快照；保留最后成功快照 | 官网公开快照或官网根 RPC 只读回退 |
| `bem_taskbank` | TapeOut `pod-taskbank.json` | 无 | 每 5 分钟检查；静态题库按自身哈希去重 | 官网公开静态题库 |
| `bem_miner_index` | TapeOut `pod-miners.json` | 无 | 每 5 分钟检查；仅持久化哈希去重的公开聚合摘要 | 官网维护的矿工索引聚合 |
| `bem_price` | DexScreener BSC token endpoint | DexScreener 已验证 PancakeSwap BEM/USDT V3 pair endpoint；若两者均限流，再读取同一已验证池的 GeckoTerminal 聚合响应；再失败时仅保留最后成功第三方快照 | 每 5 分钟；首选 BEM 为 base token 的最高流动性正值交易对，限流时依序读取固定已验证对 | 第三方聚合行情，不是官方价格 |

矿池首选快照在官网自己的前端中以 180 秒新鲜度作为直接使用阈值；本系统在 5 分钟周期内采集后以 12 分钟作为公开健康阈值。首选快照失败时，只允许一次根 RPC 批量只读回退；失败后必须保留最后成功数据并标为 `stale`，绝不替换为零。公开根 RPC 的实际路径是 `https://tapeout.net/rpc`，不是 `/pod/rpc`。价格源的固定回退仅使用已验证的 BEM/USDT V3 pair `0x2f5ec19ab0583D3FCd9bcbcD9AB416d2858EeA38`：先用 DexScreener pair endpoint，若该端点也被限流，才以 GeckoTerminal 的同一池响应为末级聚合回退；API 在 `source.fallback_used`、`source.endpoint` 和 `provider` 中披露实际来源。它不是对“官方价格”的断言。

对 `$BEM` 价格，必须展示所选池地址、报价资产、聚合来源、流动性、24 小时成交额和价格变动；同时固定披露“流动性浅、波动极大、第三方聚合行情、非投资建议”。若没有合格的正流动性交易对，端点返回 `pending` / `error`，前端不显示 `$0` 或“官方价格”。

## 推荐供应商

Alchemy 已公开 BNB Smart Chain 的带 API Key JSON-RPC 端点文档，适合以专属 key 替代匿名公共节点。[2] Bitquery 提供 BNB 合约事件、NFT 交易、实时和历史查询的索引数据接口，适合后续把成交、钱包、NFT 与聚合分析放到一个数据层，但需要商业化用量计划。[3]

对于本项目，建议先使用 **Alchemy BSC 专属 RPC** 做 Circuit Market 单合约 `Sold` 增量日志；当需要 NFT 市场全量、钱包历史、地址标签和更丰富聚合时，再接入 **Bitquery**。两者都必须由项目账户提供可轮换的生产密钥，随后配置到 Cloudflare Secret。

## 参考

[1] [BNB Chain JSON-RPC endpoints](https://docs.bnbchain.org/bnb-smart-chain/developers/json_rpc/json-rpc-endpoint/)

[2] [Alchemy BNB Smart Chain Quickstart](https://www.alchemy.com/docs/reference/bnb-smart-chain-api-quickstart)

[3] [Bitquery BNB API](https://bitquery.io/blockchains/bnb-blockchain-api)

## 2026-08-19：五分钟刷新评估

Cloudflare Cron 支持 `*/5 * * * *`，并以 UTC 执行；变更传播可能需要最多约 15 分钟。[4] 现有每小时第 15 分钟刷新会让看板的**最近数据变化时间**自然停留在整点窗口，例如北京时间 21:15；这不代表上游 Registry 没有更新，而是当前计划任务尚未再次检查。

将刷新改为五分钟会把计划任务从约 720 次/月提升为约 8,640 次/月，即增加 12 倍。不过 Workers 的请求与 CPU、D1 的行读写分别计量；Cron 没有独立计费项。[5] [6] 由于当前约 578 条处理器记录，若每轮无差别全量写入，每五分钟约产生 333,216 行最低写入/日，超过 Workers Free 的 D1 每日 100,000 行写入额度。因此五分钟模式必须采用“每五分钟检查、仅在 Registry 内容指纹变化时写入”的差分机制。

在 2026-08-19 的本地验证中，首次兼容写入后第二次相同内容检查返回 `no_change`，未再写入处理器快照或事件账本。数据健康 API 将分别公开 `last_checked_at` 和 `last_data_change_at`，防止用户把“最后一次变更”误读为“最后一次检查”。

[4] [Cloudflare Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)

[5] [Cloudflare Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/)

[6] [Cloudflare D1 Pricing](https://developers.cloudflare.com/d1/platform/pricing/)

### 实施后的资源模型

已部署版本不再在每次内容变化时重写全部处理器。每五分钟仅拉取一次公开 Registry、计算内容指纹，并在无变化时只记录一行 `refresh_runs` 检查审计；若 Registry 有变化，才写入一条全局快照、变动的处理器行、对应的处理器快照和证据事件。未配置专属市场 RPC 时，市场采集器不产生五分钟审计写入。

因此五分钟模式的核心固定增量约为 8,640 次检查/月（288 次/日），而不是按约 578 个处理器将全表写入 8,640 次。与旧的每小时 720 次/月相比，额外约 7,920 次 Worker 调用和最多同数量级的刷新审计写入；真实处理器写入量由上游 Registry 的实际变动决定。Workers Paid 每月包含 1,000 万请求与 3,000 万 CPU 毫秒；D1 Paid 每月包含 5,000 万行写入。Free 计划虽有 10 万 Worker 请求/日与 10 万 D1 行写入/日，但 Cron 的单次 CPU 限制仅 10ms，因此若把“绝不宕机”作为目标，应使用带监控与配额余量的 Paid 配置。[5] [6] [7]

[7] [Cloudflare Workers Limits](https://developers.cloudflare.com/workers/platform/limits/)
