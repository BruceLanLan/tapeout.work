# 事故记录：D1 免费层每日行写入上限耗尽（2026-09-02）

## 现象

约 17:00 UTC 起 `/api/v1/data-health` 返回 500（`error code: 1101`），其余读库接口正常。`wrangler tail` 抓到的异常：

```
D1_ERROR: Your account has exceeded D1's free tier daily row write limit.
  at recordOfficialAssetRun ← syncOfficialThreeAssets ← officialAssetsHealth ← dataHealth
```

随后确认 `/api/v1/official-assets/addresses` 与 `/overview` 同样 500——它们的读路径内联触发同步，同步写库抛异常直接打穿。

## 测量

`npx wrangler d1 info tapeout-monitor`：`rows_written_24h = 104,800`（上限 100,000），`write_queries_24h = 34,558`，库大小 174 MB。

按表统计过去 24 小时：

| 表 | 24h 写入行 |
|---|---|
| official_asset_minter_rows | 47,824（49 个快照 × 976 个 minter） |
| official_asset_open_bid_rows | 16,861 |
| bem_trades | 1,605 |
| transistor_candle_trade_rows | 497 |

根因：官方资产快照的源哈希只要变一次（任何人 mint 一下），就把全部 minter 行和挂单行整套重插一遍；索引项另计。

## 处置

1. `dataHealth` 各分支各自 catch——报告降级的端点自己不能被降级打死。
2. minter/挂单改为**当前表 + 只写变化行**（`official_asset_minters_current`、`official_asset_open_bids_current`）：值变了才 UPSERT，挂单消失才 DELETE；历史表停止写入但不删（删除也是写）。读路径改读当前表，当前表为空时回退读最新的旧快照行。
3. 第一次部署该改动时写额度仍是耗尽状态，`CREATE TABLE` 被拒 → 所有官方资产读路径 500 → 立即 `wrangler rollback`。随后加固：schema 写失败清空缓存的 promise 以便重试、当前表查询失败回退旧表、读路径对 `officialAssetsHealth` 的调用全部 catch。再次部署后全部接口 200，官方资产板块如实标 `status: error`（同步写不进去），数据照常服务。
4. `ship.mjs` 的生产核验清单加入官方资产两个端点、bem/trades、ko 语种工具列表。

## 待验证（写额度 00:00 UTC 重置后）

- 第一次变化快照落地后，当前表被填充（约 1.3k 行一次性），之后每个快照只写几十行。
- 次日 `rows_written_24h` 应降到 4 万以下。

## 教训

- 每日配额有两条：读（500 万行）和写（10 万行）。读被"每请求扫窗口"耗尽过一次（见 2026-09-01），写被"每快照全量重写明细"耗尽过一次。**任何"每次都重写整张明细表"的写法在 D1 免费层都不可持续**。
- 在配额耗尽期间部署含 `CREATE TABLE` 的改动，会因为建表本身是写而把读路径一起拖死。schema 步骤必须可失败。
