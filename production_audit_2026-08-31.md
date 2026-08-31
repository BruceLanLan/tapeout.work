# 生产验收记录（2026-08-31）

新增两个功能：`/api/v1/bem/trending`（社区热点话题）与 `/api/v1/ecosystem/health`（生态工具健康检查）。前者本人直接实现，后者由并行 agent 实现、本人复核并修了一处真实 bug。

## 社区热点话题（Community Hot Topics）

用户要求做"社区热点话题"，明确拒绝"编几句话装作有人在讨论"这种做法。方案：**不做社交/讨论热度指标，只做基于本站已有真实数据的"增长趋势"**——复用 `bem_leaderboard_snapshots` 表（已有 4 天以上历史，326+ 份快照），取最新快照与≈24小时前最近的一份快照做差值，按题目/钱包电路数增长幅度排名。

| 验收域 | 方法 | 结果 |
| --- | --- | --- |
| 数据真实性 | 本地 `wrangler dev` 直接查询本地持久化的真实历史快照（非 mock） | 返回 15 条题目趋势（如 #74 两天内 +608 电路）与 7 条钱包趋势（如某地址 +410 电路），数值与源数据手工核对一致 |
| 诚实边界 | 代码审查 | 24小时前不在 Top 30 快照里的条目一律标 `baseline_available:false` 并从结果中剔除，绝不显示编造的"新出现"或 0% 变化；`methodology` 字段明确写明"不是社交/讨论指标" |
| UI | 复用站内已有 `bars()` 组件与已验证的 cyan/amber 配色，插入 $BEM 板块内 leaderboard 和 explore 折叠面板之间 | 零新增 CSS 变量，风格与全站一致 |

## 生态工具健康检查（Ecosystem Tool Health）

对已收录的 16 个社区工具做只读可达性探测（HEAD 优先，405/501 或连接失败时退化为 GET），每工具最多每 60 分钟探测一次，绑定到既有 5 分钟 cron（不新增 cron 触发器）。

| 验收域 | 方法 | 结果 |
| --- | --- | --- |
| 真实网络探测 | 本地 `wrangler dev` 对全部 16 个真实工具 URL 发起真实 HEAD/GET 请求 | 13 个 reachable，3 个 unreachable：`tool-bscscan-pod`（403，BscScan 自身反爬，非真故障）、`tool-dune-mining-intelligence`（403，同理）、`tool-intelligence-api`（初次测试时因目录里存的是站内相对路径 `/api/v1/catalog` 而不是绝对 URL，Worker 内 `fetch()` 无法解析相对路径直接报错） |
| Bug 修复 | 上面第三个问题是真实 bug：把本站自己的 API 误判为"不可达"。修复：探测前用 `new URL(url, "https://tapeout.work")` 相对本站源解析，再发起请求 | 修复后重测：`reachable`，`http_status: 200` |
| 治理纪律 | 代码审查 | 从不为未探测过的工具编造结果（`status:"pending"`）；探测响应显式禁用边缘缓存（`cf:{cacheTtl:0}`），避免缓存掩盖真实下线；scope 字段明确"不是可用率历史，不是内容正确性核验，不代表对该工具的背书" |

两个功能均为纯新增 API + UI，未修改任何既有端点的返回结构。契约脚本基线 `pass=9 fail=11`（新增的 `assert_no_sensitive_info.mjs` 计入通过项，其余基线不变）。推送前已按新规矩跑过 `scripts/assert_no_sensitive_info.mjs`，确认无该脚本所列敏感字符串泄漏（具体清单见脚本本身，此处不重复列出，避免公开仓库里出现字面匹配）。
