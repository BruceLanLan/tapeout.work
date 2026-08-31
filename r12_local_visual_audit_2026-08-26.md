# r12 本地真实界面验收记录（2026-08-26）

本记录基于本地 Cloudflare Worker `http://127.0.0.1:8787` 的真实 Chromium 桌面渲染与交互，而非静态尺寸推断。

| 检查项 | 实际操作 | 结果 |
| --- | --- | --- |
| 教学视频 | 在英语界面选择 `Community` 与 `Understand TapeOut` 筛选 | `Community video: TapeOut science primer · episode 1` 可见；卡片显示 Community、英语社区解说、仅供参考且不是规则、合约、价格、收益或市场结论的边界。 |
| 教学布局 | 检查两张筛选后的社区卡片并观察资源卡片网格 | 标题、摘要、来源说明和“Open resource”链接均位于卡片边界内，未见文字或按钮溢出。 |
| 标签治理 | 页面首屏观察协议范围、组合器和事件筛选 | 协议范围明示“不推断项目治理等级”；组合器仅提供 Mint completion；事件筛选不再提供 website label / official site label。 |
| Registry | 本地 API 搜索 `BLONSKR` 并检查页面可见 Registry 区域 | `Blonskr_No1` 存在，API 返回 `website_label: null`；表格已删除 Official 列，前端不会渲染身份徽章。 |
| 三项目分层 | 检查独立地址观察模块 | Behemoth 仍位于三项目专用 Tab，地址显示为 `0x1f5cb4…f12c`；该模块与普通 Registry 身份标签相互独立。 |

> 截图检查时，视频卡在 Community + Understand TapeOut 筛选下与 Something Labs 卡片并列呈现。中文桌面截图中两张卡片的标题、摘要、边界提示与链接都落在卡片内；阿拉伯语移动截图中页面按 RTL 呈现，英语专名与地址类文本保持可读，卡片没有横向溢出。中文移动端的 `BLONSKR_NO1` 搜索截图只显示处理器与创建者等可见列，更多列保留在表格内部横向滚动中；页面不出现 Official 列或身份徽章。结论仅覆盖 r12 本地构建；生产结论须待推送部署后重新复验。
