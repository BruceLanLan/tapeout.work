# Tapeout Intelligence：数据、交互与事件基础设施研究方案

> 本文将公开产品定位为**证据驱动的链上研究基础设施**，而不是交易信号或未经核验的推荐系统。每一条对外事件都必须包含来源、观测时间、实体地址与证据链接；无法公开验证的推断不得写成“官方”“社区认证”或“创始人动作”。

## 一、已验证的当前状态

Tapeout 官网在 Processor 卡片上直接展示 `Official`、`Certified` 与 `Community` 标签；这些是官网展示标签，而非由本产品自主推断的认证。[1] Tapeout 官网也将创建 Processor 时连接的钱包描述为 Creator，并说明 Mint 收入进入该钱包；这使得 Registry 的 `creator` 字段可表述为“协议声明的创建者/收益接收钱包”，但不足以把所有转账称为创始人行为。[1]

本次排查确认，一个用户询问的项目未出现并非搜索失败，而是其地址命中现有的受保护记录过滤。除非产品负责人明确改变这个隐私边界，公开页面、API、认证列表和事件流都不应暴露这类项目。

| 已实施项目 | 对外效果 | 约束 |
| --- | --- | --- |
| 官网标签证据 | 台账与排行榜显示 `Official` / `Certified` / `Community`，并提供 `/api/v1/attestations` | 只来自官网已展示标签；认证索引继续经过隐私过滤 |
| 事件游标分页 | `/api/v1/events` 通过 `cursor`、`next_cursor` 与 `has_more` 提供可持续读取 | 事件仍是公开 Registry 与官网标签证据，不是价格预测 |
| 信息流连续加载 | 页面首次加载 50 条，视口靠近末尾后请求下一批 | 没有证据的事件类别不会出现 |
| 台账连续加载 | 首屏 50 条，向下浏览或点击继续加载请求后续页；搜索增加 180ms 防抖 | 全部查询仍在服务端先完成隐私过滤 |

## 二、从 Ordinals / BRC-20 学到的不是“更多卡片”

Dune 上代表性的 Ordinals 与 BRC-20 看板将同一协议拆成“存量、流量、费用、区块空间、类别结构、实体下钻”六层：累计量和每日量并列，费用与交易量并列，事件阶段（deploy / mint / transfer）分开，并用区块资源占用、费率分层、媒体类型或交易类型解释活动构成。[2] [3] [4] 这比单独的排行榜更容易让用户形成问题并验证答案。

Tapeout 应采取同样的信息架构，而不是直接复制比特币指标。当前 Registry 可可靠支持 Processor、Mint、供给、Circuit、Creator、晶体管合约与官网标签；市场与协议日志接入后再扩展成交、流动性、协议交互和费用。

| 研究层 | 当前可用维度 | 接入公开链上源后的增量 | 建议呈现 |
| --- | --- | --- | --- |
| 网络存量 | Processor 数、Minted、Supply、Circuit 数、完成度 | 活跃 Creator 数、部署者集中度 | KPI 与累计时间序列 |
| 协议流量 | 新 Processor、Mint 增量、Circuit 增量、完成 Mint | Creator 协议调用、Factory `CPUCreated` | 连续证据事件流、日/周柱图 |
| 认证与谱系 | 官网 `Official` / `Certified` / `Community` 标签 | 标签变更历史、标签来源版本 | 可筛选标签、证据链接、变更事件 |
| Creator 维度 | Registry Creator 聚合 | Creator 对 Factory、Processor、Market、Circuit Market 的可解码交互 | Creator 卡片与地址下钻 |
| 市场与流动性 | 无 | Circuit Market 的 `Sold`、`Listed`、`PriceChanged`、`Delisted`；transistor Market 的 `BidFilled` | 成交额、地板/最近价、挂单、成交瀑布 |
| 链上成本 | 无 | 交易 Gas、BNB 结算额、区块时间 | 活动成本与市场深度面板 |

## 三、事件类别、命名与证据门槛

“创始人钱包动作”不应成为系统的通用标签。对外应统一命名为 `creator.protocol_action`，仅当 Registry 中的 Creator 地址对已公开的 Tapeout Factory、Processor、Transistor Market 或 Circuit Market 发起可解码调用时才广播。每项都必须记录交易哈希、区块号、时间戳、目标合约、函数/事件名称与原始数值。

Tapeout 公开前端暴露了两类可审计的市场事件源：Transistor Market 地址 `0xA6a80C1919a8326022d7c601a488888C13aA16E4` 提供 `BidPlaced`、`BidFilled`、`BidCancelled`；Circuit Market 地址 `0x6feEbbEbC07BcB90bd1Ac8b0CF9BaA4f0fF2B46f` 提供 `Listed`、`PriceChanged`、`Sold`、`Delisted`。其中 `Sold` 携带 buyer、circuits、tokenId、paidToSeller 和 fee，因此可以以 `paidToSeller + fee` 作为经链上结算验证的成交总额。[5]

| 事件类型 | 最低证据 | 可显示字段 | 绝不推断的内容 |
| --- | --- | --- | --- |
| `attestation.website_label` | Tapeout 官网当前显示的标签 | label、Processor、官网证据 URL | 标签以外的官方背书、投资推荐 |
| `creator.protocol_action` | Registry Creator + 已公开协议合约的解码交易 | Creator、目标合约、函数、tx hash、时间 | 普通钱包转账、Creator 身份之外的“创始人”社会身份 |
| `circuit.sale` | Circuit Market 的 `Sold` 日志 | Circuit、买卖双方、tokenId、总 BNB、fee、tx hash | 未由 Market `Sold` 事件结算的场外成交 |
| `circuit.large_sale` | `circuit.sale` 且 `gross_bnb >= 0.5` | 同上，加阈值与阈值版本 | “鲸鱼”“机构”或未来价格判断 |
| `transistor.bid_filled` | Transistor Market 的 `BidFilled` 日志 | token、数量、价格、卖方、tx hash | NFT 成交或项目融资 |

## 四、用户自定义信息流与 API

现有策略是浏览器本地规则，适合开始，但不足以成为 Agent 可调用的长期 API。下一阶段应把策略明确拆成“可读、可分享、不可执行”的查询契约。用户配置不是下单逻辑，也不接入钱包。

| 层级 | 使用方式 | 推荐接口 | 数据隐私与安全 |
| --- | --- | --- | --- |
| 浏览器策略 | 选择事件、阈值、标签、实体、时间窗 | URL fragment / localStorage | 不上传钱包地址；无交易能力 |
| 可分享研究视图 | 复制固定规则链接 | `/api/v1/feed?rule=<validated-base64url>` | 只接受白名单字段与上限；服务端再隐私过滤 |
| 机器 API | Agent 或脚本拉取增量 | `/api/v1/events?cursor=...&type=...&trust=...` | Cursor 稳定、schema 版本化、证据 URL 必填 |
| 导出与复现 | 当前筛选快照 | CSV 与 `snapshot_observed_at` | 大整数保持字符串，避免精度丢失 |

建议的第一版 `rule` 白名单包括 `event_types`、`trust_levels`、`website_labels`、`processor_or_creator_contains`、`min_mint_delta`、`min_circuit_delta`、`min_gross_bnb_wei`、`completion_bands`、`from`、`to` 和 `limit`。不接收任意 SQL、RPC URL、回调 URL 或钱包私钥。

## 五、可组合图表：可行，但应分两步

拖拽式图表在当前数据规模下完全可实现，且不需要先引入 BI 平台。关键是先发布**受约束的研究组合器**，而不是让用户在没有定义的数据语义下拖任意字段。

第一步是“Metric Builder”：用户从允许字段中选择一个度量、一个分组、一个时间窗与一种图形，并可把已保存组合固定到个人工作台。实现可用原生拖拽、固定卡片槽位与现有 SVG 渲染；持久化只存浏览器或分享 URL。可支持的初始组合包括 `Processor count by website label`、`Mint delta over time by label`、`Circuit delta by Creator`、`Completion distribution by label` 和 `Creator concentration`。

第二步才是自由布局工作台：允许拖动已定义的图表卡片、保存视图、导入导出 JSON。它需要稳定的实体历史表、市场事件与查询预算，因此应在成交与 Creator 事件源到位后开发。不要在第一版允许任意 Join 或上传数据源；这会使数据语义、性能和隐私边界失控。

## 六、自动采集路线：两个可行选项

| 方案 | 运行方式 | 适用范围 | 主要取舍 |
| --- | --- | --- | --- |
| 扩展现有边缘任务 | 当前 Worker 定时采集 Registry、官网标签和公开 RPC 市场日志，将每次扫描高度写入 D1 checkpoint | 当前规模、分钟到小时级延迟、公开只读产品 | 维护最少，适合先上线；要控制 RPC 分页、重组回滚和每次查询范围 |
| 持续链上监听器 | 常驻服务订阅或短间隔轮询 BNB RPC，再把规范事件写入公开 API 存储 | 需要近实时流、频繁成交、WebSocket 推送 | 延迟更低但需要长期运行实例、连接恢复、幂等与监控；不应在未证明需求前提前引入 |

无论选择哪条路线，都应在 D1 保存 `source_cursor`（block number / log index）、`source_chain_id`、`tx_hash`、`log_index`、`finality_status` 与 `ingested_at`。对于 BNB Chain 日志，建议只有在达到明确确认数后才公开为最终事件，并在重组时可撤销或更正。

## 七、建议的交付顺序

| 优先级 | 工作 | 依赖 | 结果 |
| --- | --- | --- | --- |
| P0（本次） | 官网标签证据、事件 cursor、连续信息流、连续台账、搜索防抖 | 当前 Worker / D1 | 解决“数据少、只能看几条”的主要体验缺口 |
| P1 | 公开 Rpc 日志分页、Circuit `Sold` 和 `large_sale`（0.5 BNB）证据事件、Creator protocol action | 市场 ABI、block checkpoint | 第一批真实市场和 Creator 维度 |
| P2 | 标签变更历史、Creator/Processor 历史统计、策略 URL API、Metric Builder | P1 的事件历史 | 可组合研究工作台与 Agent 查询 |
| P3 | 图表布局保存、公开策略目录、WebSocket 或更快推送 | 稳定的数据权重与实际使用反馈 | 更高频的情报终端体验 |

## References

[1] [Tapeout Protocol official website](https://tapeout.net/)

[2] [Dune: Ordinals — Inscriptions on Bitcoin](https://dune.com/dataalways/ordinals)

[3] [Dune: Bitcoin Ordinals Analysis](https://dune.com/dgtl_assets/bitcoin-ordinals-analysis)

[4] [Dune: Bitcoin Tokens — BRC-20](https://dune.com/cryptokoryo/brc20)

[5] [Tapeout public frontend deployment and market ABI source](https://tapeout.net/assets/index-BfNo46-V.js)

## 八、部署验收

2026-08-19 推送至私有仓库 `main` 后，公开 Worker 的 `/api/v1/catalog` 已返回 `/api/v1/attestations`，表明本次 API 目录升级已通过自动构建部署到生产入口。后续认证事件的补写与新 Registry 数据仍将等待下一次计划刷新；Worker 的公开数据边界保持为服务端隐私过滤后的 Processor 集合。

生产端进一步验收显示，`/api/v1/attestations` 正确返回带 `official_site_label` 信任级别和官网证据 URL 的公开项目标签；`/api/v1/events?page_size=1` 返回 `has_more: true` 与 `next_cursor`，可供前端和 Agent 按游标持续消费。两项端点均保持对受保护记录的服务端过滤。
