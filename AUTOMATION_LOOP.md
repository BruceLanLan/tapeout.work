# 自动更新与迭代回路（2026-09-02）

本站的"自动迭代"不是"AI 自动改内容"。这条线昨天就划了：本站的立身之本是"写下的每句话都经人核实"，让模型直接改目录会把这个承诺架空，而且改错了没人知道。

自动化的对象是**围绕那一次人工判断的所有其他环节**：发现变化、取证、起草、翻译、校验、上线、上线后核验。人只保留一件事——对每条内容修订点一次头。这是一个可以被推翻的默认；如果哪天要放开，改的是 `apply_reviews.mjs` 的准入条件，不是别的。

## 回路

```
 站点自审（Worker，每 6 小时）                本地/CI
 ┌──────────────────────────┐   ┌──────────────────────────────────────────────┐
 │ 指纹漂移 → 复核队列       │──▶│ review_drafts.mjs  取证 + 断言核对 + 模型起草  │
 │ 译文源哈希 → 新鲜度告警   │   │        ▼  reviews/pending/<id>.md            │
 │ 覆盖率 / 证据字段 / 时效  │   │ 【人：status: approved | revouch】             │
 └──────────────────────────┘   │        ▼                                     │
            ▲                    │ apply_reviews.mjs   写入种子、推进版本号        │
            │                    │        ▼                                     │
            │                    │ translate_catalog.mjs  只译哈希变了的条目       │
            │                    │        ▼  校验不过 → 拒写，构建保持红           │
            │                    │ ship.mjs  门禁→变更日志→敏感扫描→提交→推送→部署  │
            └────────────────────│        ▼  生产核验（版本号/缓存号/关键接口）      │
                                 └──────────────────────────────────────────────┘
                                   push 到 main 亦触发 .github/workflows/deploy.yml
```

## 各部件

| 部件 | 做什么 | 不做什么 |
|---|---|---|
| `src/self_audit.js` | 每 6 小时给已收录工具页面做指纹（资产 URL 集合 + 标题/导航/标题层级），审核日期之后发生变更的进复核队列；按每条译文记录的源哈希报告哪些译文已过时；公布覆盖率（四个桶必然加总等于总数，"没检查"会被点名） | 不推断改了什么，不判断描述是否已错，不改目录 |
| `drift_profile`（种子字段） | 按工具声明监控信号：`full`（默认）/`structure`（只看标题+导航，给日报、共享平台看板）/`none`（声明性跳过，原因随覆盖率公布） | — |
| `scripts/review_drafts.mjs` | 把队列变成证据包：抓取当前页面（r.jina.ai → headless Chrome），记录编号摘录，逐句机械核对（中英），再让模型提出修订——**修订必须引用摘录行号，引用不到的草稿标为无效**；抓不到页面就写"本轮无法核实"，不提案 | 不写种子 |
| `scripts/apply_reviews.mjs` | 只对人标了 `approved`/`revouch` 的文件动手：写入 summary_en/zh、刷新 reviewed_at、推进版本号、把文件归档到 `reviews/applied/` | 不翻译、不上线 |
| `scripts/translate_catalog.mjs` | 每条译文旁存一份源文本哈希；只译哈希变了的条目；第二次模型调用逐条核对**否定词、排除、限定、免责声明的极性和范围**，另查有无凭空多出的断言；不过的不写 | 不决定目录说什么 |
| `scripts/assert_translation_freshness.mjs` | 构建门禁：任一语种任一条目哈希不符即失败 | — |
| `scripts/ship.mjs` | 一条命令走完：静态门禁 → 起本地 Worker 跑在线契约 → 生成变更日志 → 敏感信息扫描 → 提交 → 推送 → 部署 → 轮询生产直到版本号、缓存号、关键接口全部对上 | 不跳过任何一步（`--dry-run` 只跑到扫描） |
| `.github/workflows/deploy.yml` | push 到 main：静态门禁 → `wrangler deploy` → 核验生产版本。替代已失联的 Workers Builds | 不跑需要本地 Worker 的在线契约 |

## 使用

```bash
node scripts/review_drafts.mjs               # 队列里的每个工具生成 reviews/pending/<id>.md
#   编辑文件：status: approved（并按需改底部 JSON）或 status: revouch
node scripts/apply_reviews.mjs               # 写入种子，版本号 +1
node scripts/translate_catalog.mjs           # 只译变了的条目，校验不过则拒写并报错
node scripts/ship.mjs -m "content: ..."      # 全链路上线并核验
```

模型调用走本机 `claude` CLI（`CLAUDE_BIN` 可覆盖，默认模型 `sonnet`）。每次调用约有 1.5 万 token 的系统提示缓存开销，所以按语种批量：一次目录修订全语种重译约 1–2 美元；一份复核草稿约 0.1 美元。`--stub` 让翻译脚本不调模型（测试用）。

## 校准记录

- 2026-09-02：`translate_catalog.mjs --verify` 对前一夜 36 条人工译文（4 条目 × 9 语种）跑校验器，结果见提交说明。校验器上岗前必须先证明它不会误杀已知正确的译文。
- 2026-09-02：`review_drafts.mjs` 首次对 firsto 跑通，抓取路径 r.jina.ai，93 行摘录。

## 明确不做

- 不用 Cloudflare Browser Rendering 做渲染后 DOM 探测（需要改账号计划配置，不单方面动）。
- X 扫描的候选工具目前仍由会话内定时任务派 Agent 只报不写；候选入库走同一份 `reviews/pending/` 格式，但自动生成候选文件不在本批。
