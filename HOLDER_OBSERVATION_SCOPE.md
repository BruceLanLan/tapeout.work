# TapeOut 公开持仓观察：实体与证据边界

**参考时间：**2026-08-25（北京时间）。本功能的目标是让用户查看 TapeOut 晶体管资产的公开持仓地址、余额、历史快照变化与可验证交易明细；它不是对实际控制人、投资人、官方意图或未来价格的判断。

| 实体 | 类型 | 公开证据状态 | 在功能中的用途 |
|---|---|---|---|
| TapeOut Protocol | BNB Chain 上的协议与公开 Registry | 现有平台已按官网公开 Registry 采集 | 只作为协议范围与公开处理器语境，不用于归因钱包身份 |
| TapeOut NAND / LATCH | 可交易晶体管资产 | 需要从官方链上合约或可信公开市场响应核验完整合约地址、decimals 与余额 | 仅在地址、合约、余额和快照可复算后提供榜单 |
| TapeOut Market | 协议资产交易入口 | 页面自称为交易服务平台；官网身份和合约地址仍应逐项核验 | 可显示公开市场链接与行情辅助信息，不把报价当官方估值 |
| Firsto TapeOut | 第三方市场界面 | 公开页面显示订单簿、成交和资产摘要 | 仅作市场交叉核验；不把其地址余额或持有人数字当链上唯一真值 |
| TapeOut Club | 非官方社区工具 | 页面明确声明与官方无隶属关系，并说明部分算力/收益为推算 | 可作为“社区工具”入口；其算力和席位推算不能替代官方或链上事实 |
| 用户提供的 BEM / Genesis CPU 表格 | 外部截图 | 含地址、余额、实体性质和链上行为解读，但不是可重放的数据接口 | 仅作为待核验的地址候选和产品需求样例；不会直接写入持有人标签 |

## 不可穿透与不可推断规则

1. 地址是路由、LP、合约或多签，且没有公开证据说明最终受益人时，展示为 `router / contract / LP — no beneficial-owner attribution`。
2. `官方` 仅能来自 TapeOut 官网公开标签或链上可验证的协议/合约角色；不能因截图、群聊、买卖行为、创建交易或大额余额而推断。
3. 余额快照、变化、持有人数量和交易明细必须附带 `observed_at`、合约地址、资产符号/decimals、来源和覆盖范围。缺少前一快照时只显示当前值，不显示伪造的 24 小时变化。
4. 原始 token 单位与 BNB 成交额、收入、估值、收益率严格分开；任何第三方市场价格均明确为第三方市场数据。
5. 页面不会显示私钥、助记词、用户钱包连接、交易或签名功能，也不输出买入/卖出建议。

## 当前公开来源核验结论

| 来源 | 已确认的公开能力 | 使用限制 |
|---|---|---|
| `https://tapeout.market/` | 展示 TapeOut / Behemoth 晶体管市场、公开价格与学习解释 | 需要从链上或官网另行核对资产合约、订单和成交事件；页面自身不是地址归因证据 |
| `https://tapeout.firsto.ai/` | 展示公开订单簿、近期成交、资产摘要与持有人地址数量 | 是第三方数据面；应将市场数据标作市场快照，并用链上余额或官方合约读数交叉核验 |
| `https://tapeout.club/` | 社区算力排行榜、链上电路检查、题库与公开方法说明 | 页面明确为非官方，并说明算力、席位和预计产出中含推算；不接入收益预测或未核验地址标签 |

> 用户截图中的“LP”“路由（投资人）”“官方”“矿工”等文字不作为本平台的标签来源。只有能指向公开合约角色、官方网站标签或可复算链上事件的部分，才可能进入展示层。

## 初步技术发现（被动读取，待接口复核）

`TapeOut Club` 的公开前端脚本存在同源数据拉取逻辑，按页面当前签名参数在 `data.json` / `data` 之间选择；该发现只说明页面有数据载荷，不等于授权本平台无限制抓取，也不等于其持仓或预计产出是官方数据。`Firsto` 的公开页面可见资产层面的订单簿、近期成交、地址持有人数量、累计铸造/燃烧与市场合约摘要；这些字段可作为市场辅助观察候选，但每个字段必须以返回的合约、区块和时间戳再核验。`TapeOut Market` 公开展示 NAND/LATCH 报价和生态说明，但从静态页面尚不能确认可复用的持仓地址 API。

## 已保存的公开接口与链上核验（2026-08-25）

| 项目 | 可复核发现 | 边界 |
|---|---|---|
| Firsto 前端公开配置 | 公共 Vite 前端声明 API 基址 `https://api-tapeout.firsto.ai`、流基址 `https://stream-api-tapeout.firsto.ai`；可见只读路径包括 `/v1/markets`、`/v1/market/{transistor}/{NAND|LATCH}/overview`、`/v1/circuit-trades` | 公开 API 当前返回 `503 {"code":"request_failed","message":"Factory market catalog is not ready"}`；因此不能作为持仓榜单主源，须单独 health/stale/last-success 降级 |
| TapeOut 晶体管 | 公共市场页披露晶体管合约 `0xCC42ba5De07f01B472a5b14cF45aBcCA79Eb8087`，处理器 `0xb1024b89886B9a34Aa4ff5F31C411D708b20a14C` | 完整持仓需从链上事件重建；不能将市场前端的 holderCount 当作地址明细 |
| Behemoth 晶体管 | 公共市场页披露晶体管合约 `0xE2DfD802081C7a05341e20b6582b04b908e8550c` | 同上 |
| Genesis CPU 晶体管 | 公共市场页披露晶体管合约 `0x1d23Bf70ec6bAAD95f396Ea38f8A8415119dFDE6` | 同上 |
| 三个晶体管合约的代理结构 | 三者在 BNB Chain 56 上均使用 beacon `0xa528e147d7e065249fc52864502c9b245c6c9f66`，`implementation()` 返回 `0x32e1fa125b6abe0ff12eec43e2dab482019a1e97` | 代理/实现均来自公开 RPC 只读查询；Sourcify 当前未提供上述地址的 verified metadata，因此 ABI 需通过事件与链上行为验证 |
| $BEM | 现有 Worker 已核验 token `0x5ce033b2bfca3af30b3e8c8457deaf776a8b695a`；公共 RPC 返回 `name=BEM`、`symbol=BEM`、`decimals=8`、总供应原始值 `2366135221846`，区块 `117971698` | `eth_getLogs` 5,000 区块窗口触发公共 RPC limit exceeded；需采用受限区块窗口、增量游标和 D1 快照，不能无界扫描 |
| 晶体管转移事件 | ERC-1155 常见 `TransferSingle` / `TransferBatch` 主题是候选路径；500 区块合并主题请求被公共 RPC 以 `limit exceeded` 拒绝 | 必须再缩小窗口并分别验证事件类型，未验证前不计算地址余额 |

公共 BNB RPC `https://bsc-dataseed.bnbchain.org` 对该晶体管合约的 `eth_getLogs` 请求，即使将范围缩至最近 10 个区块并按 ERC-1155 `TransferSingle/TransferBatch` 主题过滤，仍返回 `limit exceeded`。这说明该公共端点当前不适合作为本功能的唯一历史事件源；后续需要验证独立备用 RPC 或公开索引服务。功能上线前必须将这种情况呈现为 `source_error / stale / last_success`，不能把它解读为“无交易”或“地址余额为零”。

## 日志与持有人来源的可用性结论

BNB Chain 官方 JSON-RPC 文档明确说明：其列出的 Mainnet 端点禁用 `eth_getLogs`，频繁拉取日志应使用第三方端点或 WebSocket。PublicNode 公开列出 `https://bsc-rpc.publicnode.com` 作为 BSC Mainnet RPC，并声明提供 archive access；它是下一步只读日志兼容性测试候选。BscScan 的公开代币页可显示 TapeOut 晶体管 holderCount（页面观察到 1,078）和市场摘要，但请求原始 HTML 时收到 403。BscScan/Etherscan 官方文档确认其 ERC-20 `tokenholderlist` 是需要 API key 的 Standard Plan 及以上端点；并且该特定文档只适用于 ERC-20，不能替代晶体管 ERC-1155/代理资产的 ID 级持仓重建。

## 进一步的持有人数据源验证

1. `https://bsc-rpc.publicnode.com` 可成功返回当前区块与最近区块范围内的该晶体管合约事件查询；无主题的最近 1/100 区块查询正常返回空集合，说明端点可用但该窗口没有可见的标准转移。该端点对 `TransferBatch` 主题过滤返回 `Invalid params`，因此若采用该源，需要无主题小窗口再本地过滤，或配置支持日志索引的专用提供商。
2. PublicNode 的历史 `eth_getCode` 二分查询返回“Archive requests require a personal token”，所以无法用其免费公共端点定位部署区块或无界回放历史。
3. BscScan 公开 iframe 路径 `generic-tokenholders2` 可由页面提取器显示排名、余额、比例和总 holder 数，但会去除地址链接；原始 HTML 请求返回 403。它可用于人工交叉核验总数，不能作为生产级、可复算地址榜单源。
4. TapeOut Club 的 `/data.json`、`/sim.json`、`/solutions.json` 无会话原始请求返回 403；该站可保留为社区工具入口，但当前不能用作本平台持仓数据后端。

**因此：**在没有经授权的索引/RPC 服务之前，不能负责任地发布“完整前排晶体管地址明细”或过去 24 小时持仓变动。可以先发布链上能力与来源状态页，但不能用截图、被截断网页或推断地址填充榜单。

## TapeOut Club 浏览器公开页观察（2026-08-25）

使用正常浏览器访问 `https://tapeout.club/` 成功加载，页面明确自称“非官方社区站点”，并写明“榜单由本站第三方推算，不是官方数据”。其首页公开呈现全协议处理器算力排行榜：页面显示 `9,050` 颗、榜上 `8,195` 台、每 15 分钟自动同步、合约 `minerCount()=8,202`；其中表格将处理器编号、晶体管类别/编号、预计日产出、池状态、链上权重、工本 `B*×P` 和**截断持有人地址**直接显示在浏览器中。页面完整 HTML 已由浏览器保存到 `/home/ubuntu/upload/tapeout.club__1787650528046.html`，可用于被动提取其已加载脚本与公开数据 URL。该数据若接入，应命名为“TapeOut Club 社区推算算力/处理器榜”，而非官方持仓或未经核验实体归因。

### 已验证的免费社区路径（2026-08-25）

TapeOut Club 的公开 HTML 注入短时有效的 `window.__S` 签名配置；同页前端随后以 `fetch('/data.json?e=…&st=…', { credentials: 'same-origin' })` 读取榜单数据，并在签名临近过期时自行刷新页面。以正常页面访问流程复核后，该载荷包含 `board`、`boardMeta`、`gen` 等字段：本次可读到前 400 条处理器榜单、103 个完整公开地址、生成时间、来源区块、总合格电路、榜内矿机数和已验证/未验证池聚合。排行榜渲染逻辑将每行解释为处理器类型、Circuit ID、完整持有人地址、工本 `b*×P`、**预计**日 BEM、池状态、首创席位与链上权重。

接入边界：该路径是 TapeOut Club 在浏览器中公开呈现的社区推算榜单，非 TapeOut 官方 API。它的 400 条是前排行处理器覆盖，不是所有晶体管/代币持有人的完整表；未出现在榜中不能解释为没有持仓。地址只按公开地址展示；不穿透路由、LP、合约或多地址控制关系，也不推断真实个人、投资人或官方身份。预计日产出/工本保留为来源字段，附带“社区估算、非收益承诺”说明。

## 官方三项目地址聚合重构核验（2026-08-25）

用户明确要求地址聚合与持仓分析只覆盖 TapeOut、Behemoth、Genesis CPU 三个官方晶体管项目。BscScan 的公开合约页将三者均标为 BEP-1155，合约分别为 `0xCC42ba5De07f01B472a5b14cF45aBcCA79Eb8087`、`0xE2DfD802081C7a05341e20b6582b04b908e8550c`、`0x1d23Bf70ec6bAAD95f396Ea38f8A8415119dFDE6`；页面在本次读取时显示 holder 总数分别为 1,078、507、666。这些总数仅可作带时间戳的外部交叉核验，不是地址列表或余额快照。

TapeOut Club 的公开浏览器载荷能够显示 TapeOut 与 Behemoth 的 400 条处理器榜行和每行公开地址，但 `board` 的实际资产类型只有 `TapeOut` 和 `Behemoth`；Genesis CPU 只出现在该载荷的市场价格字段，没有地址级榜单。因此该来源不能被包装为三项目完整持仓数据。BscScan 页面虽公开 `tokenholders-nft` CSV 导出链接，但无凭据读取返回 CAPTCHA，不能作为可持续的生产后端，也不会绕过该访问控制。

结论：三项目模块的规范资产范围已可核验；完整地址余额/变化仍必须来自可复算的链上 ERC-1155 转移索引，或对三合约共同可用的、允许后台读取的公开数据源。任何只有 TapeOut/Behemoth 覆盖的社区榜只能作为单独“处理器运营观察”，不能占用官方三项目持仓模块的位置。

## 官网公开快照与三项目范围的进一步核验（2026-08-25）

TapeOut Market 的公开前端配置将 `OFFICIAL_PROCESSORS` 显式列为三项：Genesis CPU（processor `0x50A994E71615474b55559fF4F500928fbc339DD9`，transistors `0x1d23Bf70ec6bAAD95f396Ea38f8A8415119dFDE6`）、Behemoth（processor `0x1F5Cb4aeaE1807Bf60c3b9C0D8aDBCC14e91f12C`，transistors `0xE2DfD802081C7a05341E20b6582b04b908e8550c`）、TapeOut（processor `0xb1024b89886B9a34Aa4ff5F31C411D708b20a14C`，transistors `0xCC42ba5De07f01B472a5b14cF45aBcCA79Eb8087`）。该配置还公开 token IDs：`NAND=0`、`LATCH=1`，并指向官网只读快照 `https://tapeout.net/cpu-stats.json` 与 `https://tapeout.net/market.json`。

`cpu-stats.json` 在本次读取中，对三项官方项目均提供 processor / transistors 地址、最后索引区块、`minterCount`、`holderCount` 和 `minters[{addr,amount}]`。该 JSON **没有** `holders` 或 `balances` 数组：`minters.amount` 是累计铸造记录，不能被命名为当前持仓或当前 NAND/LATCH 余额。只有 `holderCount` 是当前 holder 的聚合数量，不提供可用于完整地址榜的余额明细。

`market.json` 提供三项目的公开买单（地址、晶体管合约、tokenId、价格、remaining）和市场数据；它可以支持“当前公开订单地址/订单变化”观察，但公开买单不是资产持仓。三项目地址级模块可先严谨展示：官方范围、holder 总数、累计铸造地址与数量、公开订单地址与剩余委托；只有当获得可复算的三合约 Transfer/余额索引时才加入“当前持仓前排”和“24h 净持仓变化”。
