# TapeOut 社区内容审核记录（2026-08-29）

用户转来 4 条推文，逐条真实打开核实后处理如下：

| 内容 | 来源 | 结论 | 处理 |
| --- | --- | --- | --- |
| 科普第五集·中文（V2 开发者插槽/题目竞争范式转移） | x.com/93bitmap/status/2093540774495531158 | 93.bitmap 与创始人 @Blonskr 交流后修正的内容，讨论 V2 方向。措辞上明确"V2 特性以官网未来正式公告为准"，避免把路线图讨论当成已发布规则。 | 新增 `community-93bitmap-video-ep5-zh` |
| 科普第五集·英文版 | x.com/93bitmap/status/2093704731021685205 | 同一集内容的英文配音版本 | 新增 `community-93bitmap-video-ep5-en` |
| TapeOut 防骗要点清单 | x.com/93bitmap/status/2093276579761897980 | 简明防骗清单（不轻信私信代设计/代流片、第三方工具小额钱包+可撤销 approve、警惕仿盘代币/NFT），获创始人 @Blonskr 转发致谢。与近期巡检反复出现的 Telegram 冒充钓鱼信号相呼应，属于站内"safety"阶段的优质材料。 | 新增 `community-93bitmap-scam-guide`（stage: safety） |
| TapeOut VIP 实时数据看板 | x.com/GuoBTC/status/2093577963178795408 | 已真实打开 tapeout.vip 核实：中/英/韩三语，矿机总数、已验证/未验证权重、挖矿进度、BEM 价格/市值/FDV、双边买卖盘、逐题目 Rank #1 首创者榜、钱包排行榜、热门题目排名；页面文本与按钮均未发现钱包连接/签名交互，判定为只读。创始人 @Blonskr 曾转发致意。 | 新增 `tool-tapeout-vip`（category: data） |

学习目录版本 bump 至 `2026-08-29`（19 条治理资源，`assert_learning_contract.mjs` 的硬编码总数同步从 16 改为 19）；生态工具目录版本同步 bump（15 个工具）。

> 观察：TapeOut VIP 的"逐题目 Rank #1 首创者"榜单意味着作者已经做了类似 tapeout.pro 的字节码级解码，能算出真实门数/深度/H 权重，而不只是电路计数。这与本站"电路计数排行榜"是互补而非重复的两种口径，值得作为后续"要不要投入解码工作量"的参考案例记在这里。

## 追加：bemotc.com OTC 挂单市场

用户转发 x.com/Web32049/status/2093705177123709240 提到的 bemotc.com。真实打开核实：BNB Smart Chain 上的 BEM/USDT 点对点挂单市场，买卖双方自主报价、资产挂单时锁入合约、成交链上原子结算，目的是让大额交易不冲击流动性较浅（约 $150K）的 AMM 池价格。双边各收 1% 费率。

安全要点：需要在 dApp 钱包浏览器内连接钱包，挂单/吃单都是真实链上交易；**网站自己公开声明合约尚未经过独立第三方审计**，此为未消解的公开风险，安全说明中如实标注。新增 `tool-bemotc`（category: marketplace）。生态工具目录 16 个，版本 reviewed_at 更新至 15:15。
