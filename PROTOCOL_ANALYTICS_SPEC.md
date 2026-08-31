# Protocol Analytics Spec v1

## 目的

将 Tapeout Intelligence 从单一 Registry 排名页扩展为可核验的协议活动看板。第一版严格区分“Registry 快照观察”与“链上交易事实”：未解码公开交易日志前，不把 Registry 变化称为链上交易笔数、活跃钱包数或 NFT 成交量。

## 数据产品

| 模块 | 指标 | 口径 | 证据来源 | 当前状态 |
| --- | --- | --- | --- | --- |
| 24h 协议脉冲 | 新 Processor | 当前 UTC 日内 `processor.created` 事件数 | D1 事件账本，由相邻公开 Registry 快照比较产生 | 已实现 |
| 24h 协议脉冲 | Mint 增量 | 当前 UTC 日内所有 `processor.mint_delta.metric_value` 的大整数求和 | 同上 | 已实现 |
| 24h 协议脉冲 | Circuit 增量 | 当前 UTC 日内所有 `processor.circuit_delta.metric_value` 求和 | 同上 | 已实现 |
| 24h 协议脉冲 | 活跃 Creator / 项目 | 当前 UTC 日内出现协议观察事件的去重 Creator / Processor 地址数 | 同上 | 已实现，命名为“observed”，不称链上交互钱包 |
| 项目横截面 | Processor 数、Mint、Circuit | 按官网标签或 Mint 完成度分组的当前公开 Registry 值 | `processors_current` + 官网展示标签映射 | 可实现 |
| 项目横截面 | 排名 | 按 Mint、Circuit、完成度在当前公开 Registry 排序 | 同上 | 可实现 |
| Creator 维度 | 当前项目数、累计 Mint、Circuit | 当前公开 Registry Creator 聚合 | `processors_current.creator_address` | 已有 API，补前端呈现 |
| Creator 钱包画像 | 公开持仓、交易、第三方风险/标签 | 仅在获得只读 GMGN API Key 后，以 GMGN 来源时间戳和字段名展示 | GMGN API | 待用户提供只读 Key |
| 市场与 NFT | 成交数、成交额、0.5 BNB 大额成交、活跃买卖方 | 只接受公开 Circuit Market `Sold` / Transistor Market `BidFilled` 解码日志 | 已核验公开 ABI 和市场地址 | 待实现链日志采集 |

## UX 结构

1. **Evidence waterfall**：默认折叠为前 12 条；用户可展开已加载事件，折叠不会丢失游标或筛选状态。
2. **Protocol pulse**：展示今日 Registry 观测活动，并明确 UTC 窗口和“非交易计数”的解释。
3. **Cross-section mixer**：用户选择指标（Processor、Mint、Circuit）与维度（官网标签、Mint 完成度），即时重绘。该版本是可组合数据探索的最小可用实现；自由拖拽布局与任意 Join 需等事件历史和查询预算稳定后再提供。
4. **Research board**：同时展示 Circuit leaders、Mint leaders、标签构成和数据边界，让“总量—类别—项目”形成闭环。

## 不可逾越的命名边界

- “官方 / 官网认证 / 社区”只来自 Tapeout 官网的实际展示标签。
- “Creator”表示公开 Registry 的 `creator` 地址，不等同于线下身份或项目全部关联钱包。
- “活跃 Creator”表示当天有 Registry 观察事件的 Creator 地址，并非 BNB Chain 的所有交互钱包。
- 没有 `Sold` / `BidFilled` 解码日志前，不显示“交易笔数”“交易额”“NFT 成交量”。
- GMGN 的 Smart Money、KOL、Sniper、风险等数据若接入，必须用“GMGN 来源”显示，不可转述为协议事实或官网判断。
