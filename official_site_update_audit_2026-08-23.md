# TapeOut 官网公开数据源更新审计（2026-08-23）

## 已核验变化

| 数据域 | 当前官网公开证据 | 与上一生产快照的关系 | 结论 |
| --- | --- | --- | --- |
| Registry | `processors.json` 的 `generatedAt` 为 `2026-08-23T11:08:59.827Z`、`count` 为 715。首页同样显示 715 个 Processor。 | 先前公开看板观测到 711 个 Processor；Registry 的 5 分钟差分采集器应自动吸收新增/更新条目。 | 不需新数据源；核验生产刷新即可。 |
| 官网标签 | 首页当前公开列出 Official、Certified、Community 项目；抽查的示例处理器仍被官网公开标为 Certified。 | 仍符合既有“仅在官网可见证据时展示标签”的治理规则。 | 不改变标签推断规则。 |
| $BEM 全网快照 | `pod-stats.json` 当前公开 `block` 117605448、`minerCount` 4262、`verifMinerCount` 3824、`totalVerifWeight` 724940、`totalUnverWeight` 23670、`totalMined` 1103715828458、`taskCount` 267。 | 现有 $BEM 采集器已从同一路径采集这些指标；数值变化应在 5 分钟任务中自动更新。 | 不需替换首选源。 |
| $BEM 最近流片事件 | 同一 `pod-stats.json` 的 `events` 为公开数组，事件字段包含 `block`、`cpu`、`circuits`、`circuitId`、`author`、`gates`、`nState`。 | 现有数据库保存整个官方矿池原始快照，但 Dashboard 尚未将这部分精简为独立公开的“最近流片”流。 | 可作为新的、官网直接提供的事件维度候选；只展示现有公开字段，不做身份标签或钱包推断。 |
| $BEM 矿工索引 | `pod-miners.json` 当前 `count` 为 649，带完整 owner 到电路映射。 | 隐私治理仍要求公开看板只保留并展示聚合摘要，不能暴露全量 owner 映射。 | 不新增钱包级公开 API。 |
| 题库 | `pod-taskbank.json` 仍为 306 道题、267 道上链、222 组合题、84 时序题；新增/现有 `meta` 还公开总 NAND/LATCH、onchain NAND/LATCH、总门数、最大运行 Gas、trivial 与 offchain 原因。 | 当前 Dashboard 已展示基本题库元数据和行级题目字段，未展示题库的工程汇总与不可上链说明。 | 可安全补充“题库工程概览”指标与‘不可上链原因’提示，不影响既有分页。 |
| 主网配置 | `pod-mainnet.json` 的 mining、lens、token、factory、CPU multipliers 与先前接入一致。 | 没有观察到需切换的合约或链。 | 保持现有合约来源。 |

## 建议的下一步实现

1. 将 `pod-stats.json.events` 按公开原字段折叠为最近流片事件流：仅显示 CPU、Circuit ID、门数、状态位、区块与截短地址；不得标注创始人、鲸鱼或钱包身份。
2. 在题库面板补充工程元数据：`totalNand`、`totalLatch`、`onchainNand`、`onchainLatch`、`onchainGates` 与 `maxRunGas`，并在题目详情/列表中将官网 `trivial` 或 `offchain` 原因作为公开限制提示。
3. 在生产健康端点检查 Registry 与 $BEM 快照已追随官网的 715 Processor 和最新 block；若尚未追上，只报告 `stale`，不手工覆盖数据。

## 公开来源

- https://tapeout.net/
- https://tapeout.net/processors.json
- https://tapeout.net/pod/pod-stats.json
- https://tapeout.net/pod/pod-miners.json
- https://tapeout.net/pod/pod-taskbank.json
- https://tapeout.net/pod/pod-mainnet.json

## 生产健康异常（需优先修复）

生产 `/api/v1/data-health` 显示：Registry 的最后检查停在 `2026-08-23T01:55:53.598Z`、`processor_count` 为 714，状态为 `stale`；同期官网 `processors.json` 已为 715。相反，$BEM 矿池快照在 `2026-08-23T11:05:53.600Z` 仍持续更新，说明 5 分钟 Cron 本身仍被触发，但 Registry 刷新支路没有完成或没有留下运行记录。空投也在后续周期持续运行。

该行为不能通过手工覆盖快照修复。下一步应将 Scheduler 改为：先对 Registry / 事件、空投、$BEM 各自的 D1 schema 做**隔离且顺序化**的初始化，再并发执行独立采集；并把 Registry 的 schema 初始化移入错误记录保护范围。这样，一条数据域的初始化失败既不会让另外三条源阻断，也不会令 Registry 在没有 `refresh_runs` 错误记录的情况下沉默停滞。

## 生产行情源限流修复

生产 `bem.price` 在 `2026-08-23T11:20Z` 的 DexScreener token 与固定 pair 两个端点均返回 HTTP 429；系统按既有契约保留最后成功快照并标为 `stale`，未显示 `$0` 或伪实时价格。独立核验显示 GeckoTerminal 对同一固定 PancakeSwap BEM/USDT V3 池 `0x2f5ec19ab0583D3FCd9bcbcD9AB416d2858EeA38` 返回 HTTP 200，且响应的 `base_token` 显式等于官方 BEM token 地址、包含美元价格、流动性、24 小时量价与买卖笔数。

因此，行情采集器已调整为严格三层回退：DexScreener token 聚合 → DexScreener 固定已验证交易对 → GeckoTerminal **同一地址**的聚合池响应 → 最后成功 D1 快照。GeckoTerminal 不是新“官方价格源”，也不参与交易对发现；只在前两级失败时读取已验证池并在 API `provider`、`source.endpoint` 和 `source.fallback_used` 中披露。

部署后复核：生产 `bem.price` 已在 `2026-08-23T11:25:45.012Z` 回到 `healthy`，当前该周期由 DexScreener token 聚合成功更新；健康响应同时已披露二级 DexScreener pair 与三级 GeckoTerminal 固定池回退列表。该结果证明多级回退上线，但不将短暂恢复误表述为对任何第三方持续可用性的保证。
