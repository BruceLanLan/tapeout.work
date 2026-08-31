# TapeOut 官网更新审计（2026-08-20）

## 已核验的官网公开变化

TapeOut 官网当前公开显示 620 个 Processor；`processors.json` 的 `generatedAt` 为 `2026-08-20T14:26:47.687Z`，同样为 620 条记录。官网首页顶部新增或突出显示了“首款应用：链上 BTC 矿机——实时挖矿，任何人可围观”的公开入口。官网亦继续公开 Protocol 合约、Processor 标签、创建者字段与 Airdrop 导航。

## 与 TapeOut Intelligence 的对照

生产 Dashboard 已于 `2026-08-20T14:25:53.599Z` 成功刷新：当前 D1 快照为 620 个公开 Processor、6,713 个 Circuit；Registry 数据源为健康状态，最近检查距审计时约四分钟。Airdrop 合约汇总也已随计划任务更新至 95 个池、39 个活跃池。

认证索引仍与官网公开显示一致：官网公开的 Official、Certified 与 Community 标签均在 `/api/v1/attestations` 中返回；抽查的示例处理器仍为 `certified`。本轮没有发现允许将新的项目认证或第三方身份推断写入公开标签的额外证据。

## 结论

核心数据不需要手工更新：既有五分钟 Registry / Airdrop 同步已经自动纳入官网的 Processor 与公开合约数据。仅有值得考虑的产品性同步是为官网新增的 BTC Miner 首款应用增加一个“官网应用入口”资源链接；在未取得该入口的稳定公开 URL 前，不应猜测或硬编码链接。

## 公开来源

- https://tapeout.net/
- https://tapeout.net/processors.json
- https://tapeout-public-monitor.tapeout-labs.workers.dev/api/v1/summary
- https://tapeout-public-monitor.tapeout-labs.workers.dev/api/v1/data-health
- https://tapeout-public-monitor.tapeout-labs.workers.dev/api/v1/attestations

## 更新前后实际影响审计

生产快照历史显示，在 `2026-08-20T14:00:54.801Z` 至 `14:05:53.599Z`，公开 Registry 已捕获两条新增 Processor（Lifeblock、阿塔拉）及随后字段变化；此后持续以五分钟节奏记录 Genesis CPU、TapeOut、PAYCORE 等公开变化。`2026-08-20T14:40:53.599Z` 时生产快照为 620 个 Processor、6,716 个 Circuit，且当日协议脉冲已包含 22 个新增处理器、91 个新增 Circuit。

因此，官网 Registry 更新对 Dashboard 的数据层最大影响仅为上游变更到下一次成功五分钟检查之间的短暂滞后；审计中未发现持久性缺失。Airdrop 数据源亦显示为健康，并在同一运行周期更新 / 确认无变化。更新前的唯一产品缺口是 Dashboard 没有暴露官网新增 BTC Miner 应用的发现入口；该入口已在提交 `6c234ac` 中补充。

来源：
- https://tapeout-public-monitor.tapeout-labs.workers.dev/api/v1/analytics?impact_audit=1
- https://tapeout-public-monitor.tapeout-labs.workers.dev/api/v1/changes?impact_audit=1
- https://tapeout-public-monitor.tapeout-labs.workers.dev/api/v1/events?page_size=100&impact_audit=1

## 官网市场模块（补充审计）

官网 `#market` 当前公开显示“晶体管交易市场（1422）”，提供每个晶体管市场的代币 / NAND-LATCH 类型、成交价、24 小时变化、在挂买量和合约地址；页面还包含晶体管市场与电路市场标签页、搜索及型号筛选。官网明确提醒：代币名称可以重复，只有官网展示“官方”或“已认证”标记的项目才为真。

这构成了对 Dashboard 的潜在新增维度：公开市场目录、官方 / 已认证子集的最新成交价、24 小时变化和挂买量。当前 Dashboard 的 Market 源仍处于 `not_configured`，只采集 Circuit Market 的计划方向，且没有这个晶体管市场目录 / 行情层。任何正式同步须先定位官网用来生成该目录的稳定公开 API 或获得具备配额保障的 BSC 市场索引服务；不得从浏览器页面或无配额公共 RPC 临时抓取并当作稳定行情。

来源：https://tapeout.net/#market

## 全量更新审计（2026-08-22）

官网公开 Registry 已增至 711 条，`generatedAt` 为 `2026-08-22T16:44:54.046Z`。Dashboard 于 `16:45:53.597Z` 完成同步，并返回相同的 711 条处理器、10,591 个 Circuit；Registry `status=healthy`、检查与数据年龄为零分钟。因此新增 Processor、Mint、Circuit 字段已经自动纳入，不需手工回填。

官网导航当前突出新增 `$BEM 挖矿`：公开文案为“用 NAND 门设计电路来挖矿，链上验证，越优的设计权重越高”。此前添加的 `#mine` 链接仍指向 BTC Miner 页面；官网出现了独立的 $BEM 挖矿入口，应进一步精确核验其目标 hash / 数据接口后，再替换或新增 Dashboard 应用入口，不能假定它等同 BTC Miner。

官网市场当前公开显示 1,422 个晶体管市场，并提供价格、24 小时变化、挂买量、型号筛选与官方 / 已认证标记。Dashboard 尚未覆盖这一市场目录 / 行情维度，且 Market 采集仍 `not_configured`。这应列为下一优先级功能，但在未定位稳定公开目录 API 或配额保障的市场索引源前，不应直接抓取 UI 或把公共 RPC 临时输出展示为实时市场数据。

官网空投当前为 100 个池、40 个活跃池，Dashboard 的独立合约读取亦同步为相同值且健康。

来源：
- https://tapeout.net/processors.json
- https://tapeout.net/#market
- https://tapeout-public-monitor.tapeout-labs.workers.dev/api/v1/summary?full_official_audit=1
- https://tapeout-public-monitor.tapeout-labs.workers.dev/api/v1/data-health?full_official_audit=1

## $BEM 路由核验与同步动作

通过渲染官网首页 DOM，已核验 `$BEM Mining` 的正式公开入口为 `https://tapeout.net/pod/`，而非早期 BTC Miner 的 `#mine` 页面。Dashboard 已将官网应用链接改为该正式 $BEM 路由，并补充 `https://tapeout.net/#market` 的晶体管市场链接。

本次仅同步官方应用与市场的发现入口。$BEM 的设计权重、链上验证详情以及晶体管市场行情目前尚未找到可证明长期稳定、可配额管理的公开 API；在该条件满足前，Dashboard 不会把官网网页显示值伪装为自行采集的实时指标。
