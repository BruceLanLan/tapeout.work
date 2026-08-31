# 英文社区视频与 Registry 标签复核（2026-08-26）

## 93.bitmap 英文视频

- 原始 URL：<https://x.com/93bitmap/status/2092453478530691106>
- 作者：`@93bitmap`
- 页面公开标题：`Science popularization article about the tapeout project – 1 科普第一集，英文版来了`
- 原始语言：英语；原帖同时带有中文说明。
- 页面可公开播放视频；公开页面显示时长约 08:12。
- 收录范围：仅作为 **Community / 社区视频参考**，描述为 TapeOut 与 Ordinals 的概念入口；不把视频用于官网规则、合约、价格、收益或市场结论。

## Blonskr_No1 错误官方标签

生产 Registry 在 2026-08-26 的搜索结果显示：

- 项目名：`Blonskr_No1`
- Processor：`0x1f5cb4aeae1807bf60c3b9c0d8adbcc14e91f12c`
- 晶体管：`0xe2dfd802081c7a05341e20b6582b04b908e8550c`
- 曾由平台硬编码 `WEBSITE_LABELS` 显示为 `official`，并以 `official_site_label` 作为信任字符串。

该标签没有独立的官方认证 URL 或声明，只是平台维护的展示映射；用户明确指出 Blonskr_No1 不是官方项目。因此处理方式是：移除所有硬编码的 official/certified/community Processor 网站标签，停止把公开 Registry 名称或显示字段升级为官方认证。官方范围继续只由官网 `cpu-stats.json`、`market.json` 与三项目专用观察模块的明确来源界定。

## 官网交叉核对 URL

- <https://tapeout.net/processors.json>
- <https://tapeout.net/cpu-stats.json>
- <https://tapeout.net/market.json>

官网 CPU 快照可验证 Processor/晶体管地址的存在，但不为任意 Processor 名称提供独立的官方/认证/社区治理层级。故研究面板应保持为公开 Registry 观察，不显示这类未经独立证据支持的等级标签。

## Behemoth 地址复核的补充结论

2026-08-26 对 `https://tapeout.net/` 当前公开加载的前端资源 `https://tapeout.net/assets/index-YdeZ9HvO.js` 进行只读检索后，官网源码明确把 Processor `0x1f5cb4aeae1807bf60c3b9c0d8adbcc14e91f12c` 映射为 `Behemoth`，并把晶体管 `0xe2dfd802081c7a05341e20b6582b04b908e8550c` 映射到同一 Processor/项目名。该证据足以保留三项目专用地址观察模块的 Behemoth 配置；它不能证明普通 Registry 中名称为 `Blonskr_No1` 的行应获得官方认证徽章。

因此，本轮采用严格的双层边界：三项目专用模块继续引用官网前端与官网快照中的明确地址配置；普通 Processor Registry 不展示官方、认证或社区等级。两类展示不再互相继承。

| 展示域 | 可使用的来源 | 本轮行为 |
| --- | --- | --- |
| 三项目地址观察 | 官网前端项目映射、`cpu-stats.json`、`market.json` | 保留 TapeOut、Behemoth、Genesis CPU 的专用观察与范围说明。 |
| 普通 Processor Registry / Research Board | `processors.json` 的公开字段 | 不根据项目名称、网站字段或创建地址推断官方、认证或社区治理等级。 |

> 这个复核只说明三项目地址观察配置存在官网命名依据；它不把任何普通 Registry 行重新认证为 Official。

[1]: https://tapeout.net/assets/index-YdeZ9HvO.js "TapeOut 官网前端资源（2026-08-26 读取）"
[2]: https://tapeout.net/cpu-stats.json "TapeOut CPU statistics snapshot"
[3]: https://tapeout.net/market.json "TapeOut market snapshot"
