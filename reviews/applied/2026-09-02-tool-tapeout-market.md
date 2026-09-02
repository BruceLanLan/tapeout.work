---
id: tool-tapeout-market
url: https://tapeout.market/
status: revouch
generated_at: 2026-09-02T09:00:18.181Z
reviewed_at: 2026-09-01T20:30:00Z
changed_at: 2026-09-02T07:16:05.297Z
fetch_path: r.jina.ai (+/circuits) (+/mining) (+/create)
excerpt_lines: 220
model: sonnet
---
# Review: TapeOut Market

Set `status: approved` to apply the JSON block at the bottom (edit it first if needed), or `status: revouch` to keep the text and refresh the review date. Then run `node scripts/apply_reviews.mjs`.

## Entry as it stands

**summary_en:** Community ecosystem market whose navigation reaches well past listings. Three sections the name does not suggest: /circuits is a secondary market for taped-out mining machines (Circuit NFTs) which aggregates the official tapeout.net listings alongside its own and labels each card's source so the split stays visible, showing per-machine pending BEM, task ID, hashrate, pool and estimated daily output. /mining is a network dashboard covering halving phase, emission rate and next-halving countdown, active and verified machine counts and hashrate, named price sources (a specific PancakeSwap V3 BEM/USDT pool, with BNB/USD via Chainlink), and a Forgone Emissions counter that no other tool in this catalogue publishes. /create is a four-step wizard over all official tasks with filters and sorting by NAND and LATCH requirement, plus a per-task estimated daily output for both processors computed in the browser. A Tools page adds a Circuit Mining Calculator that reads a circuit's on-chain data, checks it against the compatible official task vectors and estimates verified-pool output and payback. The circuit listings carry the site's own caveat that what it shows is a data cover, not netlist topology. Treat all of it separately from official protocol, contract and ownership sources.

**summary_zh:** 社区生态市场，导航范围远不止挂单。有三块是名字看不出来的：/circuits 是已流片矿机（Circuit NFT）的二级市场，把官方 tapeout.net 的挂单与自家挂单聚合在一起，并逐条标出来源以便区分，每台显示待领 BEM、题目 ID、算力、所属池和预估日产；/mining 是全网仪表盘，涵盖减半阶段、发行速率与下次减半倒计时、活跃与已验证矿机数及算力、明确写出的价格来源（指定的 PancakeSwap V3 BEM/USDT 池，BNB/USD 走 Chainlink），以及一个本目录中其他工具都没有发布的「Forgone Emissions」（未被发行的发行量）计数器；/create 是覆盖全部官方题目的四步向导，可筛选并按 NAND、LATCH 需求排序，还会在浏览器端算出每道题在两种处理器下的预估日产。Tools 页另有一个电路挖矿计算器，读取某台电路的链上数据，对照可匹配的官方题目向量，估算已验证池产出与回本情况。其电路挂单页附有站方自己的限定说明：它展示的是数据封面，不是网表拓扑。以上均应与官方协议、合约和持仓来源分开看待。

**safety_en:** Community marketplace only. Open bids and displayed values are not completed trades, exit prices or return promises; independently verify current contracts and all wallet requests before signing.

## Self-audit signal

Page changed 2026-09-02T07:16:05.297Z; entry reviewed 2026-09-01T20:30:00Z.

Labels added: []
Labels removed: []

## Fetch

Retrieved via **r.jina.ai (+/circuits) (+/mining) (+/create)**.

## Claim check (mechanical, en then zh)

| # | sentence | best line | overlap | status |
|---|---|---|---|---|
| 1 | Community ecosystem market whose navigation reaches well past listings. | 1 | market | weak |
| 2 | Three sections the name does not suggest: /circuits is a secondary market for taped-out mining machines (Circu | 18 | circuits, mining, machines, create, nand | supported |
| 3 | A Tools page adds a Circuit Mining Calculator that reads a circuit's on-chain data, checks it against the comp | 76 | on-chain, official, task, vectors | supported |
| 4 | The circuit listings carry the site's own caveat that what it shows is a data cover, not netlist topology. | 4 | what | weak |
| 5 | Treat all of it separately from official protocol, contract and ownership sources. | 5 | official, protocol | weak |
| 6 zh | 社区生态市场，导航范围远不止挂单。 | — |  | no match |
| 7 zh | 有三块是名字看不出来的：/circuits 是已流片矿机（Circuit NFT）的二级市场，把官方 tapeout.net 的挂单与自家挂单聚合在一起，并逐条标出来源以便区分，每台显示待领 BEM、题目 ID、算力、所 | 8 | circuits, circuit, create, nand, latch | supported |
| 8 zh | Tools 页另有一个电路挖矿计算器，读取某台电路的链上数据，对照可匹配的官方题目向量，估算已验证池产出与回本情况。 | — |  | no match |
| 9 zh | 其电路挂单页附有站方自己的限定说明：它展示的是数据封面，不是网表拓扑。 | — |  | no match |
| 10 zh | 以上均应与官方协议、合约和持仓来源分开看待。 | — |  | no match |

## Excerpt (as served, numbered)

```text
  1| TAPEOUT MARKET
  2| TapeOut Market is the marketplace and service platform supporting the trading of all assets within the TapeOut Protocol ecosystem.
  3| Learn
  4| ## What is BEM used for?
  5| BEM is the official core token asset of the TapeOut Protocol and an important part of its mining ecosystem. Users can continuously produce BEM through mining machines, connecting transistors, circuit boards, computing power, and mining within the TapeOut ecosystem.
  6| At the same time, TapeOut founder BLONSKR continues to expand BEM’s utility. According to his announced plans, users will be able to train their own on-chain BNNs (Binary Neural Networks), with BEM being consumed and burned during the training process, further expanding its real utility within the ecosystem.
  7| ### What is TapeOut Protocol?
  8| TapeOut Protocol is an on-chain circuit protocol built on BNB Chain. Users can use transistors such as NAND and LATCH to build different circuits and then Tape Out the completed designs, creating circuit assets that truly exist on-chain. Simply put, traditional chips are built using transistors, while in TapeOut, users can use on-chain transistors to create their own on-chain circuits.
  9| ### What are transistors used for? What is the difference between NAND and LATCH?
 10| Transistors are mainly used to build circuit boards, which can then be used for mining. The main difference between NAND and LATCH lies in the quantity required and the amount consumed when building different circuits. For example, building an entry-level mining machine requires 2 NAND and 1 LATCH.
 11| ### What is the difference between Behemoth and TAPEOUT?
 12| The main differences between Behemoth and TAPEOUT are their total supply and power. Behemoth has a total supply of 100,000, while TAPEOUT has a total supply of 1,000,000. Both were deployed by TapeOut founder BLONSKR for mining purposes.
 13| ### Besides the computing power of the circuit board, are there any other differences in mining rewards?
 14| According to TapeOut founder BLONSKR, the base reward of each mining machine corresponds to its computing power. In addition, the best-performing circuits may receive additional reward bonuses.
 15| ### Does every circuit board generate the same output?
 16| No. Circuit boards generate different outputs depending on their attributes. Higher-level circuit boards generally require more transistors to build. Behemoth and TAPEOUT also differ in total supply: Behemoth has a total supply of 100,000, while TAPEOUT has a total supply of 1,000,000. Both were deployed by TapeOut founder BLONSKR for mining. Behemoth has a power of 6, while TAPEOUT has a power of
 17| ### What are the unique features of TapeOut assets?
 18| Transistors in TapeOut are not only tradable assets but also have practical utility. NAND and LATCH are the fundamental materials used to build circuits within the TapeOut ecosystem. As more users build circuits, create mining machines, and perform Tape Out, demand for NAND and LATCH will also increase. At the same time, certain circuits require a corresponding amount of transistors to be consumed
 19| Therefore, transistors are both tradable assets and fundamental production materials within the entire TapeOut circuit ecosystem.
 20| As a result, the TapeOut ecosystem is not built solely around Token trading. Instead, it forms a complete on-chain asset system:
 21| Transistors → Circuit Boards → Computing Power → Mining Machines → Mining
 22| ### Can I create a mining machine without assembling it manually?
 23| Yes. TapeOut Market has integrated the official mining machine templates. Simply select a template based on the amount of NAND and LATCH you hold, and you can generate a mining machine with one click and start mining immediately, without any manual configuration.
 24| This feature is available on the “Create” page of TapeOut Market.
 25| === /circuits ===
 26| [![Image 1](https://tapeout.market/_next/image?url=%2F_next%2Fstatic%2Fimmutable%2Fmedia%2Ftapeout-market-logo.3x2nkzbb5msy0.png&w=96&q=75)**TapeOut Market**](https://tapeout.market/)
 27| [Home](https://tapeout.market/)[Market](https://tapeout.market/markets)[AI Advisor](https://tapeout.market/advisor)[Create](https://tapeout.market/create)[Mining](https://tapeout.market/mining)[Tools](https://tapeout.market/tools)[My Orders](https://tapeout.market/my-orders)[My Assets](https://tapeout.market/my-assets)[Q&A](https://tapeout.market/qa)
 28| BNB Chain
 29| TAPEOUT MARKET
 30| ## Market
 31| [Transistors](https://tapeout.market/markets)[Circuits](https://tapeout.market/markets?type=circuits)[BEM](https://tapeout.market/markets?type=bem&mode=orderbook)
 32| Processors**2**
 33| Market Assets**2**
 34| 24h volume**—**
 35| Listed**—**
 36| ## Circuit Market
 37| **TapeOut**Official Mineable🔥🔥🔥
 38| [0xb1024…0a14C](https://bscscan.com/address/0xb1024b89886B9a34Aa4ff5F31C411D708b20a14C)
 39| [Circuit**TapeOut Circuits**TapeMarket / tapeout.net Floor**—** Listed**—**TapeMarket — · tapeout.net — 24h volume**—**Refreshing… →](https://tapeout.market/circuits/tapeout)
 40| **Behemoth**Official Mineable🔥🔥🔥
 41| [0x1F5Cb…1f12C](https://bscscan.com/address/0x1F5Cb4aeaE1807Bf60c3b9C0D8aDBCC14e91f12C)
 42| [Circuit**Behemoth Circuits**TapeMarket / tapeout.net Floor**—** Listed**—**TapeMarket — · tapeout.net — 24h volume**—**Refreshing… →](https://tapeout.market/circuits/behemoth)
 43| === /mining ===
 44| CIRCUIT MINING
 45| ## Mining
 46| View network mining data and manage your TapeOut and Behemoth mining machines.
 47| ## Emission
 48| Current Phase**Halving phase 0**
 49| Current Rate**0.08333333 BEM**BEM / second
 50| Daily Emission**7199.999712 BEM**
 51| Token Supply**74647.53308692 BEM**0.35%
 52| Maximum Supply**21000000 BEM**
 53| Next Halving**08/18/2030 21:15:32**1446d 12h 15m
 54| ## Network
 55| Active Mining Machines**14,350**
 56| Verified Mining Machines**13,755**
 57| Verified Hashrate**1,239,877**
 58| Unverified Hashrate**34,987**
 59| Total Mined**74647.53308692 BEM**
 60| Forgone Emissions**111.85582882 BEM**
 61| BEM
 62| ## BEM Market
 63| Updated at block 119507580
 64| BEM Price**0.02782659 BNB**≈ $19.0179
 65| Token Supply**74651.66574101 BEM**
 66| Maximum Supply**21000000 BEM**
 67| Market Cap**2077.3015 BNB**≈ $1419720.47
 68| Fully Diluted Value**584358.4581 BNB**≈ $399376619.46
 69| Price Sources**PancakeSwap V3 · BEM/USDT[0x2f5e...eA38](https://bscscan.com/address/0x2f5ec19ab0583D3FCd9bcbcD9AB416d2858EeA38)**BNB/USD via Chainlink
 70| BEM Balance**—**
 71| Current Claimable**0 BEM**≈ 0 BNB · $0
 72| Claims Received by Wallet**—**
 73| TASKS
 74| ## On-chain Tasks
 75| 267 active / 267 total
 76| Task metadata and Merkle roots are on-chain. Official public vectors are synchronized at build time and independently checked against every on-chain Root.
 77| View active tasks
 78| **#1 AND Gate**Combination
 79| Inputs 2
 80| Outputs 1
 81| Cycles 1
 82| Vector Count 256
 83| Reference Circuit 0xf4412c…bde28e #1
 84| **#2 OR Gate**Combination
 85| Inputs 2
 86| Outputs 1
 87| Cycles 1
 88| Vector Count 256
 89| Reference Circuit 0xf4412c…bde28e #2
 90| **#3 XOR Gate**Combination
 91| Inputs 2
 92| Outputs 1
 93| Cycles 1
 94| Vector Count 256
 95| Reference Circuit 0xf4412c…bde28e #3
 96| **#4 NAND Gate**Combination
 97| Inputs 2
 98| Outputs 1
 99| Cycles 1
100| Vector Count 256
101| Reference Circuit 0xf4412c…bde28e #4
102| **#5 Implication (A → B)**Combination
103| Inputs 2
104| Outputs 1
105| Cycles 1
106| Vector Count 256
107| Reference Circuit 0xf4412c…bde28e #5
108| **#6 Set Difference (A AND NOT B)**Combination
109| Inputs 2
110| Outputs 1
111| Cycles 1
112| Vector Count 256
113| Reference Circuit 0xf4412c…bde28e #6
114| **#7 NOR Gate**Combination
115| Inputs 2
116| Outputs 1
117| Cycles 1
118| Vector Count 256
119| Reference Circuit 0xf4412c…bde28e #7
120| **#8 XNOR Gate**Combination
121| Inputs 2
122| Outputs 1
123| Cycles 1
124| Vector Count 256
125| Reference Circuit 0xf4412c…bde28e #8
126| **#9 3-Input AND**Combination
127| Inputs 3
128| Outputs 1
129| Cycles 1
130| Vector Count 256
131| Reference Circuit 0xf4412c…bde28e #9
132| **#10 3-Input Odd Parity (XOR3)**Combination
133| Inputs 3
134| Outputs 1
135| Cycles 1
136| Vector Count 256
137| Reference Circuit 0xf4412c…bde28e #10
138| **#11 3-Input Majority Vote (MAJ3)**Combination
139| Inputs 3
140| Outputs 1
141| Cycles 1
142| Vector Count 256
143| Reference Circuit 0xf4412c…bde28e #11
144| **#12 2-to-1 MUX**Combination
145| Inputs 3
146| Outputs 1
147| Cycles 1
148| Vector Count 256
149| Reference Circuit 0xf4412c…bde28e #12
150| **#13 4-Input Even Parity**Combination
151| Inputs 4
152| Outputs 1
153| Cycles 1
154| Vector Count 256
155| Reference Circuit 0xf4412c…bde28e #13
156| **#14 Exactly Two Ones (4-bit)**Combination
157| Inputs 4
158| Outputs 1
159| Cycles 1
160| Vector Count 256
161| Reference Circuit 0xf4412c…bde28e #14
162| **#15 8-Input Odd Parity**Combination
163| Inputs 8
164| Outputs 1
165| Cycles 1
166| Vector Count 256
167| Reference Circuit 0xf4412c…bde28e #15
168| **#16 8-bit All-Zero Detector**Combination
169| Inputs 8
170| Outputs 1
171| Cycles 1
172| Vector Count 256
173| Reference Circuit 0xf4412c…bde28e #16
174| **#17 Half Adder**Combination
175| Inputs 2
176| Outputs 2
177| Cycles 1
178| Vector Count 256
179| Reference Circuit 0xf4412c…bde28e #17
180| **#18 Full Adder**Combination
181| Inputs 3
182| Outputs 2
183| Cycles 1
184| Vector Count 256
185| Reference Circuit 0xf4412c…bde28e #18
186| **#19 Full Subtractor**Combination
187| Inputs 3
188| Outputs 2
189| Cycles 1
190| Vector Count 256
191| Reference Circuit 0xf4412c…bde28e #19
192| **#20 2-to-4 Decoder**Combination
193| Inputs 2
194| Outputs 4
195| Cycles 1
196| Vector Count 256
197| Reference Circuit 0xf4412c…bde28e #20
198| **#21 3-to-8 Decoder**Combination
199| Inputs 3
200| Outputs 8
201| Cycles 1
202| Vector Count 256
203| Reference Circuit 0xf4412c…bde28e #21
204| **#22 4-to-3 Priority Encoder**Combination
205| Inputs 4
206| Outputs 3
207| Cycles 1
208| Vector Count 256
209| Reference Circuit 0xf4412c…bde28e #22
210| **#23 8-to-3 Priority Encoder**Combination
211| Inputs 8
212| Outputs 3
213| Cycles 1
214| Vector Count 256
215| Reference Circuit 0xf4412c…bde28e #23
216| **#24 4-to-1 MUX**Combination
217| Inputs 6
218| Outputs 1
219| Cycles 1
220| Vector Count 256
```

## Proposed revision

Verdict: **still_accurate**

The excerpt strongly reconfirms the /mining dashboard claims already in the entry: halving phase (line 48), emission rate (line 49), next-halving countdown (line 53), active/verified machine counts (lines 55-56), hashrate (lines 57-58), named price sources including the specific PancakeSwap V3 BEM/USDT pool and Chainlink BNB/USD (line 69), and the Forgone Emissions counter (line 60). Nothing in the excerpt contradicts the /circuits, /create, Tools-page, or 'data cover' caveat claims — the /circuits section shown here (lines 36-42) is a class-level aggregate view (Floor/Listed/24h volume, TapeMarket vs tapeout.net source split) rather than individual NFT cards, so the absence of per-machine pending BEM/task ID/hashrate/pool detail is not evidence against that claim, only a fraction of the page not captured. Similarly, /create's four-step wizard, the Circuit Mining Calculator, and the data-cover disclaimer are not shown in this excerpt but are also not contradicted; per the absence-is-not-evidence rule they stand. The new FAQ/Learn content (BEM utility, transistor mechanics, Behemoth/TAPEOUT differences) and the 'AI Advisor' nav link are background or unlabeled additions with no functional detail shown, insufficient to safely add as new capability claims without overreaching. No sentence in the entry is contradicted by this excerpt.

```json
{
  "verdict": "still_accurate",
  "summary_en": null,
  "summary_zh": null,
  "citations": []
}
```
