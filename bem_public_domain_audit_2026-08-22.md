# $BEM 公开数据域审计（2026-08-22）

## 官网 $BEM 挖矿页

公开入口：`https://tapeout.net/pod/`。

页面明确展示并自称为 **$BEM Proof of Design 挖矿**。可公开读取的聚合指标包括全网日产出（7200 BEM）、在挖矿机 / 已验证矿机、已验证池与未验证池的权重、累计已铸、永久放弃数量，以及全网事件流。当前页面同时提供“挖矿”“题库”“算法”导航与“算力怎么算”的说明入口。

官网公开合约：

| 对象 | 地址 | 页面说明 |
| --- | --- | --- |
| BEM 代币 | `0x5ce033B2bFCa3Af30b3e8C8457DeaF776A8b695a` | BEM 余额与代币资产 |
| 矿池 PodMining | `0x7E2E0DC66a3bD9103E69b766afA62d9f7b697b46` | 产出、题目、算力 |
| PodLens | `0xdD20B9537b9f5DB9d2A23E6B11Ad863cF81930d8` | 只读算力预览 |

页面公开强调：矿工操作会触发钱包签名 / 交易；Dashboard 只做只读数据展示，不应触发 arm、start、claim 或任何钱包操作。

## 已确认的产品缺口

现有 Dashboard 只有官网 `/pod/` 入口链接，尚未提供：

1. $BEM 矿池全网指标、验证池结构、累计铸造与放弃数据；
2. $BEM 价格 / 流动性 / 交易池信息；
3. 267 道公开题库及难度 / 状态 / 分配信息；
4. 算力算法与“算力怎么算”公式的结构化解释；
5. $BEM 数据源健康状态、刷新时间与降级说明。

## 数据边界

官网页面本身是公开证据，但稳定接入应优先读取 PodLens / PodMining 的只读合约方法、可验证日志和已配置的稳定 BSC 节点；不能依赖钱包态网页的渲染值。$BEM 价格需要单独核验 PancakeSwap 池地址 / 可验证链上储备或使用具备配额的行情 API。题库与算法需要从官网公开前端或只读合约中确认字段和方法，不能凭 UI 文案猜测。

## 来源

- https://tapeout.net/pod/
- https://bscscan.com/address/0x5ce033B2bFCa3Af30b3e8C8457DeaF776A8b695a
- https://bscscan.com/address/0x7E2E0DC66a3bD9103E69b766afA62d9f7b697b46
- https://bscscan.com/address/0xdD20B9537b9f5DB9d2A23E6B11Ad863cF81930d8

## 已定位的正式公开数据源

官方前端在 `https://tapeout.net/pod/` 下使用以下静态公开资源：

| 资源 | 用途 | 已验证字段 |
| --- | --- | --- |
| `/pod/pod-mainnet.json` | 主网配置与上链题目清单 | `rpc: /rpc`、主网链 ID 56、PodMining / PodLens / BEM 地址、`startTime`、三个可采矿 CPU 的倍率、267 道可上链任务的任务级 `refCost` / `refArea` / `refGates` / `refDepth`。 |
| `/pod/pod-taskbank.json` | 完整题库 | 总计 306 题、267 道可上链题、222 道组合题、84 道时序题、题目分组、难度、门数、NAND / LATCH、深度、参考成本 `Cref`、运行 gas 与上链可用性。 |
| `/pod/pod-probe.json` | 题目输入 / 输出探针向量 | 按输入输出规格与时序类型组织的验证向量。 |
| `/pod/pod-miners.json` | 官网维护的矿工索引 | `generatedAt`、链上区块、矿工记录总数与钱包到 CPU / Circuit / taskId / 区块的映射；当前 `count` 为 639。 |

官网主网配置明确包含：PodMining `0x7E2E0DC66a3bD9103E69b766afA62d9f7b697b46`、PodLens `0xdD20B9537b9f5DB9d2A23E6B11Ad863cF81930d8`、BEM `0x5ce033B2bFCa3Af30b3e8C8457DeaF776A8b695a`。官网页面的 `/rpc` 代理应优先作为公开只读链上数据入口，并配合缓存与失败降级。

公开前端 ABI 显示可读矿池方法包括 `minerCount`、`verifMinerCount`、`currentRate`、`dailyEmission`、`totalForgone`、`totalMined`、`totalUnverWeight`、`totalVerifWeight`、`taskCount` 与 `UNVERIFIED_BPS`。此前直接对 PodMining 使用候选方法探测发生 revert，需要改为依据官网 config 使用 `/pod/rpc` / PodLens 的实际方法归属，并逐项验收，不能将失败调用包装为零值。

## 价格源初验

DexScreener 公开令牌端点返回 BSC 上的 PancakeSwap 交易对。流动性最高的 BEM / USDT V3 对为 `0x2f5ec19ab0583D3FCd9bcbcD9AB416d2858EeA38`，可提供 USD 价格、24 小时成交额、买卖笔数、24 小时变动与流动性。该源应标为外部聚合行情、设置短缓存和最后成功快照；官网同时警示早期流动性很浅，价格波动剧烈。

来源：
- https://tapeout.net/pod/pod-mainnet.json
- https://tapeout.net/pod/pod-taskbank.json
- https://tapeout.net/pod/pod-probe.json
- https://tapeout.net/pod/pod-miners.json
- https://api.dexscreener.com/latest/dex/tokens/0x5ce033B2bFCa3Af30b3e8C8457DeaF776A8b695a

## 矿池指标：正式统计快照与链上回退的实际归属

官网前端的 `pod-mainnet.json` 里的 `rpc: "/rpc"` 是相对**根域名**路径。前端逻辑为 `window.location.origin + Y.rpc`，所以实际只读 RPC 为 `https://tapeout.net/rpc`，而不是 `/pod/rpc`。已用 `eth_chainId` 验证根路径返回 `0x38`（BNB Chain 56）；`https://tapeout.net/pod/rpc` 返回 HTTP 405，不能作为生产端点。

官网 `$BEM` 页面最先读取 `https://tapeout.net/pod/pod-stats.json`，并且只在该文件的 `generatedAt` 距当前时间少于 180 秒时使用该快照；文件失效或无法读取时，页面才通过 `https://tapeout.net/rpc` 直接调用 **PodMining**（不是 PodLens）的 `totalVerifWeight`、`totalUnverWeight`、`currentRate`、`minerCount`、`verifMinerCount`、`UNVERIFIED_BPS`、`totalForgone`、`totalMined`、`startTime`、`OWNER_HEAD_START`、`owner`、`taskCount`。

`pod-stats.json` 最新已核验样本（`generatedAt: 2026-08-22T17:15:10.992Z`）包含：`block` 117462283、`totalVerifWeight` 662302、`totalUnverWeight` 24688、`currentRate` 8333333、`minerCount` 3618、`verifMinerCount` 3192、`unverifiedBps` 100、`totalForgone` 11185582882、`totalMined` 668860863879、`taskCount` 267、`tasksFrozen: true`，及最近流片事件。生产实现应以此为第一方公开短时快照，在其超过 180 秒或获取失败时才对根 `/rpc` 的 PodMining ABI 做受限只读回退；任一路径失败时均保留最后成功快照并明确标记陈旧。

来源： https://tapeout.net/pod/pod-stats.json；官网前端 `main-DIOads7I.js` 的 `yi` 数据读取函数。

### 链上交叉核验

已对官网根 RPC `https://tapeout.net/rpc` 进行单批 9 项 `eth_call`，目标均为 PodMining。实时读数为：验证权重 662659、未验证权重 24688、当前速率 8333333、在挖矿机 3621、已验证矿机 3195、未验证基点 100、永久放弃 11185582882、累计已铸 668986464008、已上链任务 267。与 `pod-stats.json` 比较，速率、未验证权重、未验证基点、永久放弃和任务数完全一致；验证权重、矿机数及累计铸造因官网快照滞后数分钟而发生符合预期的小幅变化。由此确认上述九个公开指标均归属 PodMining，且官方统计快照是可安全优先采用的第一方快速源。

## 官方公开算法与公式

官网算法页的原文将算力概括为：永久烧掉的工本，加上设计相对参考实现的改善，再乘处理器系数。公开展示的规则为：

- 工本：`b* = n + λ·m`，其中 `n` 是本层真烧 NAND，`m` 是本层真烧 LATCH；
- 面积：`A = g + λ·s`，其中 `g` 是递归元件总数，`s` 是递归 LATCH 总数；
- 成本：`C = A · max(d,1)^β`，其中 `d` 是递归穿透引用后的关键路径深度；
- 质量：`q = clamp(C_ref / C, 1/Q, Q)`；
- 算力：`H = (b* + K_task·q) × P`，其中设计溢价 `K_task·q` 只给予最优首创。

官网说明参考实现是“教科书级的直接实现”，既不刻意做差、也不极限优化；其朴素程度是公开的政策旋钮。产品页应把以上内容标为**官方公开规则说明**，不得把公式用于自行预测收益，不得将尚未由公开参数文件或链上读取验证的 `λ`、`β`、`Q` 的数值写成确定事实。组合题与时序题均来自同一题库；时序题会以从全零状态起跑并逐拍比对的方式验证。题库的 `K`、`Cref`、`refNand`、`refLatch` 与 `refDepth` 字段可直接展示为官方静态参考数据。
