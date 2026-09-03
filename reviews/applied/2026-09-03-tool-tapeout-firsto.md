---
id: tool-tapeout-firsto
url: https://tapeout.firsto.ai/
status: revouch
generated_at: 2026-09-03T05:46:07.901Z
reviewed_at: 2026-09-02T02:11:46Z
changed_at: 2026-09-03T00:00:31.435Z
fetch_path: r.jina.ai
excerpt_lines: 100
model: sonnet
---
# Review: TapeOut Firsto marketplace

Set `status: approved` to apply the JSON block at the bottom (edit it first if needed), or `status: revouch` to keep the text and refresh the review date. Then run `node scripts/apply_reviews.mjs`.

## Entry as it stands

**summary_en:** Third-party ecosystem trading surface for TapeOut-related transistor and mining-machine listings, presenting itself as a professional trading terminal rather than a listings board. Behind the landing page it serves a live per-fill trade tape: every fill shows buy or sell direction, total BNB, quantity, unit price, the counterparty wallet and a BscScan transaction link, running hours deep. Scope note: that tape was the only surface this review could retrieve — no navigation and no other sections came back — so this describes what the interior shows, not the full extent of what the site offers. Use it as a discovery and market-reading surface, separate from official protocol and ownership data.

**summary_zh:** 第三方生态交易入口，展示 TapeOut 相关晶体管与矿机条目，自我定位为「专业交易终端」而非单纯的挂单板。落地页之后确实提供一条实时逐笔成交流水：每一笔都给出买入/卖出方向、总 BNB、数量、单价、对手方钱包，以及一个 BscScan 交易链接，可回溯数小时。范围说明：本次审核只取回了这一个界面，导航和其他板块都没有取回，所以以上写的是内部展示了什么，不代表该站提供的全部内容。可用于发现和阅读市场信息，但应与官方协议和持仓数据分开看待。

**safety_en:** Community marketplace, not an official price or ownership source. Listings, displayed prices and availability can change and do not guarantee execution; verify contracts and signing requests independently.

## Self-audit signal

Page changed 2026-09-03T00:00:31.435Z; entry reviewed 2026-09-02T02:11:46Z.

Labels added: []
Labels removed: []

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
| 6 zh | 落地页之后确实提供一条实时逐笔成交流水：每一笔都给出买入/卖出方向、总 BNB、数量、单价、对手方钱包，以及一个 BscScan 交易链接，可回溯数小时。 | 6 | 卖出, 交易, 小时 | supported |
| 7 zh | 范围说明：本次审核只取回了这一个界面，导航和其他板块都没有取回，所以以上写的是内部展示了什么，不代表该站提供的全部内容。 | — |  | no match |
| 8 zh | 可用于发现和阅读市场信息，但应与官方协议和持仓数据分开看待。 | — |  | no match |

## Excerpt (as served, numbered)

```text
  1| 8分钟前**买入****0.00915**1 0.00915 0x8980...82c6[](https://bscscan.com/tx/0x7f1c1e945ccbebb209a40bc638b1648d9502519787fdba1e6a06c60649c2272b "在区块浏览器查看交易")
  2| 19分钟前**买入****0.00915**1 0.00915 0x8980...82c6[](https://bscscan.com/tx/0x792796fdc273791488ac569ea6c81f2b639f717f487b2b988c1dfd3fc49519fa "在区块浏览器查看交易")
  3| 23分钟前**卖出****0.1540**20 0.0077 0xbd6B...b385[](https://bscscan.com/tx/0x1d6d06616f96f094b478118012512e46ce09e4329a75e46b85a36fc099a9fb51 "在区块浏览器查看交易")
  4| 39分钟前**卖出****0.1328**16 0.0083 0x48a4...912d[](https://bscscan.com/tx/0x9854ef45e21e046a9fb437bc383de30c0fcdb5cfdea38777c9880fa7e9acbd33 "在区块浏览器查看交易")
  5| 44分钟前**卖出****0.2253**30 0.00751 0x6911...7941[](https://bscscan.com/tx/0x3d80a76d021dccbcf6e596102fd6ec9a031aee333c5108f42d3a7335885a60cc "在区块浏览器查看交易")
  6| 1小时前**卖出****0.2273**28 0.00812 0xbd6B...b385[](https://bscscan.com/tx/0x36a5ff6a8e7b2481209bfbc7fb3525c71c37be1abda2fb709c91b167afd0d6df "在区块浏览器查看交易")
  7| 1小时前**卖出****0.1161**14 0.00829 0x9359...8888[](https://bscscan.com/tx/0xba1fb556a50edf67d6473eb3bcd3d3d609422b9126a038bd5b2d0ac482277a97 "在区块浏览器查看交易")
  8| 1小时前**卖出****0.1660**20 0.0083 0x9359...8888[](https://bscscan.com/tx/0xb357af1c0270e0599c3675ec1b790187e50f0bf6b3a5ca94e6e1b232f3424236 "在区块浏览器查看交易")
  9| 1小时前**卖出****0.1562**17 0.00919 0x7c9F...9c74[](https://bscscan.com/tx/0xc73a3a244344b199764b538f5c88d6344c37476dbeb676e01fc446781026b399 "在区块浏览器查看交易")
 10| 1小时前**买入****0.1379**15 0.00919 0xAe54...E4cc[](https://bscscan.com/tx/0x224f6cba0a3ccb463776032c3a522176ecc3f2ce6bb52ed0d9d8efe7271a3c99 "在区块浏览器查看交易")
 11| 1小时前**卖出****0.0172**2 0.0086 0x48a4...912d[](https://bscscan.com/tx/0xcdcdf995fdd444b4acc886f05a9c2b35d447c8aecfbfacfb9d6d0cd50a69809c "在区块浏览器查看交易")
 12| 1小时前**卖出****0.1445**17 0.0085 0x48a4...912d[](https://bscscan.com/tx/0x8db6c4070d865c30516cb8c5f3d96e47a2c028625e8d8303dcc99c8bb3e6bc5d "在区块浏览器查看交易")
 13| 1小时前**卖出****0.0935**11 0.0085 0x48a4...912d[](https://bscscan.com/tx/0x41b6747996525a885f256de926ee4ac37da617d640ee6216acdc37eadbce6e9b "在区块浏览器查看交易")
 14| 2小时前**买入****0.0269**3 0.00898 0x7c9F...9c74[](https://bscscan.com/tx/0xcce177edafca58fcdc72e11c61467c7f4b89428e361326380e882b4b29915149 "在区块浏览器查看交易")
 15| 2小时前**买入****0.1794**20 0.00897 0x7c9F...9c74[](https://bscscan.com/tx/0x8bea7d78f79d491a779aa36ea3d4ed01c9f2e963465e8785b9ea546ab286596a "在区块浏览器查看交易")
 16| 2小时前**买入****1.6213**183 0.00886 0x7c9F...9c74[](https://bscscan.com/tx/0xd2b758f6228b0e4afaed4225b0c14635df6c804f35c49fa7feca92fe3b93f1c2 "在区块浏览器查看交易")
 17| 2小时前**卖出****0.2250**30 0.0075 0x9359...8888[](https://bscscan.com/tx/0x2be7ca615885bc680df2b0e5c05d2097ee58cab9fa56965cb745abe49ec8dedf "在区块浏览器查看交易")
 18| 2小时前**卖出****0.3000**40 0.0075 0x2fE3...3a45[](https://bscscan.com/tx/0x09a70ee267531c192b0f143e9cbba619550e09907f4f8cf58a498acbd5cf4f37 "在区块浏览器查看交易")
 19| 2小时前**卖出****0.0077**1 0.0077 0x9359...8888[](https://bscscan.com/tx/0x8b46909d4a78b761ab39fd2227266f16bd5b662da093334fcee3bbd2e0752b92 "在区块浏览器查看交易")
 20| 2小时前**卖出****0.1542**20 0.00771 0x9359...8888[](https://bscscan.com/tx/0x098bf4a4856aba6ab4235b3ec4fc2479592ea22f8db65d0802a7a4b94436a46f "在区块浏览器查看交易")
 21| 2小时前**买入****0.00898**1 0.00898 0xdbCF...adE7[](https://bscscan.com/tx/0x84a00798c60f93179ef15ea05c3810cec17405af6022640cbcf0326e367e5387 "在区块浏览器查看交易")
 22| 2小时前**买入****0.2694**30 0.00898 0xdbCF...adE7[](https://bscscan.com/tx/0x31e0e59df0cd8b41db26d134cd39d29f73ce4f9a2e55e58b8583166b235efdae "在区块浏览器查看交易")
 23| 2小时前**买入****0.1436**16 0.00898 0x15B9...7DD5[](https://bscscan.com/tx/0xe056843bea509f3bd85497f286c7dd47209e1a58aa76ac6be3dcfc280c55a488 "在区块浏览器查看交易")
 24| 2小时前**买入****0.0880**10 0.0088 0xdbCF...adE7[](https://bscscan.com/tx/0x4f5915b9130e5f04fa135fc8806ee57343011f75a19cab77f962cea9cf873ab3 "在区块浏览器查看交易")
 25| 2小时前**买入****0.0085**1 0.0085 0x7c9F...9c74[](https://bscscan.com/tx/0x1411474e0ae33ad6611fce69345a643d135f5674a848bb0c462681d116850163 "在区块浏览器查看交易")
 26| 2小时前**买入****0.0168**2 0.00844 0x7c9F...9c74[](https://bscscan.com/tx/0xdd54392669af7cd084f33da65bf56e158671c51ae319884d684a5b30c395c972 "在区块浏览器查看交易")
 27| 2小时前**买入****0.1694**20 0.00847 0x7c9F...9c74[](https://bscscan.com/tx/0xbbcd786d06d62df5e5c12f841f9132800f61e22901523cd8ca4e26a2ae30c376 "在区块浏览器查看交易")
 28| 2小时前**买入****0.0498**6 0.0083 0x7c9F...9c74[](https://bscscan.com/tx/0x1ede0e74747e126018a48ec770e537ad396cf4be212bbc67b1f4750d008e68c8 "在区块浏览器查看交易")
 29| 2小时前**买入****0.3762**45 0.00836 0x7c9F...9c74[](https://bscscan.com/tx/0x7bdf4ef17f20a831321afd0a7f7129e85c8f410533aac907061ffe5a959ef404 "在区块浏览器查看交易")
 30| 2小时前**买入****0.1005**12 0.00838 0x15B9...7DD5[](https://bscscan.com/tx/0x472919d60194f39fa158dd198b4f2f2b28322a09b160b7668c9b956e2acbabd9 "在区块浏览器查看交易")
 31| 2小时前**买入****0.0083**1 0.0083 0xdbCF...adE7[](https://bscscan.com/tx/0xf0895749bad863ec002c79bb615a095f9be0bb01d79f774387a56bde393d2934 "在区块浏览器查看交易")
 32| 2小时前**买入****0.1409**17 0.00829 0x15B9...7DD5[](https://bscscan.com/tx/0xeae148fe8ba093d7258b85717c1e3f0ec8632415c134f13565eeaafd26e32191 "在区块浏览器查看交易")
 33| 3小时前**买入****0.00829**1 0.00829 0xdbCF...adE7[](https://bscscan.com/tx/0x25e5bc8b2f0a23e61bf464fb35576a041fd1b119f676680315529e125cbc197f "在区块浏览器查看交易")
 34| 3小时前**买入****0.00829**1 0.00829 0xdbCF...adE7[](https://bscscan.com/tx/0xe2478853298ae6a2c107851a39e19ac285d0636f0c3b43245537402f76352e6c "在区块浏览器查看交易")
 35| 3小时前**买入****0.00829**1 0.00829 0xdbCF...adE7[](https://bscscan.com/tx/0xb771e02fd09a072a79ec3487cbc9a626fc3bf597f4b612ea1469f6cbed0c957e "在区块浏览器查看交易")
 36| 3小时前**卖出****0.1800**24 0.0075 0x9359...8888[](https://bscscan.com/tx/0x7542d4b49c5d57c115ec6a1e8c614a67b720c51c24549d98944998c86c45c0d9 "在区块浏览器查看交易")
 37| 3小时前**卖出****0.1502**20 0.00751 0x9359...8888[](https://bscscan.com/tx/0x761a955a43714d3ed79084bd7f1224a78a76bdcd66ff502b9d8a14d65d9b11a0 "在区块浏览器查看交易")
 38| 3小时前**买入****0.0083**1 0.0083 0x9627...cBc7[](https://bscscan.com/tx/0xfa47584a934af6935c182758bfe1d144aa724d550bcb7a4122d5fa98a3956362 "在区块浏览器查看交易")
 39| 3小时前**卖出****0.7300**100 0.0073 0x9359...8888[](https://bscscan.com/tx/0x9dcc10d4dd3a5bb246dad16d56d82ae4df90b238043da371a96af632f5bc85de "在区块浏览器查看交易")
 40| 3小时前**买入****0.1530**20 0.00765 0x7c9F...9c74[](https://bscscan.com/tx/0xed46cf5ada2f56d0e36212fc78a10ad51b1dff6dd431e48921393c406202947b "在区块浏览器查看交易")
 41| 3小时前**买入****0.00745**1 0.00745 0x7c9F...9c74[](https://bscscan.com/tx/0x609ef363c1ae0f0ca3e98ef97e27a5f03aac7404b43b249a0799f872eed7001a "在区块浏览器查看交易")
 42| 3小时前**卖出****0.0657**9 0.00731 0x9359...8888[](https://bscscan.com/tx/0xc818674cec3b0ed77e54d4f6ab057d3af759773863b549bdf2a76a09d0042810 "在区块浏览器查看交易")
 43| 3小时前**卖出****0.1464**20 0.00732 0x9359...8888[](https://bscscan.com/tx/0x4aad271b765085890892be40349dec4ab32f007321c8b83d1e817305e0397123 "在区块浏览器查看交易")
 44| 4小时前**买入****0.0419**5 0.00839 0x9627...cBc7[](https://bscscan.com/tx/0x44d8f081c97c65f0579ec04e69f5a2abdd89ddf141a810d84e80249f4dc1e005 "在区块浏览器查看交易")
 45| 4小时前**买入****0.1592**19 0.00838 0x9627...cBc7[](https://bscscan.com/tx/0xfbb498498f4fbceb1cd26ea66244f6b8e49409ce99b2dccf5be573bbed4796cc "在区块浏览器查看交易")
 46| 4小时前**买入****0.00838**1 0.00838 0xd48a...3744[](https://bscscan.com/tx/0x3398af055a0b5c0c8d7fe6192573a5e30282da502cce0a8681714895c95db0d0 "在区块浏览器查看交易")
 47| 4小时前**买入****0.3713**44 0.00844 0x9627...cBc7[](https://bscscan.com/tx/0x2218b0b42256304f50771352ab6d2c578fe6f1aa5762f76c0f6214b2be8e3b3e "在区块浏览器查看交易")
 48| 4小时前**卖出****0.7300**100 0.0073 0x39Dc...75A3[](https://bscscan.com/tx/0xfee4d248201b6631bd299b5e58bc03290aac53cc6afd55eed571f93ac0a9024e "在区块浏览器查看交易")
 49| 4小时前**卖出****0.0284**4 0.00711 0xc136...8560[](https://bscscan.com/tx/0x8217e3b445e48cb55da97b6b8d3edd43004268b63dab1720e3603d38a226f43d "在区块浏览器查看交易")
 50| 6小时前**卖出****0.1542**22 0.00701 0x39Dc...75A3[](https://bscscan.com/tx/0x578495a1e78ecc1e914c2d272bb86b1a16c41108847ce1feb9c7247025368359 "在区块浏览器查看交易")
 51| 6小时前**卖出****0.00701**1 0.00701 0x27BA...1710[](https://bscscan.com/tx/0x9bf7e06cc53a3950eec4ef2dfac7ebd120b4cd4825e81e31acd00fd602c5912d "在区块浏览器查看交易")
 52| 6小时前**卖出****0.6700**100 0.0067 0x39Dc...75A3[](https://bscscan.com/tx/0xb09dc25d3a8688b122f0bd45932a3255f0b5370009f93ef95166dd4a6a62ade5 "在区块浏览器查看交易")
 53| 6小时前**卖出****0.1237**16 0.00773 0xdbfc...13ca[](https://bscscan.com/tx/0xd904ad37bcd0d6eafcebec6af6fcc508f24197ff9911715f725e439cf3ce938e "在区块浏览器查看交易")
 54| 6小时前**卖出****0.00773**1 0.00773 0xdbfc...13ca[](https://bscscan.com/tx/0xd904ad37bcd0d6eafcebec6af6fcc508f24197ff9911715f725e439cf3ce938e "在区块浏览器查看交易")
 55| 6小时前**卖出****0.1549**20 0.00774 0xdbfc...13ca[](https://bscscan.com/tx/0xd904ad37bcd0d6eafcebec6af6fcc508f24197ff9911715f725e439cf3ce938e "在区块浏览器查看交易")
 56| 6小时前**卖出****0.1317**17 0.00774 0xdbfc...13ca[](https://bscscan.com/tx/0xd904ad37bcd0d6eafcebec6af6fcc508f24197ff9911715f725e439cf3ce938e "在区块浏览器查看交易")
 57| 7小时前**买入****0.1090**13 0.00839 0xB049...D76D[](https://bscscan.com/tx/0x7af532a099a4db0d583308309452b8c7bf6323d14af1d2cba5d702cb7c4e9d89 "在区块浏览器查看交易")
 58| 7小时前**卖出****0.4178**45 0.00928 0x6cD1...4C91[](https://bscscan.com/tx/0x34de562409b70b4b0bfddf178e6cb30d8269e6120c4286409dbe44624decd00d "在区块浏览器查看交易")
 59| 7小时前**买入****0.1006**12 0.00839 0x6cD1...4C91[](https://bscscan.com/tx/0x34de562409b70b4b0bfddf178e6cb30d8269e6120c4286409dbe44624decd00d "在区块浏览器查看交易")
 60| 7小时前**买入****0.2557**33 0.00775 0x6cD1...4C91[](https://bscscan.com/tx/0x34de562409b70b4b0bfddf178e6cb30d8269e6120c4286409dbe44624decd00d "在区块浏览器查看交易")
 61| 7小时前**买入****0.3100**40 0.00775 0xB049...D76D[](https://bscscan.com/tx/0x9cc8144875ffeddb6ef60bce7ae3f792debb0a9a93892f12e64f6f70fb41884f "在区块浏览器查看交易")
 62| 8小时前**卖出****0.00835**1 0.00835 0x983F...2aCA[](https://bscscan.com/tx/0x0d2b1a632a50ab8f097ec98993d93862284f6dad141f77a0d43c84fc60761140 "在区块浏览器查看交易")
 63| 8小时前**买入****0.00775**1 0.00775 0x983F...2aCA[](https://bscscan.com/tx/0x0d2b1a632a50ab8f097ec98993d93862284f6dad141f77a0d43c84fc60761140 "在区块浏览器查看交易")
 64| 8小时前**卖出****0.0501**6 0.00835 0x89C6...45Fd[](https://bscscan.com/tx/0x52904531ec692f8c55149e95dc1148c56b92edd05a3859c00ec9f2de1c77d81a "在区块浏览器查看交易")
 65| 8小时前**买入****0.0465**6 0.00775 0x89C6...45Fd[](https://bscscan.com/tx/0x52904531ec692f8c55149e95dc1148c56b92edd05a3859c00ec9f2de1c77d81a "在区块浏览器查看交易")
 66| 8小时前**卖出****0.1763**19 0.00928 0x6cD1...4C91[](https://bscscan.com/tx/0x11b7294f7f3cd384ffc234c4c8c7a6125771bd4821b86d2fa2453512fc3980b5 "在区块浏览器查看交易")
 67| 8小时前**买入****0.1470**19 0.00774 0x6cD1...4C91[](https://bscscan.com/tx/0x11b7294f7f3cd384ffc234c4c8c7a6125771bd4821b86d2fa2453512fc3980b5 "在区块浏览器查看交易")
 68| 8小时前**卖出****0.3713**48 0.00773 0x983F...2aCA[](https://bscscan.com/tx/0x482058777fa02eeee497ec10e55d4e3f34812eb0ad03a7438ca05c5c8cca7667 "在区块浏览器查看交易")
 69| 8小时前**买入****0.0825**11 0.0075 0x983F...2aCA[](https://bscscan.com/tx/0x482058777fa02eeee497ec10e55d4e3f34812eb0ad03a7438ca05c5c8cca7667 "在区块浏览器查看交易")
 70| 8小时前**买入****0.0149**2 0.00747 0x983F...2aCA[](https://bscscan.com/tx/0x482058777fa02eeee497ec10e55d4e3f34812eb0ad03a7438ca05c5c8cca7667 "在区块浏览器查看交易")
 71| 8小时前**买入****0.1341**18 0.00745 0x983F...2aCA[](https://bscscan.com/tx/0x482058777fa02eeee497ec10e55d4e3f34812eb0ad03a7438ca05c5c8cca7667 "在区块浏览器查看交易")
 72| 8小时前**买入****0.1264**17 0.00744 0x983F...2aCA[](https://bscscan.com/tx/0x482058777fa02eeee497ec10e55d4e3f34812eb0ad03a7438ca05c5c8cca7667 "在区块浏览器查看交易")
 73| 8小时前**卖出****0.00772**1 0.00772 0x983F...2aCA[](https://bscscan.com/tx/0x495044cf8a69750261f304284e00284d795e43659c7e5a42707e8276e159f7a1 "在区块浏览器查看交易")
 74| 8小时前**买入****0.00744**1 0.00744 0x983F...2aCA[](https://bscscan.com/tx/0x495044cf8a69750261f304284e00284d795e43659c7e5a42707e8276e159f7a1 "在区块浏览器查看交易")
 75| 9小时前**卖出****0.00773**1 0.00773 0x983F...2aCA[](https://bscscan.com/tx/0x51e3fa20915ae0f66c054d73c7b038017e983a0c0a59da47cf093b3a05576aa5 "在区块浏览器查看交易")
 76| 9小时前**买入****0.00745**1 0.00745 0x983F...2aCA[](https://bscscan.com/tx/0x51e3fa20915ae0f66c054d73c7b038017e983a0c0a59da47cf093b3a05576aa5 "在区块浏览器查看交易")
 77| 9小时前**卖出****0.00772**1 0.00772 0x983F...2aCA[](https://bscscan.com/tx/0x6637c6466191c470657a177846ce8377c814c18c5cd0d285c615dcc4ec02b99b "在区块浏览器查看交易")
 78| 9小时前**买入****0.00745**1 0.00745 0x983F...2aCA[](https://bscscan.com/tx/0x6637c6466191c470657a177846ce8377c814c18c5cd0d285c615dcc4ec02b99b "在区块浏览器查看交易")
 79| 10小时前**卖出****0.00715**1 0.00715 0xdB82...409c[](https://bscscan.com/tx/0x877117c8d82bbfd6f395a43a913eabda09705e97d90ebd07b4f82b3a75782d2c "在区块浏览器查看交易")
 80| 10小时前**卖出****0.00715**1 0.00715 0xdB82...409c[](https://bscscan.com/tx/0x9aff7179204132990220f4597801714901f3c3bcee55f1c64c49ec1269502367 "在区块浏览器查看交易")
 81| 11小时前**卖出****0.5364**81 0.00662 0xe8e3...0555[](https://bscscan.com/tx/0x0babd5dc179f03e0b0486254fa47d193f1281898016377159190bd3114f3e363 "在区块浏览器查看交易")
 82| 11小时前**卖出****0.0331**5 0.00662 0x3659...768F[](https://bscscan.com/tx/0x302b9651cb865124cdacdbe8f92850ff6222a376ef4ec932ad3120d03cc8e428 "在区块浏览器查看交易")
 83| 11小时前**卖出****0.00715**1 0.00715 0x3659...768F[](https://bscscan.com/tx/0xc7122b873661307e733333fe7750d9301d8e2237d362b4e5160a5e1618aa9a82 "在区块浏览器查看交易")
 84| 12小时前**卖出****0.0397**6 0.00662 0xa1bA...Cc37[](https://bscscan.com/tx/0x4cce919d2fc45aad87022165c747b38ae809a82c5312c65e61ceacf7b452a458 "在区块浏览器查看交易")
 85| 12小时前**卖出****0.2847**43 0.00662 0xe8e3...0555[](https://bscscan.com/tx/0x8d7d118d117054a44cd90c3bcbd61914bf869296551d7aa21022b953806bc5e3 "在区块浏览器查看交易")
 86| 12小时前**卖出****0.1302**21 0.0062 0x92c5...9bb0[](https://bscscan.com/tx/0xca36d94d37085132d3b540fa06591aa569436af8ffcdda7780fdbc82f5b27e27 "在区块浏览器查看交易")
 87| 12小时前**卖出****0.0201**3 0.0067 0x92c5...9bb0[](https://bscscan.com/tx/0xb81386d5235f64b57d2dfa2b61ee544abff4d31343eff8d577070c90b5faea78 "在区块浏览器查看交易")
 88| 12小时前**卖出****0.0143**2 0.00715 0x92c5...9bb0[](https://bscscan.com/tx/0xe6008280b5871edbc90ac289fe1ebf4f83c158b3170b8e1f5a8f053df1d98e53 "在区块浏览器查看交易")
 89| 13小时前**卖出****0.6200**100 0.0062 0x2D89...f718[](https://bscscan.com/tx/0x60c6ce6755db650f2861aede99e73c1d4bba660dcdf083b8c851bbf595af17a3 "在区块浏览器查看交易")
 90| 13小时前**卖出****0.3070**50 0.00614 0x2D89...f718[](https://bscscan.com/tx/0x689ee3b882956095f1e53ec7083d3bc00b080505213cf3a916efe66d60edbe22 "在区块浏览器查看交易")
 91| 13小时前**卖出****0.0330**5 0.0066 0x2D89...f718[](https://bscscan.com/tx/0x6e8f6bd30e3e6a064bdc0f53836e0aae21482deb799afe470fc6bacc8c4b9f89 "在区块浏览器查看交易")
 92| 13小时前**卖出****0.00714**1 0.00714 0x2D89...f718[](https://bscscan.com/tx/0xedd54fc624b8b90ce06464cc37d3ce10701ebed92284d2e51e12b4e8a0e93fdb "在区块浏览器查看交易")
 93| 13小时前**卖出****0.3966**60 0.00661 0xe8e3...0555[](https://bscscan.com/tx/0x726dc20216769db2e0cd43787358ad573df3dd93e108dddf6dd4fc13fc7cba9d "在区块浏览器查看交易")
 94| 14小时前**卖出****0.1986**30 0.00662 0x2D89...f718[](https://bscscan.com/tx/0x273125f22397bbf84ebf4643a4af403746901bc40e6975c8aec89209e732471e "在区块浏览器查看交易")
 95| 14小时前**卖出****0.2046**30 0.00682 0x2D89...f718[](https://bscscan.com/tx/0x6377b885d2b1a9478dad9804d0fc1d5bcfe5b968933dce957684074e1ca9e708 "在区块浏览器查看交易")
 96| 14小时前**卖出****0.0142**2 0.00713 0x2D89...f718[](https://bscscan.com/tx/0x8c1086559f4b09d1ca46297eedd5f3a32c2f78ae9972d6219025d4682aeedfc1 "在区块浏览器查看交易")
 97| 14小时前**卖出****0.2646**40 0.00661 0xe8e3...0555[](https://bscscan.com/tx/0xe9b9fa731fab157d7297c9d48bc2b55083eb055c50ad265ef239ab2b7964543a "在区块浏览器查看交易")
 98| 14小时前**卖出****0.9425**138 0.00683 0xC6e3...cE33[](https://bscscan.com/tx/0xba0377fde5215452ca847dc9094ed2505d1931531633ab4476b2c923a62c4145 "在区块浏览器查看交易")
 99| 14小时前**卖出****0.00683**1 0.00683 0xe8e3...0555[](https://bscscan.com/tx/0x3cce2d86986dbd69ee9aed21b567856ac8accf17bf28d2a07896e95d31a7fe03 "在区块浏览器查看交易")
100| 14小时前**卖出****0.2049**30 0.00683 0xfc84...c8B6[](https://bscscan.com/tx/0x269b340510052b3e58f4cea85fc76e43c31266976da4869353cec268931cf689 "在区块浏览器查看交易")
```

## Proposed revision

Verdict: **still_accurate**

The excerpt is a fresh slice of the same live per-fill trade tape already described in the entry: each row shows buy/sell direction (买入/卖出), a BNB total, quantity, unit price, a counterparty wallet, and a BscScan transaction link, with timestamps spanning from minutes to 14 hours ago — consistent with 'running hours deep.' This is expected turnover of a live feed, not a structural change to the page. The mechanical checker's 'no match' flags are false negatives: it's doing literal string matching against a data table, not semantic support, so it can't recognize that rows encoding buy/sell, BNB amount, qty, price, wallet, and tx link collectively support the summary sentence. The other flagged sentences (positioning as a 'professional trading terminal,' the scope note about limited retrieval, and the usage guidance) aren't things this excerpt would show either way — it's just trade rows, no navigation or landing-page copy — so per the absence-is-not-evidence rule they're untouched. Nothing here contradicts or extends the current entry.

```json
{
  "verdict": "still_accurate",
  "summary_en": null,
  "summary_zh": null,
  "citations": []
}
```
