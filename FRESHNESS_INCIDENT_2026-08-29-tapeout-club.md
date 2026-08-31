# 数据源事故记录：TapeOut Club 社区处理器榜（2026-08-29）

## 症状

`/api/v1/community/processor-health` 显示 `stale`，`age_minutes` 约 5351（近4天），最近一次同步报错：`TapeOut Club public page did not expose a board signature`。最后一份成功快照停在 2026-08-25T21:55。

## 根因

TapeOut Club 网站整体重做（迁移到 Next.js）。旧的抓取方式是：
1. 拉取首页 HTML；
2. 用正则从内联脚本 `window.__S = { d:"...", s:"...", o:"...", e:... }` 里抠出一个短时效签名 token；
3. 拿这个 token 拼到 `data.json?e=...&st=...` 上请求。

重做后首页不再输出这段内联脚本，第 2 步永远失败。

## 排查过程

- 直接 curl 首页确认 307 重定向到 `/zh`，新页面里搜不到任何 `window.__` 变量。
- 用真实浏览器（Playwright）打开新版首页和 `算力榜`（`/zh/research?view=power`）页面，抓取真实网络请求，发现 `https://tapeout.club/data.json` **本身就是公开的普通 GET，不需要任何 token**——重做顺带移除了签名要求。
- 拉取新版 `data.json` 全量结构比对：核心元数据字段（`boardMeta.*`、`gen.*`）与旧版完全一致，唯一变化是**逐电路/逐持仓明细数组（原 `payload.board`，最多 600 行）被整体移除**，替换为 `payload.addr.power`——来源自己算好的 **Top 排名钱包聚合榜（当前约 30 个钱包）**，字段也从"电路级 14 元组"变成"钱包级对象"（`n`=电路数、`w`=权重、`nB`/`nT`=Behemoth/TapeOut 分布、`seat`=首创席位数、`daily`=预计日 BEM）。

## 处理方式（用户已确认选择"改造功能适配新格式"）

- `fetchTapeoutClubBoard()`：整段签名抓取逻辑删除，改为直接 `fetch data.json`。
- `normalizeCommunityBoard()`：改为解析 `payload.addr.power`（钱包级对象），不再解析 `payload.board`（电路级元组）；元数据解析逻辑不变（字段名未变）。
- 新增表 `community_wallet_board_rows`（钱包级），旧表 `community_processor_board_rows`（电路级）**冻结保留**，不删除、不追加新数据，仅供历史快照查询。
- `communityProcessorLeaderboard()`：`view=processors`、`asset_type`、`status` 三个参数随之失效——请求它们不报错，但响应体带 `retired_parameters` 字段如实说明原因，不静默忽略。响应字段改为钱包级（`circuit_count`/`behemoth_count`/`tapeout_count`/`first_creator_seats`/`chain_weight`/`estimated_daily_bem`/`kind`），`coverage.limitation` 措辞更新为"仅来源自己的 Top 排名可见，覆盖面比重做前更窄"。
- `COMMUNITY_PROCESSOR_BOARD_API.md`、`assert_community_processor_board_contract.mjs`、`router.js` 的 openapi/catalog 描述同步更新。

## 验证

本地 `wrangler dev` 直接打真实的 `tapeout.club/data.json`（非 mock）：
- `/api/v1/community/processor-health` → `status: healthy`，`board_count: 30`
- `/api/v1/community/processor-leaderboard` → 30 个钱包，字段与地址数值与真实浏览器直接打开 tapeout.club 算力榜页面核对一致
- 请求旧参数 `view=processors&asset_type=Behemoth&status=verified_pool` → 200，`retired_parameters` 如实说明，不报错也不假装生效
- 二次同步 → `no_change`（哈希去重逻辑未受影响）
- `/api/v1/data-health` 的 `community_processor_board` 字段 → `healthy`（说明没有把这个可选数据域的故障级联到核心健康检查）

契约脚本基线不变（`pass=8 fail=11`，失败项均为需要本地专属端口、与本次改动无关）。
