# TapeOut Intelligence UI/UX Loop Audit — 2026-08-24

## 生产桌面首屏与协议脉冲审计

生产地址：`https://tapeout-public-monitor.tapeout-labs.workers.dev/?v=ux-loop-20260824`。审计基于中文桌面真实渲染与公开生产数据。

| 优先级 | 发现 | 体验影响 | 本轮修复方向 |
| --- | --- | --- | --- |
| P0 | Hero 中文标题占据过高的首屏面积，数据方法文案与 Hero 正文重复讲述 Day 1 / D1 边界。 | 首次到访者需要滚动后才看到产品实际能力，数据页面像品牌海报而非研究工具。 | 降低 Hero 中文标题字号和最小高度；把方法说明压缩为可扫读的单行证据标识。 |
| P0 | 顶部文字导航字号与点击热区偏小，和右侧链 / 更新状态相比视觉权重不足。 | 新用户难以一眼发现教学、$BEM、协议动态、处理器和 API 的主路径。 | 放大点击热区和导航文字，使用一致的药丸式激活 / hover 状态。 |
| P0 | 协议脉冲两卡片已实现标题与外框对齐，但左卡的强制拉伸留下无信息的大块空白。 | 左侧像未加载内容，右侧图表与左侧摘要之间缺少共同的阅读节奏。 | 不再仅靠拉伸外框；以轻量“本周期阅读”洞见、覆盖说明和指标分组填充左卡的下半部。 |
| P1 | 右侧四个时间选择器的标签、控件与图表过密，且窄列中标签被压缩。 | 用户首次面对多个维度（范围、粒度、时区、指标）时认知负担偏高。 | 改用带序号的紧凑筛选器分组，缩短标签和说明；保留原生 select 以保证可访问性。 |
| P1 | 热力图与空投现在数据语义正确，但在协议脉冲首段的位置与摘要卡缺少视觉桥梁。 | 用户看见图但不容易理解其与柱图共享过滤条件。 | 增加紧凑的“共享范围”标识和摘要文案，避免重复长说明。 |

## 不在本轮伪修复的事项

1. D1 覆盖仅有约 5 天，不能为了填充柱图或热力图而伪造监控前数据。
2. 原始来源单位继续降级呈现，不能以交易额、收入或估值替代。
3. $BEM 第三方聚合行情和协议 Registry 指标继续严格分区。

## 视觉基线

桌面宽度 1440px；首屏与协议脉冲区应在单次视野内呈现协议定位、核心规模、主要时间分析和清晰的下一步入口。移动端后续以 390 CSS 像素为回归基线。

## 第一轮本地视觉复核

桌面截图确认 Hero / 协议脉冲改造后，时间筛选器不再挤进标题行；左侧摘要新增“如何阅读当前周期”区块，避免只靠强制拉伸形成大面积无信息空白。桌面端仍需在非锚点视口复查首屏完整构图，因简单 headless `#protocol-pulse` 截图会保留锚点定位产生的上方空白，不能将该空白误判为页面缺陷。

简单 headless 390px 截图未正确模拟移动设备布局，截取结果近乎空白；该工具路径不作为产品结论。下一轮将采用已有 CDP 脚本的真实 CSS 视口与加载后滚动方式复核移动端。

## 第一轮脚本化真实视口复核

桌面 1440px：Hero 高度已经明显收敛，核心规模卡与协议脉冲可在同一首屏连续阅读；右侧时间筛选器从标题行移出，四个筛选器按逻辑组合。左卡的阅读引导填补了无信息空白，且与热力图形成明确下一步入口。左右卡标题、说明与外框仍保持同一基线。

移动 390px：页面无横向溢出；协议脉冲按单列顺序展示，四个核心指标保持 2×2 可扫读格局。发现两个 P1 细节待进入第二轮：第一，市场未配置提示仍占用多余垂直空间且其边界和阅读指引产生双重横线；第二，阅读引导的英文 label 与主句在窄屏视觉间距不足。下一轮将把市场未配置改为紧凑状态标签，并明确阅读引导的 label / 主句层级。

## 第二轮真实视觉复核（独立 UX 样式资产）

独立 `ux-loop.css` 置于所有历史样式之后后，移动端阅读引导已按 label、主句、行动入口三层展示，市场未配置状态收敛为一行辅助信息；不再与主阅读路径形成重复边界。真实 390px 视口仍无横向溢出。

桌面 1440px：Hero 后的协议脉冲区形成完整的左至右阅读路径——范围摘要、四个可比较指标、轻量市场状态、如何阅读当前周期、右侧范围/粒度/时区/指标筛选、柱图与覆盖说明。左右卡底线对齐；热力图的真实六个观察桶与柱图共享同一筛选范围。筛选器在宽屏上以 4 列呈现，标签未再挤压标题区。

结论：第一轮的 P0 和第二轮的 P1 细节均通过真实视觉复核；可以进入契约回归、生产部署与继续观察阶段。

## 生产复核 — UX Loop r4

生产页面已加载独立 `ux-loop.css`。中文真实渲染确认：协议脉冲左右面板标题、内容起点和底线一致；左侧市场未配置仅作为辅助状态行；阅读引导完整呈现“如何阅读当前周期 / 柱图看变化，热力图看节奏 / 查看强度热力图”。右侧四个筛选器从标题行独立，柱图与热力图均使用同一 6 个实际日桶。教学入口、$BEM 风险前置和空投原始单位降级仍保持正常。

## 教学中心压力测试：生产复现

以 360 / 390 / 412 / 768 / 1024 / 1440 像素、中文/英文、9 组资源筛选组合执行 108 次生产浏览器检查。98 次通过，10 次失败；其中 9 次为 **768px 英文** 的真实横向扩展（`scrollWidth: 880px`），学习路径与签名前检查仍按双列并排，截图可见页面横向滚动。另 1 次为首个语言切换尚未完成水合的测试假阳性，已在测试脚本中改为等待六步路径和五项安全清单完成渲染。

修复策略：将教学中心的单列断点上调到 860px，所有学习容器、资源卡和筛选控件使用 `min-width: 0 / max-width: 100%`，并对英文长文本允许安全换行。该规则在重启干净本地 Worker 后进行全矩阵复测。

## 教学中心压力测试：修复后全量通过

在加载 r4 学习样式与 r5 外壳样式的干净本地 Worker 上，重新执行完整 108 组矩阵：6 个宽度（360、390、412、768、1024、1440）× 2 种语言 × 9 个来源/阶段/语言筛选组合。结果为 **108 / 108 通过，0 失败**。所有组合同时满足：学习路径为 6 步、安全清单为 5 项、筛选控件为 3 个、页面 `scrollWidth ≤ viewport`、教学中心及其子元素无横向越界。

最终视觉复核：390px 中文默认状态下三张起始卡、路径卡和安全面板以单列连续阅读，没有裁切；1440px 中文默认状态下三张起始卡、左侧六步路径、右侧安全检查与资源区维持清晰的双栏节奏。768px 英文此前的双栏外溢已消除；处理器宽表被限制在自身横向滚动容器内，不再撑宽应用外壳。

## 教学中心加载竞态与生产复测策略

首次生产 108 组压力测试在最后的 1440px 组合出现资源卡为 0 的状态。接口随后连续返回 200（约 2.8–4.0 秒），因此该失败不是布局越界，而是固定 540ms 等待与三个筛选器连续触发三次请求造成的慢响应/旧响应测试误判。修复为：

1. `loadLearning` 采用单调 `learningRequestId`，仅最后一次请求可写入界面；
2. 三个下拉筛选合并为 120ms 的单次刷新；
3. 资源渲染写入当前 `tier|stage|language` 完成标记，压力测试等待匹配标记和资源/空态渲染后才检查布局。

在干净本地 Worker 上，带真实响应等待的完整 108 组矩阵再次达到 **108/108 通过**。该策略会用于生产复测，防止把网络响应时间误报成布局溢出，同时仍要求任何实际横向越界为失败。

## 教学中心生产最终压力复测

筛选竞态修复及 `learning-r5` 版本化脚本上线后，对生产站点执行完整 **108 组** 高强度矩阵：6 个视口（360、390、412、768、1024、1440）× 2 种语言（中文、英文）× 9 个来源/阶段/语言筛选组合。测试等待每次匹配筛选的真实响应及渲染标记后再测量。结果：**108 / 108 通过，0 失败**。

每一组都验证：学习路径 6 步、安全清单 5 项、筛选控件 3 个、资源卡或明确空态已完成渲染、所有教学容器与文本不越出视口、文档总宽不大于视口。由宽处理器表造成的平板外壳扩展已收束到内部表格滚动；教学中心的 768px 英文、360px 中文和 1440px 双语状态均未见横向溢出或卡片错位。

## 生产视觉复核：教学中心仍存在的格式问题

用户反馈在此前压力矩阵后仍有可见的教学中心“格式爆出”。生产真实页面复核表明，原矩阵只覆盖几何越界，未能衡量视觉层级崩坏。当前需要修复的真实体验问题包括：

1. 教程资源筛选器在宽屏和中间宽度仍将标签与选择器横向塞在同一行，导致“来源 / 阶段 / 语言”标签被极度压缩、逐字竖排；虽未突破视口，但属于不可接受的格式失败。
2. 学习路径与安全检查在同一网格行被默认拉伸，安全卡在清单之后出现大面积无意义空白，阅读节奏断裂。
3. 教学面板头部在长标题或窄宽度下仍需显式改为可换行/可堆叠的结构，不能仅依赖通用 panel-head 的 flex 收缩。
4. 资源卡、阶段标签和外链需要独立的密度与换行规则；几何不溢出不等于视觉可读。

后续验收将增加“筛选标签不逐字竖排、面板不被无意义撑高、头部/资源卡在不同宽度维持可扫描层级”的视觉规则，而不仅检查 `scrollWidth`。

## 教学中心视觉修复第二轮：人工截图复核

已在本地真实 1440px 桌面与 390px 手机视口检查第二轮视觉样式。结果：

- 桌面资源筛选区的“来源 / 阶段 / 语言”标签改为各自独立的上下结构，不再被压缩为逐字竖排；选择器与搜索框形成清晰的四块节奏。
- 资源卡的来源层级与阶段信息改为纵向堆叠，长阶段组合不再与来源徽章争夺同一行宽度。
- 安全检查卡按自身内容高度结束，官方 Q&A 链接紧跟清单；学习路径与安全卡之间不再以无意义的同高拉伸制造巨大空白。
- 390px 下，入口图三张卡、路径、风险面板和资源筛选按单列顺序阅读，标题与外链没有横向突破。

该轮的视觉目标从“容器不越界”升级为“控件、文字和层级不出现可见挤压”。

## 教程资源区定点复核

第二轮定点截图显示，1440px 下搜索、来源、阶段和语言被组织为四个可扫描控件，标签保持水平单行；资源卡来源徽章与阶段说明纵向排列，长英文标题和摘要在卡内断行。390px 下搜索框独占首行，三个选择器按两列排列，资源卡改为单列；未发现标签逐字竖排、卡片右侧截断、外链越界或页面横向扩展。

## 教学中心视觉修复第二轮：生产复测

`learning-r6` 上线后，生产定点截图在 1440px 与 390px 下确认筛选标签、资源卡头部和安全面板保持可扫描层级。随后使用带视觉可读性规则的完整生产矩阵再次验证 108 组组合（6 视口 × 2 语言 × 9 筛选）：**108 / 108 通过，0 失败**。本轮除页面总宽度与文本越界外，还检查筛选标签高度不超过单行阈值、安全面板链接与底部之间不存在无意义大空白，以及资源完成渲染后才进行布局测量。


## Learning typography r3 local visual review

- Desktop resource index: heading, explanatory paragraph, filter band and three-column resource grid now follow a consistent vertical rhythm. Source/stage/language labels retain a dedicated line, resource titles have stable separation from summaries, and source/link footers sit consistently at the bottom of each card.
- 390px mobile resource index: the search control and the three filters form a readable compact group; labels no longer collide with selects. Resource-stage text wraps cleanly, titles and summaries have distinct margins, and external links remain inside cards.
- The third pass intentionally changes the learning center from a generic dashboard grid into a reading layout: titles, labels, descriptions, ordered steps, safety checks and resource footers all use an explicit spacing scale. Production deployment and equivalent visual review remain required before this is considered resolved.

## Learning typography r4 desktop visual verification

The new 1440px Chinese and English screenshots confirm the remaining structural defect is resolved: the safety panel terminates directly after the fifth check and the official Q&A link, rather than inheriting the six-step panel height. The safety panel is now 415px versus 556px for the Chinese path, and 499px versus 612px for the English path. Chinese and English headings, labels, instructional descriptions and numbered cards retain readable wrapping and a consistent spacing scale.

## Learning typography r4 mobile visual verification

At 390px, the Chinese path has a clear single-column reading order: the intro, three orientation cards, path panel and safety panel all remain inside the shell with readable paragraph leading. The English path likewise preserves natural wrapping and no horizontal overflow, but the “OFFICIAL SITE ↗” outlet in the intro header visibly places its arrow on a second line. This is a small but real alignment defect and should be changed to an unbreakable, right-aligned label before release.

## Learning typography r4 final mobile visual verification

Final 390px Chinese and English screenshots confirm that the panel rules now target the actual learning panels. The intro header becomes a deliberate stacked structure: label and title on the left reading path, with the official destination as a single unbroken right-aligned line below. This removes the former detached arrow while avoiding a compressed title row. Both language versions preserve natural paragraph leading, card padding, numbered-step alignment and contained arrows with no visible horizontal expansion.

## Learning typography r4 resource visual verification

The final desktop resource panel has clear title, API outlet, explanatory copy, labelled controls, card hierarchy and source/link footers. On 390px, the resource header and cards are legible, but the search field shares the first filter row with Source and visibly truncates its placeholder. This is not a geometric overflow, but it weakens the control hierarchy. The final mobile correction should restore a full-width search row above the two-column Source / Stage / Language controls, followed by one targeted screenshot rerun.

## Learning typography r5 local release verification

After the final mobile search-row correction, the full local teaching regression passed: the 19-item layout contract, the 108-state language-and-viewport stress matrix, the dedicated desktop/mobile resource capture, the four-screenshot typography matrix, and the full release contract. The resource search is now a complete first row at 390px; Source and Stage share the next row, with Language in a clear following row. This resolution is based on screenshot review as well as geometric assertions.

## Learning typography r5 production visual verification

The deployed r5 asset was inspected on the public site at 1440px Chinese and 390px English. The desktop safety card now ends immediately after the fifth check and Q&A link rather than occupying the six-step panel height. On the English phone layout, the official destination remains an unbroken, right-aligned line; headings, long explanatory copy and all three orientation cards have natural wrapping and contained arrows. Production API inspection also returned the governed 12-resource catalog and verified the expected typography-r5 asset.

The final production mobile resource capture confirms the search field occupies a full first row. Source and Stage are readable side-by-side, Language has an unclipped dedicated row, and the resource badge, stage copy, title, description and external link all remain aligned within the card.
