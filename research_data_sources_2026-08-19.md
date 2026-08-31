# Tapeout Intelligence 数据源核验记录

## GMGN（官方文档，2026-08-19 读取）

GMGN Agent API 覆盖 SOL、BSC 与 Base 的实时 Token、Market、Portfolio 数据；可提供 K 线、流动性、持仓、钱包活动、历史 PnL、Top Holders/Traders 与部分风险/钱包分类指标。官方文档明确：只读查询也需要 API Key；交易能力另外需要私钥，且本产品不应接入任何交易、私钥或自动化下单能力。

| 可用于 Tapeout 的读数据 | 可能的产品用途 | 准入条件 |
| --- | --- | --- |
| BSC 钱包持仓、活动、统计 | Creator 地址的公开钱包活动卡片 | 需要用户提供并配置只读 GMGN API Key；按 GMGN 供应商字段显示来源 |
| Token 基础、池子、流动性、持有人/交易者 | 若 Tapeout Processor 或关联资产存在可映射的 BSC Token 时的外部上下文 | 明确地址映射、时间戳与链 ID；不能将 GMGN 推断标签写成协议事实 |
| K 线、成交量、趋势 | 市场上下文图表 | 仅在存在一一对应公开市场资产时展示 |
| 风险、Smart Money、KOL、Sniper、Bundler 等标签 | 第三方观察维度 | 只能标为“GMGN 来源标签/指标”，提供抓取时间，不得等同为官方认证或身份定论 |

## 当前不可直接依赖的部分

GMGN 的公开文档要求 API Key，合作 API 也须审批并有频率限制。因此，当前不把 GMGN 作为无需配置的生产核心数据源，也不使用非官方网页爬取。基础协议指标优先来自 Tapeout Registry 和经公开 ABI/合约地址核验的 BNB Chain 日志；GMGN 在获得只读 Key 后以可选 enrichment 层接入。

## 参考

1. https://docs.gmgn.ai/index/gmgn-agent-api
2. https://docs.gmgn.ai/index/cooperation-api-integrate-gmgn-solana-trading-api
3. https://github.com/GMGNAI/gmgn-skills

## Ordinals / BRC-20 Dashboard 可复用模式

代表性 Dune 看板并不是只列项目总量，而是同时覆盖存量、今日/日度流量、事件类型、费用/成本、资源占用、项目结构和历史趋势。Ordinals 看板以累计 inscription、日 inscription、区块容量占用、费用、费率分布、内容类型为骨架；BRC-20 看板把 deploy、mint、transfer 拆成独立事件层，并将交易数和费用按协议类别与全部 BTC 交易作份额对比。

| Dune 结构 | Tapeout 映射 | 首批可实现数据 |
| --- | --- | --- |
| 累计与日度双层 KPI | Processor、Mint、Circuit 的 all-time / 今日变化 | Registry 快照差值与按日聚合 |
| Deploy / Mint / Transfer 分阶段 | Processor created / Mint delta / Circuit delta / Market sale | 当前事件流；市场日志接入后扩展 sale |
| 费用与链资源占用 | 交易手续费、BNB 结算额、协议调用数 | 需 BNB Chain receipt / market event enrichment |
| 类别份额与对比 | Official / Certified / Community / Unlabelled；完成度分桶 | 现有官网标签和 Registry 字段 |
| 区块级/日级活跃度 | 今日新 Processor、Mint 增量、活跃 Creator、唯一交互钱包、Circuit 交易笔数 | Factory/Market ABI 事件与日聚合 |
| 时间序列 + 可筛选下钻 | 从总览进入项目、Creator、市场事件明细 | 当前分页 API，下一步加 time range 与维度选择 |

结论：Tapeout 第一阶段应首先补足“协议基本面活动面板”而非直接模仿交易终端。每个指标应同时给出时间窗、来源、观测时点和实体下钻；这让用户能从协议总体 → 标签组别 → 单个 Processor / Creator 验证结论。

参考：
4. https://dune.com/dataalways/ordinals
5. https://dune.com/dgtl_assets/bitcoin-ordinals-analysis
6. https://dune.com/cryptokoryo/brc20
7. https://dune.com/rocky_s/bitcoin-ordinal-dashboard

## BNB Chain 日志数据源与 Circuit Market 核验

BNB Chain 官方文档明确说明其列出的主网公共 RPC 禁用了 `eth_getLogs`，需要第三方端点；文档也建议频繁拉取日志时使用 WebSocket 推送。[8] 因此不将官方 dataseed RPC 作为市场日志来源。PublicNode 的 BSC RPC 页面公开列出 HTTP 与 WebSocket endpoint `https://bsc-rpc.publicnode.com`。[9]

已对 Tapeout 官网公开前端的 Circuit Market 地址 `0x6feEbbEbC07BcB90bd1Ac8b0CF9BaA4f0fF2B46f` 进行 RPC 实测。用经 ABI 签名计算出的 `Sold(uint256,address,address,uint256,uint256,uint256)` topic `0x2938a0a3a4a7c19c3a1fe6ef25340b7acd26dfac11de87836084d42fccc18656` 进行受限日志查询可返回成交日志。该事件可核验 buyer、circuit、tokenId、paidToSeller、fee，因此 `paidToSeller + fee` 是可展示的链上结算总额。公共端点对大范围窗口会 403；实测 2,000 blocks 可用，应使用有 checkpoint 的小窗口增量采集，并明确披露扫描覆盖范围。

参考：
8. https://docs.bnbchain.org/bnb-smart-chain/developers/json_rpc/json-rpc-endpoint/
9. https://bsc-rpc.publicnode.com/

### 运行验证补充

11:15 UTC 的生产 Registry 快照刷新成功，但 Circuit Market checkpoint 未写入。为避免把市场端点仍不可用误判为无成交，已在公开源状态中披露 RPC 列表，并将已实测可返回 `Sold` 日志的 `https://bsc.drpc.org` 置为首选，PublicNode 作为后备。dRPC 对一个 2,000 block、`Sold` topic 受限查询返回了 6 条成交日志；下次计划任务会通过相同 ABI 解析和 D1 checkpoint 写入验证。
