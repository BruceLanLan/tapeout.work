# TapeOut 多周期时间分析规范

## 目标

将仪表盘从单一的滚动 24 小时小时桶，升级为以**北京时间自然日**为默认粒度的协议活动分析层。用户应能在不离开主面板的情况下切换 `1d`、`7d`、`30d` 与全部 D1 可观测历史，并在小时、日粒度之间切换。

> 全协议累计仍以 TapeOut Day 1 的零状态解释。时间序列只报告 TapeOut Intelligence 已覆盖的 D1 观察事件；D1 开始覆盖前不生成零桶，也不倒推活动。

## 数据来源与范围

| 项目 | 来源 | 口径 |
| --- | --- | --- |
| Processor 新增 | `public_events.processor.created` | 公开 Registry 差分中首次出现的有效处理器。 |
| 有铸造活动的处理器 | `public_events.processor.mint_delta` | 每个时间桶按公开 Processor 地址去重。 |
| 新增 Circuit | `public_events.processor.circuit_delta` | 公开 Registry 差分的正向 Circuit 增量。 |
| 活跃创建者 | 上述 Registry 事件的 `creator_address` | 每个时间桶按公开 Registry Creator 字段去重，不推断身份。 |
| Processor 累计数 / Circuit 累计数 | `snapshots` | 最近快照前向填充的累计 Registry 状态；仅展示已存在的 D1 可观测日期。 |

`mint_delta` 保留为原始来源单位，仅用于原始差分检查，不作为默认图表指标，也不与交易额、收入、估值或市场规模混同。

## API 契约

`GET /api/v1/daily-activity` 接受以下查询参数：

| 参数 | 可选值 | 默认 | 含义 |
| --- | --- | --- | --- |
| `range` | `1d`、`7d`、`30d`、`all` | `7d` | 请求的时间窗口；若 D1 历史不足，返回实际覆盖期。 |
| `granularity` | `hour`、`day` | `day` | 分桶粒度。小时适合近一天观察；日适合默认回访与多日比较。 |
| `timezone` | `Asia/Shanghai`、`UTC` | `Asia/Shanghai` | 日桶的日界线。 |

响应固定披露 `requested_range`、`granularity`、`timezone`、`coverage_start`、`coverage_end`、`coverage_days`、`partial_first_bucket`、`buckets` 与 `metrics`。无 D1 覆盖的时间不补零。

每个桶包括 `new_processors`、`minting_processors`、`mint_delta`、`circuit_delta`、`active_creators`、`processor_total` 与 `circuit_total`。累计字段来自真实 Registry 快照，日桶或小时桶结束时不存在快照则前向填充最后一个已验证值；首个可观测桶之前不生成记录。

## 前端交互

默认状态为 **过去 7 天 / 按日 / 北京时间**，使用 `新增 Circuit` 作为默认指标。用户可独立切换时间范围、粒度与指标。热力图与柱图共享同一接口、范围和粒度；在按日模式下热力图展示最近最多 14 个日桶，在小时模式下展示最近最多 24 个小时桶。

覆盖提示必须说明请求窗口与实际 D1 覆盖，特别标记首个部分日桶。按钮不存储或执行策略，不触及钱包，也不改变现有隐私过滤规则。

## 性能与降级

聚合仅扫描请求范围内的已索引 `public_events.observed_at` 与 `snapshots.observed_at`。`all` 受 180 天上限保护；当 D1 未来覆盖超过上限时返回明确的 `range_limited` 标记。Registry、空投、$BEM 与第三方价格采集仍相互隔离。

接口无事件时返回空 `buckets` 与覆盖信息，不返回伪造零活动；前端显示明确的“尚无已验证覆盖”状态。
