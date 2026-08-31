# TapeOut 社区内容审核记录（2026-08-28 第二轮）

延续既有审核方法。用户转发三条 X 帖子（`@something_labs` 的社区工具一览、`@tapeoutmarket_x` 的 AI Advisor 发布、`@dis_404` 的电路验证器发布），要求核实其中有哪些工具值得收录。逐个真实打开网站核实功能与安全边界后，结论如下：

| 工具 | 来源推文 | 结论 | 处理 |
| --- | --- | --- | --- |
| tapeout.firsto.ai / tapeout.club / GatePilot (vibedegens) / tapeout.build / TapeOutGo / TapeOut Market | `@something_labs` 一览 | 已在目录中（`tool-tapeout-firsto`/`tool-tapeout-club`/`tool-gatepilot`/`tool-tapeout-build`/`tool-tapeoutgo`/`tool-tapeout-market`） | 不重复收录 |
| **流片工厂**（tapeoutfactory.com，作者 Benson） | `@something_labs` 一览 | 真实打开确认：连接钱包后可选公开题目图纸，一次流程内批量流片 N 份，每份仍是独立签名交易；页面自己披露若该题目首创加成已被拿走，批量流片只拿普通权重，不构成误导。 | 新增 `tool-tapeout-factory`，标注真实钱包签名、批量执行、不构成首创加成的风险边界 |
| **tapeout.pro 电路验证器 + Census**（作者 dis404） | `@dis_404` 单独发布 | 真实打开确认：全站只读，页面明确写"never asks for a wallet, a signature, or a transaction"；对已流片电路做全输入穷举验算（时序题做全部输入/状态对），比协议自身仅抽样 256 个固定向量更严格；Census 页公开逐矿工判定，全网汇总显示约 17.6% 的已判定算力被标记为与声明题目不等价。该发现已被协议创始人 `@Blonskr` 本人转发认可。 | 新增 `tool-tapeout-verifier`，措辞上明确"mismatch 不代表故意作弊"（作者本人也这样声明），避免我们的转述被解读为坐实作弊指控 |
| tapeout.market AI Advisor 更新 | `@tapeoutmarket_x` | 已有条目（`tool-tapeout-market`）仍准确覆盖该站，AI Advisor 是站内新增页面而非新站点，不需要新条目 | 不改动现有条目 |
| t.me/tapeoutstudy 电路学习小组 | `@something_labs` 一览 | Telegram 群组，非可独立核验的公开页面，且学习资源目录此前只收录可直接查看的网页/视频类资源 | 本轮不收录，留给用户决定是否要放宽学习资源目录的资源形态 |

两个新增条目均为 `community` 层级，安全字段如实标注真实钱包签名/批量执行（流片工厂）与"结论非官方强制判定"（验证器）。目录版本 bump 至 `2026-08-28`。
