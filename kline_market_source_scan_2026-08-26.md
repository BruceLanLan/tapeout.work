# NAND / LATCH 蜡烛图数据源初步巡检（2026-08-26）

本巡检针对用户此前提供的三个公开生态站点：TapeOut Club、Firsto TapeOut、TapeOut Market。结论仅用于决定是否能构造**第三方成交聚合蜡烛图**，不将任何第三方价格、订单簿或成交数据称为官网报价，也不构成交易建议。

| 来源 | URL | 页面能力 | K线状态 | 适合作为平台数据源的判断 |
|---|---|---|---|---|
| TapeOut Club | https://tapeout.club/ | 明确自称非官方社区工具；晶体管交易市场显示“即将上线”；价格区说明为链上订单簿/成交日志快照，并称可切换 K线/折线，但页面未暴露三大官方 NAND/LATCH 的可复用成交 API。 | 未发现可直接复用的 NAND/LATCH K线 API。 | 可作为社区参考，不作为主数据源；如使用链上方法应自行读取公开事件并标注第三方。 |
| Firsto TapeOut | https://tapeout.firsto.ai/ | TapeOut/NAND 页显示订单簿、最新确认成交、逐笔成交的时间、数量、BNB 单价和 BscScan 交易哈希；页面在源不可用时明确显示“实时数据不可用，不会显示模拟数据作为替代”。 | 未发现蜡烛图 UI；**存在可聚合的公开成交序列迹象**。 | 可探索为第三方成交输入，但必须先验证稳定公开接口/字段、事件去重和合约范围，且需要与链上交易哈希交叉验证。 |
| TapeOut Market | https://tapeout.market/ | 首页展示 TapeOut/Behemoth NAND/LATCH 的最新价格与变化百分比，并链接到单品市场页。 | 首页未发现 K线或成交时间序列。 | 社区市场来源；可继续检查单品页与公开网络请求，不能默认其标签为官方。 |

## 当前判断

三个站点的首页均没有提供可直接嵌入的“三大官方 NAND/LATCH K线”。最可行的路径是：以**公开且可验证的成交事件**构造 OHLCV；每根蜡烛需说明时间窗、成交笔数、成交量、BNB 计价、原始交易哈希覆盖范围和来源层级。没有任何已确认成交的时间桶必须显示“无成交”，而不是以前一根收盘价伪造价格。

在正式接入前，需要完成以下验证：

1. 取得公开、稳定、无钱包权限的成交历史端点或直接链上事件源；
2. 对 TapeOut、Behemoth、Genesis CPU 的 NAND/LATCH 合约逐项核对资产和市场合约范围；
3. 按交易哈希去重，排除挂单、撤单、零值或无法确认的记录；
4. 将 UI 标注为“第三方/公开链上成交聚合（非官方价格）”，并保留 last-success、stale/error 语义；
5. 无法取得连续可验证成交时，不发布模拟 K线。


## 单品页复核补充

2026-08-26 对 `https://tapeout.market/market/tapeout/nand` 的公开页复核显示：该单品页包含 **Price History** 与 **Activity** 标签，并公开展示 Latest Sale、24h volume、Open Offers、Processor/ ERC-1155 合约链接、Token ID 及链上定期索引提示。页面还指向 TapeOut LATCH、Behemoth NAND 和 Genesis CPU NAND 的单品页。

这说明 TapeOut Market 是目前最可能具备历史成交查询能力的第三方社区市场；但在未验证其 Price History 所使用的网络端点、分页/时间范围、是否仅自身市场成交、以及与 BscScan 哈希的一致性前，不能将它直接接入为 K线数据源，也不能将其卡片的“Official”资产标识误读为 TapeOut Market 本身的官方身份。


## 公开成交端点被动探测

在 TapeOut Market 的 TapeOut NAND 单品页已加载资源中，观察到公开端点：

```text
https://api.tapeout.market/api/v1/markets/0xCC42ba5De07f01B472a5b14cF45aBcCA79Eb8087/0/fills
```

其响应包含 `fills` 数组，单笔记录具有 `blockTimestamp`、`blockNumber`、`sellerUnitPriceWei`、`quantity`、`buyerTotalWei`、`txHash`、`logIndex`、`orderHash`、买卖双方地址、费用、集合地址和 tokenId 等字段。因此它在字段层面可支持按 BNB 单价、数量和时间聚合 OHLCV，并可用 `txHash + logIndex` 去重和与 BscScan 交叉验证。

本次只读取到 **100 笔** TapeOut NAND / tokenId 0 成交，覆盖约 2026-08-25 17:10:57Z 至 2026-08-26 08:18:10Z。对 `limit=500`、`limit=1000`、`page=2` 与 `cursor=100` 的被动查询均仍返回同一 100 笔和相同最早时间，尚未证实该公开端点支持历史分页。因此它可以支持**启动后的短窗成交蜡烛图**，但无法直接支撑历史日线；需要平台自身快照积累，或在后续找到经过验证的链上事件回溯方式。


## Firsto 公开端点发现

Firsto TapeOut 页面的已加载公开资源显示：

```text
https://api-tapeout.firsto.ai/v1/markets
https://api-tapeout.firsto.ai/health
https://api-tapeout.firsto.ai/v1/book/0xCC42ba5De07f01B472a5b14cF45aBcCA79Eb8087/0
https://api-tapeout.firsto.ai/v1/market/0xCC42ba5De07f01B472a5b14cF45aBcCA79Eb8087/0/overview?limit=100
```

其中 `book` 是订单簿，`overview?limit=100` 很可能承载页面所示的最新价格、订单簿、逐笔成交或市场统计。下一步必须只读检查返回 schema、成交记录时间范围、交易哈希字段、资产集合/tokenId 和可用分页；在这些事实确认之前，Firsto 不得被视为可用 OHLCV 来源。


## Firsto 成交 schema 与历史窗口

Firsto `overview?limit=100` 响应有 `status`、`sourceBlock`、`asOf`、`stats`、`trades`。`trades` 记录包含 `id`（`transactionHash:logIndex`）、`venue`、`side`、`orderId`、`transistors`、`tokenId`、`priceWei`、`quantity`、`totalWei`、`feeWei`、`blockNumber`、`timestamp`、`transactionHash` 与 `trader`。这足以按成交时间、BNB 单价和数量构造 OHLCV，并按 `id` 去重；本次记录的 `venue` 为 `official`，但该字段是 Firsto 的第三方索引描述，平台仍须整体标注为第三方聚合并保留原始交易哈希。

当前 `limit=100` 覆盖约 2026-08-26 05:56:39Z 至 08:34:28Z。`limit=500` 和 `limit=1000` 返回 HTTP 400；`offset=100`、`before=<block>` 未改变返回窗口。因此尚未证明存在历史分页。结论与 TapeOut Market 相同：可作为启动后的短窗/滚动 OHLCV 输入，不足以直接回填长期日线。


## 三大官方资产覆盖核对

Firsto `/v1/markets` 返回 795 个市场，字段中包含 `creatorKind`、CPU、transistors 和 NAND/LATCH tokenId/最新价。按名称筛选时，公开列表明确返回 TapeOut 与 Genesis CPU 的资产映射；未以用户期望的 `Behemoth` 名称返回，反而出现 `Blonskr_No1`（同样标作 `official`）市场。因此不能依赖名称、`creatorKind` 或 Firsto 的“官方”标签判断 Behemoth 资产身份，必须将 Firsto 的 `transistors` 合约与 TapeOut Intelligence 已验证的官网三项目配置逐项比对后才可采集。


## 六资产只读覆盖验证

以 TapeOut Intelligence 已验证的官方晶体管合约为基准，对 Firsto 的 `overview?limit=100` 逐项读取：

| 官方项目 | 资产 | 端点返回 | tokenId | 当前最早成交覆盖 |
|---|---|---:|---:|---|
| TapeOut | NAND | 100 笔 | 0 | 2026-08-26 06:07:33Z |
| TapeOut | LATCH | 100 笔 | 1 | 2026-08-25 17:48:20Z |
| Behemoth | NAND | 100 笔 | 0 | 2026-08-25 14:55:48Z |
| Behemoth | LATCH | 100 笔 | 1 | 2026-08-25 08:19:10Z |
| Genesis CPU | NAND | 100 笔 | 0 | 2026-08-25 18:01:14Z |
| Genesis CPU | LATCH | 100 笔 | 1 | 2026-08-21 16:00:04Z |

每个响应的 `transistors` 地址与本平台官方三项目常量一致，tokenId 也分别为 NAND=0、LATCH=1。**这确认了六资产的短窗成交读取可行**；但各资产覆盖长度差异很大，且均受 100 笔窗口限制，因而不能在无自身持久化成交档案的情况下宣传长期 K线。
