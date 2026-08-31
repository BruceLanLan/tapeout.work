# 社区处理器榜 API

> **数据性质：社区推算来源，不是 TapeOut 官方 API，也不是完整晶体管持有人名单。**

## 2026-08-29 变更说明

TapeOut Club 网站在这天重做（迁移到 Next.js）。旧版做法是从首页 HTML 里抠一个短时效的签名 token，再拿它去请求 `data.json`——重做后首页不再带这个 token 了。新版 `data.json` **不再需要任何 token**，直接公开可读，但代价是**不再发布逐电路/逐持仓的明细行**：原来最多 600 行的明细榜，现在只剩来源自己算好的 **Top 排名钱包聚合榜**（目前约 30 个钱包）。

因此：
- `view=processors` 视图、`asset_type`、`status` 三个筛选参数**已失效**——不是被移除报错，而是这些概念对应的数据源头本身已经不存在了。请求它们仍会返回 200，只是响应里会带一个 `retired_parameters` 字段如实说明。
- 地址聚合视图（现在是唯一视图）的字段也变了：不再有 `processor_count`/`verified_processor_count`/`unverified_processor_count`/`inactive_processor_count`/`asset_types`/`circuit_ids`/`bstar_cost`，改为来源直接提供的 `circuit_count`/`behemoth_count`/`tapeout_count`/`first_creator_seats`/`chain_weight`/`estimated_daily_bem`/`kind`。
- 覆盖范围从"源选择展示的若干处理器行"收窄为"来源自己的 Top 排名钱包"，覆盖面比重做前更窄，`coverage.limitation` 已更新措辞。

历史快照（重做前收集的逐电路明细行）保留在旧表里，不会被删除或篡改，只是不再有新数据写入。

## 用途

该接口将 [TapeOut Club](https://tapeout.club/) 公开页面展示的**钱包算力排行榜**保存为带时间戳的只读快照。它面向需要查看当前 Top 排名钱包地址、电路数、权重、社区估算日 BEM 与相对上一次快照变化的研究者。

它不用于识别真实个人、投资人、LP、路由或钱包集群；所有地址均保持为未归因的公开 EVM 地址。

| 字段/能力 | 是否提供 | 解释 |
|---|---:|---|
| 在榜公开地址 | 是 | 仅限来源自己选中并展示的 Top 排名钱包。 |
| 地址的电路数、TapeOut/Behemoth 分布 | 是 | 来源直接提供的聚合字段。 |
| 首创席位数 | 是 | 来源直接提供，未做二次推断。 |
| 链上权重、预计日 BEM | 是 | 社区源的估计字段；不是协议承诺、收益预测或可执行报价。 |
| 相对上次平台快照变化 | 是 | 只有同一来源产生第二个不同快照后才出现。 |
| 逐电路明细、资产类型/挖矿状态筛选 | 否（2026-08-29 起） | 来源已停止发布这一颗粒度；历史快照仍保留，不再有新数据。 |
| 完整晶体管持有人/余额普查 | 否 | 当前免费公共路径从未提供过完整 ERC-1155 holder 状态，现在覆盖面比之前更窄。 |
| 真实身份、投资人、LP、路由归因 | 否 | 不推断、不标注，也不会把合约地址穿透到人。 |

## 端点

### `GET /api/v1/community/processor-leaderboard`

示例：

```text
/api/v1/community/processor-leaderboard?page=1&page_size=10
/api/v1/community/processor-leaderboard?q=0x6688
```

| 参数 | 可选值 | 说明 |
|---|---|---|
| `q` | 地址片段 | 仅本 API 当前快照内按地址子串过滤。 |
| `page` | 正整数 | 页码。 |
| `page_size` | 1–100 | 每页行数，默认 20。 |

> `view`、`asset_type`、`status` 已失效（见上方变更说明）：传入非默认值会在响应里出现 `retired_parameters`，说明原因，不会报错也不会假装生效。

关键响应字段：

| 字段 | 含义 |
|---|---|
| `status` | `healthy`、`stale`、`pending` 或 `error`。 |
| `source` | 社区来源 URL、刷新健康与最后成功信息。 |
| `scope` | 不可省略的非官方、非全量 holder 与未归因边界。 |
| `coverage` | 来源报告的处理器总量/资格/挖矿数、在榜钱包数、来源区块；`limitation` 明确"仅 Top 排名可见"。 |
| `observed_at` | 本平台保存该快照的时间。 |
| `comparison_snapshot_observed_at` | 可用于解释变化列的上一个不同快照时间；不存在则相关变化为 `null`。 |
| `items[].circuit_count` / `behemoth_count` / `tapeout_count` | 该钱包的电路数及处理器分布。 |
| `items[].first_creator_seats` | 该钱包持有的首创席位数。 |
| `items[].chain_weight` / `estimated_daily_bem` | 来源自算的权重与预计日产出，均为估计值。 |
| `items[].change_from_previous_snapshot` | 只与前一次同来源快照比较；第一份快照必为 `null`，绝不伪造零变化。 |

### `GET /api/v1/community/processor-health`

返回该社区来源的独立健康、最后成功同步和数据新鲜度。它不影响 Registry、$BEM、空投或市场的健康状态。

## 刷新与降级

平台每 5 分钟尝试读取 TapeOut Club 公开的 `data.json`。若源页面返回错误、字段缺失或响应形状再次变化：

1. Worker 写入 `error` 或 `stale` 状态；
2. 最近一次成功快照继续可读；
3. 不会以 0、空榜或"实时"替代失败来源；
4. 网站首页把它作为可选数据域，失败不会阻塞核心协议数据渲染。

来源报告约每 15 分钟更新；平台的 5 分钟检查频率不意味着源数据本身每 5 分钟变化。

## 与其他来源的关系

| 来源 | 定位 | 不可混用事项 |
|---|---|---|
| TapeOut Club | 社区 Top 排名钱包榜与算力估算 | 不等同于官方链上 holder 真值；2026-08-29 起覆盖面收窄为 Top 排名，不再是逐电路明细。 |
| TapeOut Registry | 公开 Processor 注册表 | 不代表该社区榜单的完整覆盖。 |
| Firsto 市场 | 独立市场辅助来源 | 当前返回失败时仅标记失败，不能补写为持仓数据。 |
| BSC 链上日志 | 可复核原始证据 | 受公开节点历史日志能力限制；本 API 不会把不可复算历史拼装成事实。 |
