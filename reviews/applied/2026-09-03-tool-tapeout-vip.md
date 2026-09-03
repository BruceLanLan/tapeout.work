---
id: tool-tapeout-vip
url: https://tapeout.vip/
status: revouch
generated_at: 2026-09-03T07:18:59.863Z
reviewed_at: 2026-09-01T04:00:00Z
changed_at: 2026-09-03T06:05:20.654Z
fetch_path: headless chrome (+/b)
excerpt_lines: 220
model: sonnet
---
# Review: TapeOut VIP live analytics dashboard

Set `status: approved` to apply the JSON block at the bottom (edit it first if needed), or `status: revouch` to keep the text and refresh the review date. Then run `node scripts/apply_reviews.mjs`.

## Entry as it stands

**summary_en:** Independent trilingual (中/英/한) real-time dashboard: total miners, verified/unverified pool weight, mining progress toward the 21M supply cap, daily emission, BEM price/market cap/FDV, live NAND/LATCH bid-ask for both TapeOut and Behemoth, a per-task "Rank #1 pioneer" table, a wallet leaderboard and a hot-task ranking. The task table carries the design shape itself — area, depth and b* as a triple, design cost C, and the first-creator bonus — and the price strip reports the burned share of each transistor type. Reposted approvingly by protocol founder @Blonskr.

**summary_zh:** 独立的中/英/韩三语实时数据看板：矿机总数、已验证/未验证池权重、对齐 2100 万总供给的挖矿进度、日产出、BEM 价格/市值/FDV、TapeOut 与 Behemoth 双边 NAND/LATCH 实时买卖盘、逐题目的"Rank #1 首创者"榜单、钱包排行榜与热门题目排名。其题目表直接给出电路形态本身——面积/深度/b* 三元组、设计成本 C、首创加成，价格条还标出每种晶体管的已销毁比例。协议创始人 @Blonskr 曾转发致意。

**safety_en:** Independent community dashboard, not an official source. Reviewed directly: the page is read-only and no wallet-connect, signature or transaction prompt was found anywhere on it. Its per-task "Rank #1" and weight figures are the author's own computation; verify methodology independently before relying on any number.

## Self-audit signal

Page changed 2026-09-03T06:05:20.654Z; entry reviewed 2026-09-01T04:00:00Z.

Labels added: ["h:{{ statscharttitle }}"]
Labels removed: []

## Fetch

Retrieved via **headless chrome (+/b)**.

- r.jina.ai: jina returned no body

## Claim check (mechanical, en then zh)

| # | sentence | best line | overlap | status |
|---|---|---|---|---|
| 1 | Independent trilingual (中/英/한) real-time dashboard: total miners, verified/unverified pool weight, mining prog | 41 | daily, rank, wallet, leaderboard | supported |
| 2 | The task table carries the design shape itself — area, depth and b* as a triple, design cost C, and the first- | 42 | task, design, area, cost, bonus | supported |
| 3 | Reposted approvingly by protocol founder @Blonskr. | — |  | no match |
| 4 zh | 独立的中/英/韩三语实时数据看板：矿机总数、已验证/未验证池权重、对齐 2100 万总供给的挖矿进度、日产出、BEM 价格/市值/FDV、TapeOut 与 Behemoth 双边 NAND/LATCH 实时买卖盘、逐题 | 1 | tapeout, 实时, 看板, 矿机, 首创 | supported |
| 5 zh | 其题目表直接给出电路形态本身——面积/深度/b* 三元组、设计成本 C、首创加成，价格条还标出每种晶体管的已销毁比例。 | 1 | 首创 | weak |
| 6 zh | 协议创始人 @Blonskr 曾转发致意。 | — |  | no match |

## Excerpt (as served, numbered)

```text
  1| TapeOut VIP · 全网矿机与最优首创实时看板
  2| TapeOut Live Analytics Dashboard
  3| GuoBTC TG Group WeChat Scan with WeChat to join TapeOut VIP group
  4| 中文 English 한국어
  5| Total Miners
  6| 14480
  7| Verified Circuits : 13885 Daily Curve
  8| Verified Weight (H)
  9| 1,192,698
 10| Unverified Pool : 34,991 Daily Curve
 11| Mined / Total Supply
 12| 80,478 / 21,000,000
 13| Mining Progress: 0.38% Daily Curve
 14| Daily Emission
 15| 7,200 BEM
 16| 99% Verified Pool Allocation
 17| BEM Token
 18| $17.95
 19| ↓6.1%
 20| Circulating MCAP $1.4M
 21| FDV (21M) $376.9M
 22| TapeOut Agg.
 23| NAND
 24| Burned 67%
 25| Ask 0.008580 BNB
 26| Bid 0.008200 BNB
 27| LATCH
 28| Burned 42%
 29| Ask 0.007980 BNB
 30| Bid 0.007110 BNB
 31| Behemoth Agg.
 32| NAND
 33| Burned 57%
 34| Ask 0.101600 BNB
 35| Bid 0.088000 BNB
 36| LATCH
 37| Burned 39%
 38| Ask 0.048000 BNB
 39| Bid 0.039001 BNB
 40| On-Chain Pulse Waiting for on-chain events…
 41| Rank #1 Overview (267) Miner Wallet Leaderboard (Daily ≥1) High-Yield Task Ranking (50)
 42| Task Task & Logic Function CPU Processor Rank #1 Miner Wallet Circuit ID Area / d / b* Design Cost (C) Bonus Ranked Time (UTC)
 43| #1 AND Gate
 44| Behemoth 0xbc78...47f3
 45| #230 2 · 2 · 2 16 +2 08/21 22:48
 46| TapeOut 0x54de...0a65
 47| #904 2 · 2 · 2 16 +2 08/21 22:51
 48| #2 OR Gate
 49| Behemoth 0x525d...9a32
 50| #453 3 · 2 · 3 24 +3 08/21 18:46
 51| TapeOut 0xc343...a406
 52| #905 3 · 2 · 3 24 +3 08/21 22:51
 53| #3 XOR Gate
 54| Behemoth 0x525d...9a32
 55| #455 4 · 3 · 4 108 +4 08/21 18:47
 56| TapeOut 0xafd6...3c3f
 57| #906 4 · 3 · 4 108 +4 08/21 22:51
 58| #4 NAND Gate
 59| Behemoth 0x525d...9a32
 60| #298 1 · 1 · 1 1 +1 08/21 17:02
 61| TapeOut 0xf426...0be8
 62| #907 1 · 1 · 1 1 +1 08/21 16:23
 63| #5 Implication A→B
 64| Behemoth 0x525d...9a32
 65| #456 2 · 2 · 2 16 +2 08/21 18:48
 66| TapeOut 0x924b...76a9
 67| #908 2 · 2 · 2 16 +2 08/21 22:51
 68| #6 Set Diff A∧¬B
 69| Behemoth 0x525d...9a32
 70| #458 3 · 3 · 3 81 +3 08/21 18:49
 71| TapeOut 0x64d5...36bb
 72| #1048 3 · 3 · 3 81 +3 08/21 18:30
 73| #7 NOR Gate
 74| Behemoth 0x525d...9a32
 75| #459 4 · 3 · 4 108 +4 08/21 18:50
 76| TapeOut 0x9a4c...6e8d
 77| #910 4 · 3 · 4 108 +4 08/21 22:51
 78| #8 XNOR Gate
 79| Behemoth 0x64d5...36bb
 80| #745 5 · 3 · 5 135 +11 08/22 02:42
 81| TapeOut 0x64d5...36bb
 82| #1050 5 · 3 · 5 135 +11 08/21 18:29
 83| #9 3-input AND
 84| Behemoth 0x632b...c795
 85| #52 4 · 4 · 4 256 +4 08/21 21:39
 86| TapeOut 0xff4e...263c
 87| #912 4 · 4 · 4 256 +4 08/21 22:51
 88| #10 3-input Odd Parity
 89| Behemoth 0x525d...9a32
 90| #462 11 · 5 · 11 1,375 +10 08/21 18:52
 91| TapeOut 0x64d5...36bb
 92| #1052 11 · 5 · 11 1,375 +10 08/21 18:28
 93| #11 Majority MAJ3
 94| Behemoth 0x42d9...95a7
 95| #54 6 · 4 · 6 384 +6 08/25 07:15
 96| TapeOut 0x4367...4f95
 97| #16 6 · 4 · 6 384 +6 08/21 19:24
 98| #12 2-to-1 MUX
 99| Behemoth 0x0345...2cab
100| #634 4 · 3 · 4 108 +4 08/21 21:19
101| TapeOut 0x03ae...19b5
102| #1704 4 · 3 · 4 108 +4 08/21 19:37
103| #13 4-input Even Parity
104| Behemoth 0x6688...7395
105| #398 19 · 5 · 19 2,375 +13 08/21 17:44
106| TapeOut 0x6688...7395
107| #1194 19 · 5 · 19 2,375 +13 08/21 16:06
108| #14 Exactly Two 1s (4-bit)
109| Behemoth 0x8a0c...8477
110| #645 16 · 5 · 16 2,000 +88 08/21 22:00
111| TapeOut 0x6688...7395
112| #2232 16 · 5 · 16 2,000 +88 08/22 00:10
113| #15 8-input Odd Parity
114| Behemoth 0x8a0c...8477
115| #959 47 · 7 · 47 16,121 +35 08/22 13:49
116| TapeOut 0x83ae...7ab3
117| #2779 47 · 7 · 47 16,121 +35 08/22 07:39
118| #16 8-bit All-Zero Detect
119| Behemoth 0x8a0c...8477
120| #962 22 · 7 · 22 7,546 +22 08/22 13:44
121| TapeOut 0x0345...2cab
122| #1784 22 · 7 · 22 7,546 +22 08/21 20:12
123| #17 Half Adder
124| Behemoth 0xddf8...9cda
125| #55 5 · 3 · 5 135 +5 08/23 14:50
126| TapeOut 0xf911...bbe2
127| #917 5 · 3 · 5 135 +5 08/21 22:51
128| #18 Full Adder
129| Behemoth 0x6688...7395
130| #441 12 · 5 · 12 1,500 +11 08/21 18:36
131| TapeOut 0x64d5...36bb
132| #1056 12 · 5 · 12 1,500 +11 08/21 16:11
133| #19 Full Subtractor
134| Behemoth 0x64d5...36bb
135| #944 12 · 5 · 12 1,500 +51 08/22 13:19
136| TapeOut 0x64d5...36bb
137| #1057 12 · 5 · 12 1,500 +51 08/21 18:27
138| #20 2-to-4 Decoder
139| Behemoth 0x525d...9a32
140| #469 10 · 3 · 10 270 +10 08/21 18:54
141| TapeOut 0x5b28...95eb
142| #919 10 · 3 · 10 270 +10 08/21 22:51
143| #21 3-to-8 Decoder
144| Behemoth 0x525d...9a32
145| #607 25 · 5 · 25 3,125 +29 08/21 21:07
146| TapeOut 0xbd3f...8731
147| #1880 25 · 5 · 25 3,125 +29 08/21 21:04
148| #22 4-to-3 Priority Encoder
149| Behemoth 0x64d5...36bb
150| #797 11 · 4 · 11 704 +72 08/22 05:47
151| TapeOut 0x64d5...36bb
152| #1059 11 · 4 · 11 704 +72 08/21 18:26
153| #23 8-to-3 Priority Encoder
154| Behemoth 0x4367...4f95
155| #1624 21 · 5 · 21 2,625 +176 08/25 21:51
156| TapeOut 0xffaa...6922
157| #3422 21 · 5 · 21 2,625 +176 08/23 04:35
158| #24 4-to-1 MUX
159| Behemoth 0x8a0c...8477
160| #1013 11 · 5 · 11 1,375 +11 08/22 21:41
161| TapeOut 0x03ae...19b5
162| #1706 11 · 5 · 11 1,375 +11 08/21 19:43
163| #25 8-to-1 MUX
164| Behemoth 0xd2b1...e5b3
165| #874 24 · 7 · 24 8,232 +24 08/22 09:39
166| TapeOut 0x1490...ce72
167| #11405 27 · 6 · 27 5,832 +33 08/27 21:24
168| #26 1-bit Comparator (<,=,>)
169| Behemoth 0x64d5...36bb
170| #946 9 · 3 · 9 243 +31 08/22 13:20
171| TapeOut 0x64d5...36bb
172| #1061 9 · 3 · 9 243 +31 08/21 18:28
173| #27 2-bit Comparator (<,=,>)
174| Behemoth 0x8a0c...8477
175| #637 22 · 5 · 22 2,750 +160 08/21 21:40
176| TapeOut 0x0345...2cab
177| #1656 22 · 5 · 22 2,750 +160 08/21 19:06
178| #28 4-bit Comparator (<,=,>)
179| Behemoth 0xdad1...30dd
180| #1923 28 · 8 · 28 14,336 +244 08/27 22:09
181| TapeOut 0xb049...d76d
182| #10266 28 · 8 · 28 14,336 +244 08/26 20:48
183| #29 4-bit Equality
184| Behemoth 0x8a0c...8477
185| #483 26 · 7 · 26 8,918 +38 08/21 19:01
186| TapeOut - - - - - -
187| #30 4-bit Greater Than
188| Behemoth 0xdad1...30dd
189| #1112 18 · 7 · 18 6,174 +236 08/23 07:48
190| TapeOut 0xb049...d76d
191| #3430 18 · 7 · 18 6,174 +236 08/23 05:02
192| #31 1-bit Adder (with cin)
193| Behemoth 0xedcd...4a17
194| #1413 12 · 5 · 12 1,500 +11 08/25 05:12
195| TapeOut 0x64d5...36bb
196| #1062 12 · 5 · 12 1,500 +11 08/21 18:28
197| #32 2-bit Adder (with cin)
198| Behemoth 0x0c16...3fd6
199| #1986 22 · 6 · 22 4,752 +34 08/29 04:18
200| TapeOut 0xb049...d76d
201| #12094 22 · 6 · 22 4,752 +34 08/29 01:54
202| #33 4-bit Adder (with cin)
203| Behemoth 0x0c16...3fd6
204| #2025 49 · 8 · 49 25,088 +89 08/30 21:14
205| TapeOut 0xefd0...c624
206| #12350 49 · 8 · 49 25,088 +89 08/30 17:53
207| #34 8-bit Adder (with cin)
208| Behemoth - - - 97,000 - -
209| TapeOut 0x03ae...19b5
210| #3053 97 · 14 · 97 266,168 +155 08/22 13:38
211| #35 16-bit Adder (with cin)
212| Behemoth - - - 203,000 - -
213| TapeOut 0xfd7c...c6df
214| #6217 264 · 12 · 264 456,192 +576 08/24 16:56
215| #36 2-bit Adder (no cin)
216| Behemoth 0x525d...9a32
217| #672 16 · 5 · 16 2,000 +21 08/21 23:09
218| TapeOut 0x64d5...36bb
219| #1063 16 · 5 · 16 2,000 +21 08/21 18:27
220| #37 4-bit Adder (no cin)
```

## Proposed revision

Verdict: **still_accurate**

The excerpt confirms every structural claim in the current entry: total miners (5-6), verified/unverified pool weight (7-10), mining progress toward the 21M cap (11-13), daily emission (14-16), BEM price/mcap/FDV (17-21), dual NAND/LATCH bid-ask for both TapeOut and Behemoth aggregates with burned-share percentages (22-39), and the Rank #1 task table carrying area/depth/b* triple, design cost, and first-creator bonus columns (41-42), plus the separate wallet leaderboard and high-yield task ranking tabs (41). Nothing in the excerpt contradicts the @Blonskr repost claim — it simply isn't a dashboard-page fact, so per the absence-is-not-evidence rule it stays. The one added label, 'h:{{ statscharttitle }}', is an unrendered template placeholder (client-side templating artifact), not a real content feature, so it doesn't warrant a summary change. No revision needed.

```json
{
  "verdict": "still_accurate",
  "summary_en": null,
  "summary_zh": null,
  "citations": []
}
```
