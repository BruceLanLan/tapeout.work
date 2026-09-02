---
id: tool-tapeout-firsto
url: https://tapeout.firsto.ai/
status: revouch
generated_at: 2026-09-02T02:08:27.159Z
reviewed_at: 2026-09-01T20:30:00Z
changed_at: 2026-09-02T01:15:09.167Z
fetch_path: r.jina.ai
excerpt_lines: 93
model: sonnet
---
# Review: TapeOut Firsto marketplace

Set `status: approved` to apply the JSON block at the bottom (edit it first if needed), or `status: revouch` to keep the text and refresh the review date. Then run `node scripts/apply_reviews.mjs`.

## Entry as it stands

**summary_en:** Third-party ecosystem trading surface for TapeOut-related transistor and mining-machine listings, presenting itself as a professional trading terminal rather than a listings board. Behind the landing page it serves a live per-fill trade tape: every fill shows buy or sell direction, total BNB, quantity, unit price, the counterparty wallet and a BscScan transaction link, running hours deep. Scope note: that tape was the only surface this review could retrieve — no navigation and no other sections came back — so this describes what the interior shows, not the full extent of what the site offers. Use it as a discovery and market-reading surface, separate from official protocol and ownership data.

**summary_zh:** 第三方生态交易入口，展示 TapeOut 相关晶体管与矿机条目，自我定位为「专业交易终端」而非单纯的挂单板。落地页之后确实提供一条实时逐笔成交流水：每一笔都给出买入/卖出方向、总 BNB、数量、单价、对手方钱包，以及一个 BscScan 交易链接，可回溯数小时。范围说明：本次审核只取回了这一个界面，导航和其他板块都没有取回，所以以上写的是内部展示了什么，不代表该站提供的全部内容。可用于发现和阅读市场信息，但应与官方协议和持仓数据分开看待。

**safety_en:** Community marketplace, not an official price or ownership source. Listings, displayed prices and availability can change and do not guarantee execution; verify contracts and signing requests independently.

## Self-audit signal

Page changed 2026-09-02T01:15:09.167Z; entry reviewed 2026-09-01T20:30:00Z.

Labels added: null
Labels removed: null

## Fetch

Retrieved via **r.jina.ai**.

## Claim check (mechanical, en then zh)

| # | sentence | best line | overlap | status |
|---|---|---|---|---|
| 1 | Third-party ecosystem trading surface for TapeOut-related transistor and mining-machine listings, presenting i | — |  | no match |
| 2 | Behind the landing page it serves a live per-fill trade tape: every fill shows buy or sell direction, total BN | — |  | no match |
| 3 | Scope note: that tape was the only surface this review could retrieve — no navigation and no other sections ca | — |  | no match |
| 4 | Use it as a discovery and market-reading surface, separate from official protocol and ownership data. | — |  | no match |
| 5 zh | 第三方生态交易入口，展示 TapeOut 相关晶体管与矿机条目，自我定位为「专业交易终端」而非单纯的挂单板。 | 1 | 交易 | weak |
| 6 zh | 落地页之后确实提供一条实时逐笔成交流水：每一笔都给出买入/卖出方向、总 BNB、数量、单价、对手方钱包，以及一个 BscScan 交易链接，可回溯数小时。 | 4 | 买入, 交易, 小时 | supported |
| 7 zh | 范围说明：本次审核只取回了这一个界面，导航和其他板块都没有取回，所以以上写的是内部展示了什么，不代表该站提供的全部内容。 | — |  | no match |
| 8 zh | 可用于发现和阅读市场信息，但应与官方协议和持仓数据分开看待。 | — |  | no match |

## Excerpt (as served, numbered)

```text
  1| 12分钟前**买入****0.1152**18 0.0064 0x15B9...7DD5[](https://bscscan.com/tx/0xe41c4cc1a719063be989ee377fbd3172bb045eba4c116b3b7a551b9359eff749 "在区块浏览器查看交易")
  2| 30分钟前**卖出****0.0319**5 0.00639 0x48a4...912d[](https://bscscan.com/tx/0xc78dc97f563a934307da0d931783f0353aca9634551080ff54334826d4b56dfd "在区块浏览器查看交易")
  3| 36分钟前**买入****0.2560**40 0.0064 0x3931...8F7d[](https://bscscan.com/tx/0x478cfa4b0aae9cb672fa5ee7a6137a6a0ded9aae1cfb5911009800b56fda74ca "在区块浏览器查看交易")
  4| 1小时前**买入****0.0447**7 0.00639 0xE6F3...a8dD[](https://bscscan.com/tx/0x9f6965bb61bc2fe28ee9ee91b4d17941ae92cafbf248085d56a3ad8e9e9a07ab "在区块浏览器查看交易")
  5| 1小时前**买入****0.00619**1 0.00619 0xd48a...3744[](https://bscscan.com/tx/0xde371f3c4297f120d04ffe5884a26d2acfc36b211cc98f272a0379e7c9ac397c "在区块浏览器查看交易")
  6| 2小时前**买入****1.0944**171 0.0064 0x9FCa...1909[](https://bscscan.com/tx/0x16bc05b6dce64b477bacc82c6a3741dd4e4b7c781ffce73daf3128c64d115d21 "在区块浏览器查看交易")
  7| 2小时前**买入****0.1278**20 0.00639 0x9FCa...1909[](https://bscscan.com/tx/0xfdc99d3169448fe083d6c96536d4ccb91c58bc3687ff189efe0278901dacfee8 "在区块浏览器查看交易")
  8| 2小时前**买入****0.00619**1 0.00619 0x9FCa...1909[](https://bscscan.com/tx/0x9a62a0b400e48e27607c415093afa15e7da359f7be83102e01a32b7e9ab755dc "在区块浏览器查看交易")
  9| 2小时前**卖出****0.1950**30 0.0065 0x983F...2aCA[](https://bscscan.com/tx/0x70f9c509ebe187e8640e319df2e2468e07e50e1d4ec6839c37aaea19be3d565c "在区块浏览器查看交易")
 10| 2小时前**买入****0.0123**2 0.00619 0x983F...2aCA[](https://bscscan.com/tx/0x70f9c509ebe187e8640e319df2e2468e07e50e1d4ec6839c37aaea19be3d565c "在区块浏览器查看交易")
 11| 2小时前**买入****0.0554**9 0.00616 0x983F...2aCA[](https://bscscan.com/tx/0x70f9c509ebe187e8640e319df2e2468e07e50e1d4ec6839c37aaea19be3d565c "在区块浏览器查看交易")
 12| 2小时前**买入****0.1168**19 0.00615 0x983F...2aCA[](https://bscscan.com/tx/0x70f9c509ebe187e8640e319df2e2468e07e50e1d4ec6839c37aaea19be3d565c "在区块浏览器查看交易")
 13| 3小时前**买入****0.0614**10 0.00614 0x48a4...912d[](https://bscscan.com/tx/0x5cde8f46a7dc3061361efb774187d5958d2b741e5b0c3e0e247f8a408cf02596 "在区块浏览器查看交易")
 14| 3小时前**买入****0.0614**10 0.00614 0x48a4...912d[](https://bscscan.com/tx/0x3a3f2f70e9c4d94563add70b3a3364417f0117f99629762d93c27791feaba154 "在区块浏览器查看交易")
 15| 3小时前**卖出****0.0300**5 0.0060 0xd4FE...a1cD[](https://bscscan.com/tx/0x267e664236f9b5c39d6421344727131f7e16970ad8a4c90476fbffd98d1373f7 "在区块浏览器查看交易")
 16| 3小时前**卖出****0.0601**10 0.00601 0xd4FE...a1cD[](https://bscscan.com/tx/0xd96de31faf67547870fbfb0aacdb6bc6109756c9d2373360b9a630345cbc2f6c "在区块浏览器查看交易")
 17| 4小时前**卖出****0.0295**5 0.00591 0x40e5...641e[](https://bscscan.com/tx/0x664cc43c0d9977e363cdb34e96db1201f86b53b9739454bfd2f49a929723f885 "在区块浏览器查看交易")
 18| 6小时前**卖出****0.0595**10 0.00595 0x3fD6...6177[](https://bscscan.com/tx/0x619efa673132711496cd89627e22f355ca6d77b9777d8700d5a7d1239beff441 "在区块浏览器查看交易")
 19| 7小时前**卖出****0.1334**23 0.0058 0xbd6B...b385[](https://bscscan.com/tx/0xed531eed0c34b8fb9a4811f902faa0c500cdd2f057f3006f1548d7f719e58bee "在区块浏览器查看交易")
 20| 7小时前**卖出****0.2731**45 0.00607 0xbd6B...b385[](https://bscscan.com/tx/0x27389013b3b4651a3959a01b92f693499928ce3ad17ce14298b4007c36faaaea "在区块浏览器查看交易")
 21| 7小时前**卖出****0.00607**1 0.00607 0xbd6B...b385[](https://bscscan.com/tx/0xd2bd1bdb7625bf59c435fbe1666f23236321c918c7d756a08ea0d2da61fb606b "在区块浏览器查看交易")
 22| 8小时前**买入****0.00614**1 0.00614 0x1EB2...55a8[](https://bscscan.com/tx/0x0240d02da8c353c25847cb775bbd1f568a02265a0cf4d0cf7a395b508b19938e "在区块浏览器查看交易")
 23| 8小时前**卖出****0.0892**15 0.00595 0xfc84...c8B6[](https://bscscan.com/tx/0xa555109cfd728fae38c429e7d78336f927bc6346b371d6b4e3bb23b3b57f201a "在区块浏览器查看交易")
 24| 8小时前**卖出****0.1428**24 0.00595 0xfc84...c8B6[](https://bscscan.com/tx/0xf819ba4d8d6a2e6aeeb073300a8660353d1804e30cd3fb65f1720286cd38f030 "在区块浏览器查看交易")
 25| 8小时前**卖出****0.0596**10 0.00596 0xfc84...c8B6[](https://bscscan.com/tx/0x70940ac32203046764f3f6aab3892d27ae364bd9c710d1b8d2209bb768551f97 "在区块浏览器查看交易")
 26| 10小时前**卖出****0.0827**14 0.00591 0x41F1...7478[](https://bscscan.com/tx/0x8659a7723cf2dbe775f2541324ca88a15bff395b280ec57e76928fb7af0fb249 "在区块浏览器查看交易")
 27| 10小时前**买入****0.00615**1 0.00615 0xdbCF...adE7[](https://bscscan.com/tx/0x3eea8bfb33c359b048a1ed7f5c2e6c8d16959f8dd896f529d07490f85d3e0d82 "在区块浏览器查看交易")
 28| 10小时前**卖出****0.1190**20 0.00595 0x2D89...f718[](https://bscscan.com/tx/0x789a19787f0296d432575d1bef9bcbe0e360c5e5a3bedc12991723f330e2e62a "在区块浏览器查看交易")
 29| 10小时前**卖出****0.1136**19 0.00598 0x2D89...f718[](https://bscscan.com/tx/0xa20c460bfbb595282c7af9eab0235a09d45beaf94f736e1283563fa167f9991b "在区块浏览器查看交易")
 30| 10小时前**卖出****0.0239**4 0.00598 0x2D89...f718[](https://bscscan.com/tx/0x6f1485501905e4a0cd49aae298a33aa6bb6b9f7de5f95a425b9b2647f77575d5 "在区块浏览器查看交易")
 31| 10小时前**卖出****0.00602**1 0.00602 0x2D89...f718[](https://bscscan.com/tx/0x3fd5b80843776c054fc53e5cdb7213ccdaf197d78e790523ce8a861abf0e638c "在区块浏览器查看交易")
 32| 11小时前**买入****0.00616**1 0.00616 0x3348...9B8f[](https://bscscan.com/tx/0xe871a424fd517819e0b301741c016bb09e10297927f105357cee06c4d16929be "在区块浏览器查看交易")
 33| 12小时前**买入****0.1047**17 0.00616 0xca38...A89A[](https://bscscan.com/tx/0x5a63e177a536e20ed578eb2a99e95e0fe8574b1a6e3dde65ab324fec0496c883 "在区块浏览器查看交易")
 34| 12小时前**卖出****0.0413**7 0.0059 0xE4D4...8a15[](https://bscscan.com/tx/0xce948bf5420b968b0653a5917748abc68a411a01b6f6fa9806e1a778572fd2f9 "在区块浏览器查看交易")
 35| 12小时前**卖出****0.1200**20 0.0060 0xE4D4...8a15[](https://bscscan.com/tx/0x778cec585bc800450bd45e49a7ac85d2ab24533ab3d89c398f2d3b9b22a4417b "在区块浏览器查看交易")
 36| 12小时前**卖出****0.1198**20 0.00599 0xE4D4...8a15[](https://bscscan.com/tx/0x9adaa3ef1b9b7f30617e527f695461e22527d2349222c9d3e0d0d9ffbc25b118 "在区块浏览器查看交易")
 37| 12小时前**卖出****0.0666**11 0.00606 0xE4D4...8a15[](https://bscscan.com/tx/0x24f09357cd9030c1b0ac7253ec18c8ec6e4e9ae4798a1e643965c5fa8f60b564 "在区块浏览器查看交易")
 38| 12小时前**卖出****0.1214**20 0.00607 0xE4D4...8a15[](https://bscscan.com/tx/0x43fd45a72f56c64fb429f1cfecb3eb22d5c33cfc5a7c1553cd6d44975e1333cd "在区块浏览器查看交易")
 39| 12小时前**卖出****0.1920**32 0.0060 0xE4D4...8a15[](https://bscscan.com/tx/0xabed32971c73b4d6e1ed4528d30e6f230d5013614ac2a28c1606321b617cf378 "在区块浏览器查看交易")
 40| 12小时前**卖出****0.2420**40 0.00605 0xE4D4...8a15[](https://bscscan.com/tx/0x958c06bd0f90cb677ed9125b4af2bb13dd841b6798a4117ff85541cc77227642 "在区块浏览器查看交易")
 41| 13小时前**买入****0.00636**1 0.00636 0x2a7e...BA2d[](https://bscscan.com/tx/0x3641939f1615cb37b418914dc3b6f245d82da5acfef877a3f976f5ecf3db37ca "在区块浏览器查看交易")
 42| 13小时前**买入****0.1278**20 0.00639 0x9627...cBc7[](https://bscscan.com/tx/0x8c7eb12b97bf8dc0486f5d06bdf6c84042fbbe48714425fd02bab29518866b69 "在区块浏览器查看交易")
 43| 13小时前**买入****0.1278**20 0.00639 0x9627...cBc7[](https://bscscan.com/tx/0x910916861a81ce667d6c75bd213cf3b8e52f64ba65c342cdd41df6b9b363d812 "在区块浏览器查看交易")
 44| 13小时前**买入****0.0632**10 0.00632 0x9627...cBc7[](https://bscscan.com/tx/0x248737b33228ba13246e43e5a615ab6907eb58c6e2a6bd475d8c6ff2d85c5148 "在区块浏览器查看交易")
 45| 13小时前**买入****0.1264**20 0.00632 0x9627...cBc7[](https://bscscan.com/tx/0xaf1c499ebb9db9d1378d7b2c55203a2985453028aea051d649700c688d17752c "在区块浏览器查看交易")
 46| 13小时前**买入****0.0189**3 0.00632 0xE6F3...a8dD[](https://bscscan.com/tx/0x83a6dd3803eca18d23fe05ffdb1aa844d9518106c850457bcf5a02b9786d2c64 "在区块浏览器查看交易")
 47| 13小时前**卖出****0.0126**2 0.00632 0x48a4...912d[](https://bscscan.com/tx/0x3b7f4356e7fe932d127991060fd8ad2d3fd2df755cb4546c9e4e160400428b10 "在区块浏览器查看交易")
 48| 13小时前**买入****0.0316**5 0.00632 0xdbCF...adE7[](https://bscscan.com/tx/0x9eccbaeac7be1f7ddee4e384238c0a5a92d7bced4659f1db4b500e89d5e74159 "在区块浏览器查看交易")
 49| 13小时前**买入****0.4800**75 0.0064 0x2252...42AD[](https://bscscan.com/tx/0x806fade5bf3ee3d470ff9eaf6b7b2b8aa87be989b7034bb925d0c1389e69dd24 "在区块浏览器查看交易")
 50| 13小时前**卖出****0.0364**6 0.00608 0xD8cc...371e[](https://bscscan.com/tx/0x3a0ada07b2178dc808783a0d7ff731c57058e032556ea10eb1e506f0eb7186e6 "在区块浏览器查看交易")
 51| 13小时前**买入****0.0127**2 0.00639 0xdbCF...adE7[](https://bscscan.com/tx/0x6edee1e2e112d4d1d7f2236952defae3e5559bd2a8e2369cfab088ed5728206c "在区块浏览器查看交易")
 52| 13小时前**买入****0.00632**1 0.00632 0xdbCF...adE7[](https://bscscan.com/tx/0xacdea8b5a922896e3ca0e49dd0dc145134883965c5b1314780452e24ba3c62d1 "在区块浏览器查看交易")
 53| 14小时前**卖出****0.1234**20 0.00617 0x48a4...912d[](https://bscscan.com/tx/0x8e47f4c7a05947306e8489f1d232fa9fdf6371c26e9b944d5d3709df6d9d560b "在区块浏览器查看交易")
 54| 14小时前**卖出****0.0309**5 0.00619 0x48a4...912d[](https://bscscan.com/tx/0x84906e32e1c1d4d0d1a60afa1848c8affb7f74bb4bc7a88672faf5795c7e5b68 "在区块浏览器查看交易")
 55| 14小时前**卖出****0.5800**100 0.0058 0xE4D4...8a15[](https://bscscan.com/tx/0xadbae25de1cc49ba090ef375689646be26911757b7109365db956bf6b502b370 "在区块浏览器查看交易")
 56| 14小时前**卖出****0.0378**6 0.0063 0x091f...6468[](https://bscscan.com/tx/0x1fd96046cd5e7e3509ba10375921299c045b150777291eb38ac2734452e8818e "在区块浏览器查看交易")
 57| 15小时前**卖出****0.1144**18 0.00636 0x2392...485E[](https://bscscan.com/tx/0xf28158bcb75cec873be7a1892b760ab10b7e6022ab6df22c22b6baed275ad708 "在区块浏览器查看交易")
 58| 15小时前**卖出****0.1274**20 0.00637 0x2392...485E[](https://bscscan.com/tx/0x454087aa83a18f669f13b43ee1e913ae44684d66b72a22d8617378d773f0b8b5 "在区块浏览器查看交易")
 59| 15小时前**卖出****0.00636**1 0.00636 0x2392...485E[](https://bscscan.com/tx/0xb7e69f9866f59c3224d3b335c58224fb5a0b538c5c7abe9144a7193a2badacbd "在区块浏览器查看交易")
 60| 15小时前**买入****0.0806**13 0.0062 0x7c9F...9c74[](https://bscscan.com/tx/0xcac381f6bb62c3bfff325f81edab9de9e4526cbdfc0853671468de0b276177ce "在区块浏览器查看交易")
 61| 15小时前**买入****0.1238**20 0.00619 0x7c9F...9c74[](https://bscscan.com/tx/0x1e619ba3280d3a45347c82c7f64da65c2c5ecd2e948295403ce735e0d265238b "在区块浏览器查看交易")
 62| 16小时前**买入****0.1224**20 0.00612 0xD8cc...371e[](https://bscscan.com/tx/0xccae7dbd05a46853bfe05a12b73dcfef14e5ab065483d0d775820bf73ac49980 "在区块浏览器查看交易")
 63| 16小时前**卖出****0.1154**20 0.00577 0xf83a...7a3f[](https://bscscan.com/tx/0xa93d0224a2f74d4f545cbcff6a7dd49528022e60d28cea3914842dcc29e99411 "在区块浏览器查看交易")
 64| 17小时前**买入****0.0337**5 0.00674 0x64D5...36BB[](https://bscscan.com/tx/0x075651df1d8a8db38b82eda7f75b94309f99f6d1742907ec156c7af571a99c08 "在区块浏览器查看交易")
 65| 17小时前**买入****0.00673**1 0.00673 0x64D5...36BB[](https://bscscan.com/tx/0xc8c25dfee964e81e5c2b694431f31b497aeff0acd98103a716c30fea27766dd1 "在区块浏览器查看交易")
 66| 17小时前**买入****0.1238**20 0.00619 0x64D5...36BB[](https://bscscan.com/tx/0x2f9290b3fec2287689345209f2d0fd7512e9b100e6561a4b21dcb8ec00b50c4a "在区块浏览器查看交易")
 67| 17小时前**卖出****0.3000**50 0.0060 0xE4D4...8a15[](https://bscscan.com/tx/0x0a352bb21c339cae012689dda9df4aef7a6614a5ed42f7099697a83babe44fb1 "在区块浏览器查看交易")
 68| 17小时前**卖出****0.2100**35 0.0060 0xE4D4...8a15[](https://bscscan.com/tx/0x1370252e2b186e2803b028da36ab7bbdc67afe36add2e1b4faa233b49da36803 "在区块浏览器查看交易")
 69| 17小时前**买入****0.0942**14 0.00673 0xd4FE...a1cD[](https://bscscan.com/tx/0xb859c52bcb742f71cb489c95dcdf96a3bd840c8504ecc963e8ed8204339f3d0f "在区块浏览器查看交易")
 70| 17小时前**买入****0.00613**1 0.00613 0xd4FE...a1cD[](https://bscscan.com/tx/0xb859c52bcb742f71cb489c95dcdf96a3bd840c8504ecc963e8ed8204339f3d0f "在区块浏览器查看交易")
 71| 18小时前**卖出****0.0292**5 0.00584 0x8F11...87cB[](https://bscscan.com/tx/0x15153f259ce2390af82b1c023934b05e68afc71f8e3418e39139c994058e57ff "在区块浏览器查看交易")
 72| 18小时前**买入****0.0247**4 0.00618 0xBbF0...Cf67[](https://bscscan.com/tx/0x6bc027a93bfbc2dd87f28dbf474304e4655c17f0b710d547f3b070505fdf0b93 "在区块浏览器查看交易")
 73| 18小时前**买入****0.00613**1 0.00613 0xBbF0...Cf67[](https://bscscan.com/tx/0x6bc027a93bfbc2dd87f28dbf474304e4655c17f0b710d547f3b070505fdf0b93 "在区块浏览器查看交易")
 74| 18小时前**买入****0.00585**1 0.00585 0x48a4...912d[](https://bscscan.com/tx/0xed23f5c712930f3598417ddeaece6f08d73bbb6b19c790592d644c0264011ef4 "在区块浏览器查看交易")
 75| 19小时前**卖出****0.2855**50 0.00571 0x531f...5E43[](https://bscscan.com/tx/0x0c90631f4b4872c69fa69e07f3b65c7afb5477fe844b81c7f3b2db141b89879b "在区块浏览器查看交易")
 76| 19小时前**买入****0.1172**20 0.00586 0x48a4...912d[](https://bscscan.com/tx/0x109cb54993077be7a083d813c939531cb1350e5dddc153d5788ec9ae5bb00445 "在区块浏览器查看交易")
 77| 19小时前**卖出****0.7251**127 0.00571 0x6425...0D1f[](https://bscscan.com/tx/0x799429357c95b5424a85deea577d62c2288f68680e999964e342fd402678d909 "在区块浏览器查看交易")
 78| 19小时前**卖出****0.0456**8 0.00571 0x6425...0D1f[](https://bscscan.com/tx/0x799429357c95b5424a85deea577d62c2288f68680e999964e342fd402678d909 "在区块浏览器查看交易")
 79| 19小时前**卖出****0.0920**16 0.00575 0x6425...0D1f[](https://bscscan.com/tx/0x799429357c95b5424a85deea577d62c2288f68680e999964e342fd402678d909 "在区块浏览器查看交易")
 80| 20小时前**买入****0.0128**2 0.00643 0x26d8...884E[](https://bscscan.com/tx/0x1a2f6d8a271e4ad794011ef2add09478d664c922e597fe2cdd2b6fa186ab2514 "在区块浏览器查看交易")
 81| 20小时前**卖出****0.0571**10 0.00571 0xC6e3...cE33[](https://bscscan.com/tx/0xa71f7b642c5b6ebcbf93d3b190d0f2b0a48bddb50976ac70ab9240449eeeef08 "在区块浏览器查看交易")
 82| 20小时前**卖出****0.9243**165 0.0056 0xE4D4...8a15[](https://bscscan.com/tx/0x5964ea8da50b6eb6fb32d2767c9473e212016effa76d33f51b5d8632def3db8c "在区块浏览器查看交易")
 83| 20小时前**卖出****0.2801**50 0.0056 0xE4D4...8a15[](https://bscscan.com/tx/0x7127769d42b2c09794f3adf9820870e4fd80bd2798028729e48e8eac08774e36 "在区块浏览器查看交易")
 84| 20小时前**买入****0.1054**18 0.00586 0x48a4...912d[](https://bscscan.com/tx/0xcfee7f8b3b5dfb62551c5277253f5e35d59200b0eb0c56b0a204841eb6c9a018 "在区块浏览器查看交易")
 85| 20小时前**买入****0.1138**20 0.00569 0x48a4...912d[](https://bscscan.com/tx/0xf51ac1986d5d363b317526000df3fe5aaa86e395e186f3410fc8a5d47434f9cb "在区块浏览器查看交易")
 86| 20小时前**卖出****0.1009**18 0.00561 0xC6e3...cE33[](https://bscscan.com/tx/0xa8793ddef0cdebc5822025735aefa9ab3f15ba80d68b8ced7fbaa7cb4f0836ce "在区块浏览器查看交易")
 87| 21小时前**卖出****0.00561**1 0.00561 0xbd6B...b385[](https://bscscan.com/tx/0xf797bc0e00cb0c0cfdfebdb8fa44df3898604cb3562a2df7bb8d8d80e15232b1 "在区块浏览器查看交易")
 88| 21小时前**买入****0.0059**1 0.0059 0xd48a...3744[](https://bscscan.com/tx/0xc91ba14769a02729f8380ff95a58f6c7aa4e95e8688fd1e8df45a74db11d1e1c "在区块浏览器查看交易")
 89| 21小时前**卖出****0.0562**10 0.00562 0xC6e3...cE33[](https://bscscan.com/tx/0x37c71f8fb353c69486ba5f0328cdd36e18de14a62a56141b91262f11907ee7f7 "在区块浏览器查看交易")
 90| 22小时前**卖出****0.5570**100 0.00557 0xE4D4...8a15[](https://bscscan.com/tx/0x4712c2fe9e3a2f4a8d774eb56e7848a81c7afe63904da2ea0ef5161f77b9e2e4 "在区块浏览器查看交易")
 91| 22小时前**卖出****0.5400**100 0.0054 0x9359...8888[](https://bscscan.com/tx/0x4abfc2a3efd6ccd503cdc01884f06695c9a48754893cb211d5ef4144900c1576 "在区块浏览器查看交易")
 92| 22小时前**卖出****0.0110**2 0.0055 0x9359...8888[](https://bscscan.com/tx/0x588dc0f5f9740135203a9fa250ceb63d7c66bfffa5633861d6254aab74a13533 "在区块浏览器查看交易")
 93| 22小时前**买入****0.0359**6 0.00599 0x4E9c...B1B1[](https://bscscan.com/tx/0x85e1ccde9315b639239d9b9de94ff803f905bd26af177c91c70b0b8c961ed3f1 "在区块浏览器查看交易")
```

## Proposed revision

Verdict: **still_accurate**

The excerpt is the same per-fill trade tape the current entry describes: every row shows a buy/sell direction (买入/卖出), a total BNB amount, a quantity, a unit price, a truncated counterparty wallet, and a BscScan transaction link (e.g. lines 1, 4, 6, 22, 82), with timestamps spanning minutes to roughly 22 hours back (line 82), matching 'running hours deep.' Nothing in the excerpt shows the landing page, navigation, or other sections, so the entry's scope note (this tape being the only surface retrievable) also still holds. The flagged page-change timestamp is consistent with the tape simply accruing new fills over time, not a structural or framing change. No claim in the current summary is contradicted or extended beyond what this excerpt shows, so no text change is warranted.

```json
{
  "verdict": "still_accurate",
  "summary_en": null,
  "summary_zh": null,
  "citations": [
    1,
    4,
    6,
    22,
    82
  ]
}
```
