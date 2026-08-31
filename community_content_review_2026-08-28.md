# TapeOut 社区内容审核记录（2026-08-28）

延续既有审核方法。本轮核心决定：**推翻 08-26 对 TapeOutGo 的"不集成"决定**，改为集成其只读方法论。

| 项目 | 08-26 决定 | 08-28 决定 | 处理方式 |
|---|---|---|---|
| [TapeOutGo](https://github.com/0xLukin/tapeoutgo) | 不集成、不链接 | **推翻，集成方法论** | 见下方"集成方式"说明 |

## TapeOutGo 集成方式

08-26 的顾虑是真实的：TapeOutGo 会引导钱包连接、购买、流片、挖矿、领取的完整流程。用户本轮明确要求推翻该决定，但要求"优雅、方便、致敬作者"。采用的方案：

**只搬运只读的报价/日产计算方法，不搬运任何钱包/签名/执行代码。**

- 新增 `src/budget_quote.js`：服务端读取 Firsto 公开卖单簿（`GET https://api-tapeout.firsto.ai/v1/book/{gates}/{tokenId}`，与 TapeOutGo 读的是同一个公开 API），按预算走册（cheapest-first）算出 TapeOut / Behemoth 各能买多少台矿机、真实成本、以及套用官方非 Pioneer 权重公式（`H = b* × P`，读本站已有的 `bemMiningOverview` 挖矿快照）算出的日产 $BEM 估算。
- 新增 `/api/v1/bem/budget-quote?budget_bnb=` 端点，`methodology_credit` 字段显式署名 0xLukin，附仓库、在线工具、License 链接。
- 前端新增"预算优先报价"卡片，位于 $BEM 板块（挖矿快照与价格卡片之间），面板头部直接链到 GitHub 仓库致敬。
- **不做**：不连接钱包、不构造任何交易、不做购买/流片/领取。真要执行这些操作，卡片本身注明"打开 TapeOutGo 本体"。
- 工具目录同时新增 `tool-tapeoutgo` 条目，指向作者本人的在线工具，说明其提供本站没有的"买齐差额→流片→arm/start→领取"全流程，署名与安全边界并列。

已用真实浏览器 + 真实 Firsto 卖单簿验证：5 BNB 预算下 TapeOut 48 台/4.9142 BNB/日产 2.93 BEM，Behemoth 6 台/4.626 BNB/日产 2.198 BEM，数字随行情实时变化。

## 复核

93.bitmap 两条视频（英文第二集、第三集）已按 08-26 记录里对同作者视频的处理方式（教学中心，非生态更新流；标注为"仅社区视频参考"）收录。GatePilot 按用户明确指示以社区工具收录，标注钱包连接、站内流片、租赁均为真实可签名操作。
