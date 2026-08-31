# 官方三项目地址聚合与持仓观察 API

## 范围

本模块只覆盖 TapeOut 官网公开 Processor 配置中的三个晶体管项目：**TapeOut**、**Behemoth** 与 **Genesis CPU**。数据读取自官网公开的 [`cpu-stats.json`](https://tapeout.net/cpu-stats.json) 与 [`market.json`](https://tapeout.net/market.json)，并在平台计划任务中独立保存快照。

> **不是当前地址余额普查。**官网 CPU 快照公开的是每个项目的 holder 聚合数与累计铸造地址；官网市场快照公开的是当前挂出的买单。两种地址观察均不能等同于当前 NAND/LATCH 余额、实际控制人、投资人、LP 或路由归因。

| API | 作用 | 关键边界 |
|---|---|---|
| `/api/v1/official-assets/overview` | 三项目的官网 holder 聚合数、累计铸造地址数、累计铸造来源单位与当前公开买单数 | holder 只以项目聚合形式提供；不返回“当前 holder 地址余额” |
| `/api/v1/official-assets/addresses?view=mints` | 跨三项目聚合的**累计铸造地址** | `cumulative_minted` 是官网来源累计铸造单位，不是当前持仓 |
| `/api/v1/official-assets/addresses?view=open_bids` | 跨三项目聚合的**当前公开买单地址** | 挂买单不是完成交易，也不是当前持仓 |
| `/api/v1/official-assets/health` | 来源健康、最新成功快照与降级状态 | 源失败时保留最后一次成功快照，并明确 `stale` / `error`，不以零代替 |

## 地址筛选

`/api/v1/official-assets/addresses` 支持下列参数。

| 参数 | 可选值 | 含义 |
|---|---|---|
| `project` | `all`、`tapeout`、`behemoth`、`genesis` | 仅筛选三类官网项目；其他值安全回退为 `all` |
| `view` | `mints`、`open_bids` | 显示累计铸造地址或当前公开买单地址 |
| `q` | 地址片段 | 只匹配公开地址或内部项目键 |
| `page` / `page_size` | 正整数；`page_size` 最大 100 | 服务端分页 |

示例：

```text
/api/v1/official-assets/overview
/api/v1/official-assets/addresses?view=mints&project=genesis&page=1&page_size=20
/api/v1/official-assets/addresses?view=open_bids&project=tapeout
/api/v1/official-assets/health
```

## 变化口径与缓存

每次官网源内容出现变化时，平台写入一个新快照。新快照有前序快照时，响应会给出 `change_from_previous_snapshot`；首份快照返回 `null`，不会伪造零变化。三个端点均返回 `cache-control: no-store`，避免计划任务首次运行时的 `pending` 或已过期快照被边缘缓存。

所有数值、合约地址、原始来源 URL 与时间戳均保持事实字段，不通过多语言层改写。界面本地化只负责解释字段名称与边界，不改变 API 事实。该模块不提供价格预测、交易建议、钱包聚类或身份归因。
