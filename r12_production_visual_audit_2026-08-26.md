# r12 生产验收记录（2026-08-26）

生产地址：[TapeOut Intelligence](https://tapeout-public-monitor.tapeout-labs.workers.dev/)。本次验收针对 `bcee826` 发布后的 r12 资源缓存与 Worker API 完成，先执行契约，再使用真实 Chromium 截图进行人工复核。

| 验收域 | 方法 | 生产结果 |
| --- | --- | --- |
| 部署传播 | 请求首页并检查资源引用 | 首页已引用 `app.js?v=2026-08-26-video-label-governance-r12`。 |
| 教学目录 | 生产教学与多语言契约 | 目录总数为 **14**；九个动态语言包各含 14 张卡片；11 个 API 响应语言均返回本地化教学内容。 |
| 93.bitmap 视频 | Community + Understand TapeOut 筛选与 API 契约 | `community-93bitmap-video-intro` 可返回并呈现；原始 URL 保持 `https://x.com/93bitmap/status/2092453478530691106`，原始语言为英语，层级为 Community。 |
| 视频边界 | 中文桌面、英文/阿语矩阵与人工截图 | 视频卡明确为社区解说；不表示官网规则、合约、价格、收益或市场结论。中文桌面卡片文字与链接在边界内；阿拉伯语移动页面为 RTL，专名可读且无页面横向溢出。 |
| Registry 标签 | 生产 API 与 Registry 真实界面审计 | 搜索 `BLONSKR_NO1` 返回 `Blonskr_No1`，其 `website_label` 为 `null`；页面无 Official 列、无 website label 筛选，也不渲染身份徽章。 |
| 窄屏表格 | 中文与阿拉伯语移动端真实 Chromium 审计 | 390px 视口下表格自身可横向滚动，页面根节点没有横向溢出。 |
| 三项目观察 | 生产 API 与组件检查 | Behemoth 地址仍仅在三项目专用公开快照模块中观察；此来源范围不向普通 Registry 条目授予官方身份。 |

> 本次真实截图矩阵已覆盖 Community 视频的中文、英文、阿拉伯语桌面/移动渲染（6 张），以及 Blonskr Registry 的中文桌面、中文移动、阿拉伯语移动渲染（3 张）。生产契约和所有上述截图审计均通过。随后对生产地址执行完整发布契约，已再次通过教学、API 多语言、BEM 独立分钟刷新、官方三项目快照、第三方 NAND/LATCH K 线、数据健康与既有版式契约。
