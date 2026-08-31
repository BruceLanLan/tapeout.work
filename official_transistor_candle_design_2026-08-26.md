# 三大官方项目 NAND / LATCH 成交蜡烛图设计

## 决策

平台将提供 **TapeOut、Behemoth、Genesis CPU** 各自 NAND / LATCH 的**第三方公开成交聚合蜡烛图**。它不是官网价格、估值、订单簿中间价或投资建议。

| 项目 | 设计选择 |
|---|---|
| 原始输入 | Firsto TapeOut 无需钱包、公开可读的 `GET /v1/market/{transistors}/{tokenId}/overview?limit=100` 成交数组。 |
| 官方范围 | 只使用 TapeOut Intelligence 现有官网三项目配置内的晶体管合约；TapeOut、Behemoth、Genesis CPU 的 NAND tokenId 固定为 0、LATCH 固定为 1。第三方名称和标签不决定纳入范围。 |
| 成交校验 | 每笔要求合约与 tokenId 精确匹配、`id=transactionHash:logIndex`、合法区块时间、整数 wei 单价/数量、合法交易哈希。写入前以 `source + id` 去重。 |
| 蜡烛口径 | 以确认成交的 `priceWei` 聚合 BNB 计价的 Open/High/Low/Close、成交数量、成交额和笔数；时间桶使用 UTC。 |
| 无成交 | 时间桶没有已验证成交则 `has_trades=false`、OHLC 为 null；不以前一笔收盘价填充，不把挂单/买单/最新快照当成交。 |
| 时间范围 | 首次同步只能带入每资产公开端点当前可见的最多 100 笔；之后按 5 分钟独立归档累积。UI 必须显示“历史自首次归档/端点可见时间开始”，不得暗示有更早日线。 |
| 新鲜度 | 独立 5 分钟采集；15 分钟未成功标为 stale。每个资产独立失败，不影响 Registry、空投、BEM 价格或官方三项目地址聚合；保留最后成功成交与 candle。 |
| 保留 | 原始第三方成交归档按 180 天保留，以支撑本平台开始归档后的小时/日线；超过保留期删除，不伪造早期价格。 |
| API | 新增 `/api/v1/official-assets/candles?project=tapeout|behemoth|genesis&asset=nand|latch&interval=5m|1h|1d&range=24h|7d|30d`，返回来源、健康、可用历史起点、每根蜡烛的 raw 和 BNB 格式化字段。 |
| UI | 将蜡烛图放进现有官方三项目标签下，提供 NAND/LATCH、5m/1h/1d 与 24h/7d/30d 控件；醒目标注“第三方公开成交聚合 · 非官方价格”，显示来源、采集时间、覆盖起点和空桶说明。 |

## 不做的事

不接入 TapeOut Club 的社区估算、不将 TapeOut Market 或 Firsto 标为 TapeOut 官方团队、不通过无授权页面抓取填补缺失成交、不展示钱包身份标签、不用成交推断持仓、不计算或推荐买卖策略。
