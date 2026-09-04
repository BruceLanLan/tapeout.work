---
id: tool-tapeout-firsto
kind: tool
url: https://tapeout.firsto.ai/
status: revouch
generated_at: 2026-09-04T01:00:08.178Z
reviewed_at: 2026-09-03T05:47:54Z
changed_at: 2026-09-04T00:15:30.364Z
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

Page changed 2026-09-04T00:15:30.364Z; entry reviewed 2026-09-03T05:47:54Z.

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
| 6 zh | 落地页之后确实提供一条实时逐笔成交流水：每一笔都给出买入/卖出方向、总 BNB、数量、单价、对手方钱包，以及一个 BscScan 交易链接，可回溯数小时。 | 6 | 买入, 交易, 小时 | supported |
| 7 zh | 范围说明：本次审核只取回了这一个界面，导航和其他板块都没有取回，所以以上写的是内部展示了什么，不代表该站提供的全部内容。 | — |  | no match |
| 8 zh | 可用于发现和阅读市场信息，但应与官方协议和持仓数据分开看待。 | — |  | no match |

## Excerpt (as served, numbered)

```text
  1| 6分钟前**卖出****1.0227**128 0.00799 0x48a4...912d[](https://bscscan.com/tx/0xa1d2f9866b5ae7184ed5dc09ca2ebd38ac47da9a3e985661994429a67e3d22a3 "在区块浏览器查看交易")
  2| 21分钟前**卖出****0.00714**1 0.00714 0x1c45...253c[](https://bscscan.com/tx/0xb5ac04ca01774c0a7c0e7059fd79d42c1da21b33c3e35f8f9cd16171c8baa1b9 "在区块浏览器查看交易")
  3| 21分钟前**卖出****0.1650**22 0.0075 0x1c45...253c[](https://bscscan.com/tx/0x63ff38bc2807dc6ff08167acec4d45a8330cfca8abacfdd1b4f48b7e7f4f96f6 "在区块浏览器查看交易")
  4| 21分钟前**卖出****0.7200**100 0.0072 0x39Dc...75A3[](https://bscscan.com/tx/0x1eee58c35b653d6dee224d715a01008590bf60a4a8a9eeccb40d3e7e8f137b69 "在区块浏览器查看交易")
  5| 21分钟前**卖出****0.0525**7 0.0075 0x1c45...253c[](https://bscscan.com/tx/0x2cff09683bf981f7de01f8b7d814136f104ca1fa35ed69821017e80b8c37662a "在区块浏览器查看交易")
  6| 1小时前**买入****0.0560**7 0.0080 0x4759...A4b4[](https://bscscan.com/tx/0x602ddc75bf0a596d75c2ec55f7808a4de96a24dbf0299edf2bb5426e022f68ce "在区块浏览器查看交易")
  7| 2小时前**买入****0.0320**4 0.0080 0x4759...A4b4[](https://bscscan.com/tx/0x264a6d52eb0c5c1dcb63bad43f5549161613bb72a49b1e251193613f3a0947b0 "在区块浏览器查看交易")
  8| 2小时前**买入****0.0240**3 0.0080 0x4759...A4b4[](https://bscscan.com/tx/0x1bacfd43400d931e9617a57a6d47715a317f5ae9e8e65d61ec947a5ece5ffcaa "在区块浏览器查看交易")
  9| 2小时前**买入****0.1598**20 0.00799 0x4759...A4b4[](https://bscscan.com/tx/0xf75453c3f4ea1d5fd020c7053ebb9b280f5b5c961f7b10cb857a6e37f1f29b13 "在区块浏览器查看交易")
 10| 2小时前**买入****0.1436**18 0.00798 0x4759...A4b4[](https://bscscan.com/tx/0x495d5f5438b2cfe770369a57354d7a5bb9356abe9f583b4f6609ea6fd46b188e "在区块浏览器查看交易")
 11| 3小时前**卖出****0.0152**2 0.00762 0x3B49...9Ca4[](https://bscscan.com/tx/0x01fcf5b56be4a2123512e074ea46c5c32b63726dbc4f779a831b555057b8c84b "在区块浏览器查看交易")
 12| 3小时前**卖出****0.6199**78 0.00794 0x0c16...3fD6[](https://bscscan.com/tx/0x20ac99e04fa9a296c3cb388e5bad3180d55c30caf24cea5bdfe10e8f16c15254 "在区块浏览器查看交易")
 13| 3小时前**卖出****0.1646**20 0.00823 0x0c16...3fD6[](https://bscscan.com/tx/0xaedc1cb27a87f870c3a570de179ca637a6793d89342223bf08f7ba32db46da09 "在区块浏览器查看交易")
 14| 3小时前**卖出****0.8560**107 0.0080 0x0c16...3fD6[](https://bscscan.com/tx/0x030c386ccc7961e57e7f6d75339044b110e7d767a355a48fd9a1b579fcf78a42 "在区块浏览器查看交易")
 15| 3小时前**卖出****1.4400**180 0.0080 0x0c16...3fD6[](https://bscscan.com/tx/0xbe624268aa65715c9910941fa0f5ac986985ec737a7829c2d83c25be8d9bf21b "在区块浏览器查看交易")
 16| 3小时前**卖出****0.4070**50 0.00814 0x0c16...3fD6[](https://bscscan.com/tx/0xcf4d3a2910b6e7746a40c487768d6aa95fd856f698812d95e9a65dc5e65b2f0f "在区块浏览器查看交易")
 17| 3小时前**卖出****0.1162**14 0.0083 0x0c16...3fD6[](https://bscscan.com/tx/0xf142050dc19db54736df60a3eec25958cc8450c15802062756daa6975524c97e "在区块浏览器查看交易")
 18| 4小时前**卖出****1.8490**228 0.00811 0x5388...9999[](https://bscscan.com/tx/0xc1f4acb72fded67f35384dfdfe86186e1baa67788fdf2d36f98828a5f1350ad6 "在区块浏览器查看交易")
 19| 4小时前**卖出****0.0407**5 0.00815 0x5388...9999[](https://bscscan.com/tx/0x05c5a33cd373ccbdbc22a9c33def5d9a2cef7b0c72db1a1cad532c6b307e1711 "在区块浏览器查看交易")
 20| 4小时前**卖出****0.0570**7 0.00815 0x5388...9999[](https://bscscan.com/tx/0xb7c53b35051c9eb055063ff7ba0eca7116d0c7f4e5f4a53a7a7112254ef63d09 "在区块浏览器查看交易")
 21| 4小时前**卖出****0.0408**5 0.00816 0x5388...9999[](https://bscscan.com/tx/0x51042f80c741eedea44c69011569731d845c989b2148ff053be25e7b6c79e54f "在区块浏览器查看交易")
 22| 6小时前**买入****0.0175**2 0.00878 0x639F...dbCb[](https://bscscan.com/tx/0xeac53232ff4c2255b3f2f8acd200440103ec0ddadf0d82f42b81481a98e37392 "在区块浏览器查看交易")
 23| 6小时前**买入****0.00878**1 0.00878 0x4FaC...Fb28[](https://bscscan.com/tx/0xbb7e8329b64d70fd095cf5e94ff1d993bf89b1caf1ec652243c2857fcc6ea683 "在区块浏览器查看交易")
 24| 7小时前**买入****0.0175**2 0.00879 0x639F...dbCb[](https://bscscan.com/tx/0x98d3fd6f4198cef95da111f59f47582292a4c30b351702384ec847ccd0aac275 "在区块浏览器查看交易")
 25| 7小时前**卖出****0.0407**5 0.00815 0xe8e3...0555[](https://bscscan.com/tx/0x053c5d8969f2c5d794d4f1381a32ef79caa1a8451a18d8abd3ecf8719e05a9ee "在区块浏览器查看交易")
 26| 7小时前**卖出****0.1632**20 0.00816 0xe8e3...0555[](https://bscscan.com/tx/0x9cf8298550954b54e223e08d0e52a85732dfe1b792423c8b65800a2c97c5eb1e "在区块浏览器查看交易")
 27| 7小时前**卖出****0.4166**51 0.00817 0xe8e3...0555[](https://bscscan.com/tx/0xfc4f56060a9ee9431f3e253eb74e814b754e3c843e0ee1ee4514095839e4f8fa "在区块浏览器查看交易")
 28| 8小时前**卖出****0.1662**20 0.00831 0x92c5...9bb0[](https://bscscan.com/tx/0xd7a114ff3a785ae7cabac3b66b02b7f3446e679f95914a661f828003fe2d7d9e "在区块浏览器查看交易")
 29| 8小时前**卖出****0.00832**1 0.00832 0x48a4...912d[](https://bscscan.com/tx/0x47e0629e0af4d3e5d494f038b9609c0b4da471b144e629404302be469eed326c "在区块浏览器查看交易")
 30| 8小时前**卖出****0.0832**10 0.00832 0x78DB...aFBe[](https://bscscan.com/tx/0xc25d162ee241420c46aa70921110d39802e6abc57320ff7fe349916df1c566bb "在区块浏览器查看交易")
 31| 8小时前**买入****0.1800**20 0.0090 0xA06D...C775[](https://bscscan.com/tx/0xe14527c56cac07514a72d31fa6109ac597b44d4177324a47d7d8d70d1566c32b "在区块浏览器查看交易")
 32| 8小时前**买入****0.5364**60 0.00894 0xA06D...C775[](https://bscscan.com/tx/0x4f0dea8bbcb516e82e1f3b7dc5a96f246224104ccd44b0426b97007758d50182 "在区块浏览器查看交易")
 33| 8小时前**买入****0.0720**8 0.0090 0x8eF0...09d1[](https://bscscan.com/tx/0x7615882e088b1489cee7c01e7cd61d0779210ce604860baeb0c1b5fd26a96b2e "在区块浏览器查看交易")
 34| 8小时前**买入****0.1708**19 0.00899 0x8eF0...09d1[](https://bscscan.com/tx/0xf15bcac8c1c75f630a28b92ce8dd7ea1423d6cc845e7c7b6a58a00b81fb5c506 "在区块浏览器查看交易")
 35| 8小时前**买入****0.0898**10 0.00898 0x8eF0...09d1[](https://bscscan.com/tx/0xa74ec2deda07550ad00adcc5d1642270fd89adaf0676e40a47d41b8eda9b15f4 "在区块浏览器查看交易")
 36| 9小时前**买入****0.0179**2 0.00898 0x639F...dbCb[](https://bscscan.com/tx/0x12e71be29150f6418ecfd96e25c5c88dcf0288205634aef12d44ef941ba68568 "在区块浏览器查看交易")
 37| 9小时前**卖出****0.0083**1 0.0083 0x78DB...aFBe[](https://bscscan.com/tx/0x7afbb22f76704021c4588f3e1e01b43adbe44a2ab7f89c9122c17271540a3b0f "在区块浏览器查看交易")
 38| 9小时前**卖出****0.1577**19 0.0083 0x78DB...aFBe[](https://bscscan.com/tx/0x7afbb22f76704021c4588f3e1e01b43adbe44a2ab7f89c9122c17271540a3b0f "在区块浏览器查看交易")
 39| 9小时前**买入****0.00912**1 0.00912 0x639F...dbCb[](https://bscscan.com/tx/0x337e21158f6c79b7683b565408cd7c70c19203bdf03cc372b01d916968caa3e5 "在区块浏览器查看交易")
 40| 9小时前**买入****0.00885**1 0.00885 0x639F...dbCb[](https://bscscan.com/tx/0x8c6fe0c595cd97be88374fc0d15f6917be61019a21f413b10f58ae8b78f0c50f "在区块浏览器查看交易")
 41| 9小时前**卖出****0.1139**14 0.00814 0x6447...b1AB[](https://bscscan.com/tx/0xaad4e403b62b6b446e5338a7ba25c75af6642592aa8d58bfb5b9d161c1af3890 "在区块浏览器查看交易")
 42| 9小时前**买入****0.00886**1 0.00886 0xdbCF...adE7[](https://bscscan.com/tx/0x2e0ec21fd30aa3bd50f3ba147276f855c51447c101b6af4d32131ee7191e06ce "在区块浏览器查看交易")
 43| 9小时前**买入****0.0177**2 0.00885 0xdbCF...adE7[](https://bscscan.com/tx/0xd6098806678d94f0a2423f099b694cfdf02aab4cf8983f7cbb1df243580ae8a8 "在区块浏览器查看交易")
 44| 10小时前**买入****0.1598**18 0.00888 0x697E...8EC8[](https://bscscan.com/tx/0x83beac2c24853771e8a1412acb78f9927fb53fb699c007ef49dd639aea1e1838 "在区块浏览器查看交易")
 45| 10小时前**买入****0.2322**27 0.0086 0x697E...8EC8[](https://bscscan.com/tx/0x77f77cb21175987b671c23faad75920c8c375dc8d39173793f384223222649f8 "在区块浏览器查看交易")
 46| 10小时前**卖出****0.1660**20 0.0083 0x78DB...aFBe[](https://bscscan.com/tx/0x36b5421f12995a522682f4ffcb702be5926a57d1e4c9c57da5643cf0a6589968 "在区块浏览器查看交易")
 47| 10小时前**卖出****0.8131**100 0.00813 0xa1bA...Cc37[](https://bscscan.com/tx/0x8586eb1d7516086dc411f424dc52a19c3fd78290b2d4a70d887a43e21a054a2c "在区块浏览器查看交易")
 48| 10小时前**卖出****0.2200**27 0.00815 0xa1bA...Cc37[](https://bscscan.com/tx/0x950d74d9c85bfa7a1a346ccf0fe06d0460d38daa56dd66ffeed5ab2140b452f0 "在区块浏览器查看交易")
 49| 10小时前**卖出****0.4738**58 0.00817 0xa1bA...Cc37[](https://bscscan.com/tx/0xcba7eeb4c70baafd2bdb51edbfdf05072590f64eee295201e6e50bb27890e0de "在区块浏览器查看交易")
 50| 11小时前**卖出****0.1554**19 0.00818 0xa1bA...Cc37[](https://bscscan.com/tx/0x18968b296e616415c35fe9df73a99aa07ca79d9113b5307b26823ea83fb6847a "在区块浏览器查看交易")
 51| 11小时前**卖出****0.00818**1 0.00818 0x27BA...1710[](https://bscscan.com/tx/0x4f78ad2e6feabba4876649eccaeb76fcab9b33ef121da96677e62719be86f368 "在区块浏览器查看交易")
 52| 12小时前**卖出****0.6290**74 0.0085 0x48a4...912d[](https://bscscan.com/tx/0xac11355dbbfa36a7ca1181886f49d55e6cc8fab2bfb540f10cc880857ce06064 "在区块浏览器查看交易")
 53| 12小时前**买入****0.00899**1 0.00899 0xd48a...3744[](https://bscscan.com/tx/0xff802f023648930f8d2c8e4d5912b6886b7595c962d34b15f6f4c92304d0b405 "在区块浏览器查看交易")
 54| 12小时前**卖出****0.00898**1 0.00898 0x48a4...912d[](https://bscscan.com/tx/0xd2b876a38c6f0b0253196598b2f140b2ac3fd54a0fbe9023ece95a78db7ea54e "在区块浏览器查看交易")
 55| 13小时前**卖出****0.00797**1 0.00797 0x27BA...1710[](https://bscscan.com/tx/0xe841be469ffda34437b75730633855cd89445f3bd1501dd3f5f526cf5379a9cf "在区块浏览器查看交易")
 56| 14小时前**卖出****0.0774**9 0.0086 0x48a4...912d[](https://bscscan.com/tx/0xa5325e1054f2da7433d68f04ea49e7c7c250212b0e8a2f42136fd603288473c0 "在区块浏览器查看交易")
 57| 14小时前**买入****0.4950**55 0.0090 0xB049...D76D[](https://bscscan.com/tx/0x2f0b50fc260e0f44a3996d8f1028e28f17fe1e77220a9584ce91d26530525d20 "在区块浏览器查看交易")
 58| 14小时前**买入****0.1118**13 0.0086 0xB049...D76D[](https://bscscan.com/tx/0xdf25f892a0c8ed2bc73bf7984a522bc126af30acba166cbb1f29fcf72e591001 "在区块浏览器查看交易")
 59| 14小时前**买入****0.1376**16 0.0086 0xAe54...E4cc[](https://bscscan.com/tx/0x504a6e8d445a2840f12699f644a5fad0c48081c2929ff7d7eea149593f798d0d "在区块浏览器查看交易")
 60| 14小时前**买入****0.0860**10 0.0086 0xB049...D76D[](https://bscscan.com/tx/0xcd48a895d794643f0b5e2cf8e08ff4faf07b0a0c2ed9c78a12767c8380e88a85 "在区块浏览器查看交易")
 61| 14小时前**买入****0.5246**61 0.0086 0xB928...0Ab5[](https://bscscan.com/tx/0x44952add686971cbf9709f6fb9e52b633a71c556a3854425aea7a7ce928968a4 "在区块浏览器查看交易")
 62| 14小时前**买入****0.1462**17 0.0086 0x2ade...FAef[](https://bscscan.com/tx/0x04f836bfabd713d98afadb472c271307c62260ca064e8a2aeab2fd947b0185f0 "在区块浏览器查看交易")
 63| 14小时前**卖出****0.3061**39 0.00785 0x7180...DFE6[](https://bscscan.com/tx/0x6280088c59a645beec9f9eac8cd634246c8091a2943d44a6a29d7a165304efd2 "在区块浏览器查看交易")
 64| 15小时前**买入****0.1718**20 0.00859 0xB928...0Ab5[](https://bscscan.com/tx/0x4ca33adcd2665f2cf951d129ce100fea52c66c7f36ad3e771dfee585720b38da "在区块浏览器查看交易")
 65| 15小时前**卖出****0.3915**50 0.00783 0x6047...e997[](https://bscscan.com/tx/0xf3bc90d2af26d9ca0f0d36baa57c42f496a76a1c450c5793ce3da7433f11b395 "在区块浏览器查看交易")
 66| 15小时前**卖出****0.00782**1 0.00782 0xfe63...87B9[](https://bscscan.com/tx/0xf1e559d6b54e5abe8355c2195d00ee722a3f3b271d327370d85e0ca8a0d17752 "在区块浏览器查看交易")
 67| 15小时前**卖出****0.7176**92 0.0078 0xfe63...87B9[](https://bscscan.com/tx/0xd178c2649fedc98f7da5c4a86c6648b6ced0bab6f9a1a7311ea05c2e6e205f0a "在区块浏览器查看交易")
 68| 16小时前**卖出****0.3900**50 0.0078 0x2D89...f718[](https://bscscan.com/tx/0x87e6b7d422bea4b3d5d1e15ec54c02df985b390809af9eeca1f7cbcfa2c4bb2b "在区块浏览器查看交易")
 69| 16小时前**卖出****0.3900**50 0.0078 0x2D89...f718[](https://bscscan.com/tx/0x9b41ff9cacde9d3f112f65a427720ee60198d95e139827d51020165018aa7b68 "在区块浏览器查看交易")
 70| 16小时前**卖出****0.00766**1 0.00766 0x8b43...11EB[](https://bscscan.com/tx/0x5fa314e9a1860b63c93032cbe56d68a4e9f185f409363d4f002a3774a174fa1c "在区块浏览器查看交易")
 71| 16小时前**卖出****1.1934**153 0.0078 0xfBEc...98a4[](https://bscscan.com/tx/0x7e774500861bfe189d2d2ee6af5e7700e2477b2f497b190f8dfd63777592fa2e "在区块浏览器查看交易")
 72| 16小时前**卖出****0.3666**47 0.0078 0x44Ca...9b28[](https://bscscan.com/tx/0xbb065a8a4e236371c5fb17a91e29736101e4d2e018802273019bd524262f03cb "在区块浏览器查看交易")
 73| 16小时前**卖出****0.7800**100 0.0078 0xfBEc...98a4[](https://bscscan.com/tx/0x5c42864c8a04e557ebd2535d9d71128aeebad01ba895a5e07b9a3497bae10818 "在区块浏览器查看交易")
 74| 17小时前**卖出****0.1562**20 0.00781 0xfBEc...98a4[](https://bscscan.com/tx/0x5102ff9a09021fd24d791f0b2fe1586b9eec39ed244995a03a7d36b7d1bfb49e "在区块浏览器查看交易")
 75| 17小时前**买入****0.1290**15 0.0086 0xB049...D76D[](https://bscscan.com/tx/0x0dddb2a1e4222e2fbea7e425cb6ed52efc63b0770dee8686fd2927993d7951f7 "在区块浏览器查看交易")
 76| 17小时前**买入****0.2838**33 0.0086 0x70ce...6F2D[](https://bscscan.com/tx/0x8b6ceb30855b85f27d8a321d395570ec1e839a50e74d05a6798b4c3766027390 "在区块浏览器查看交易")
 77| 17小时前**买入****0.0687**8 0.00859 0x70ce...6F2D[](https://bscscan.com/tx/0xa74ca5faab43f4cfe0714e488a0fbe4dcb57450cd21c5c63bc068640d0ca3359 "在区块浏览器查看交易")
 78| 17小时前**买入****0.0859**10 0.00859 0xF714...EAfC[](https://bscscan.com/tx/0xd52439e6e1e5880c60764fa98da3f6167840115ddc451984244f4bd8cd9efc4b "在区块浏览器查看交易")
 79| 17小时前**买入****0.1372**16 0.00858 0xF714...EAfC[](https://bscscan.com/tx/0x3e2675dedfd3957d2f2f2249c56e09540e4343d63b23c363ac7446197d1e9ef7 "在区块浏览器查看交易")
 80| 18小时前**买入****0.0179**2 0.00899 0xd90f...c1Ff[](https://bscscan.com/tx/0xd54b5b206e1a6e1d9b3843eab4e52e6843dd0592e7083ff2ffd1a45171e41c81 "在区块浏览器查看交易")
 81| 18小时前**卖出****0.0680**8 0.0085 0x48a4...912d[](https://bscscan.com/tx/0x15619578dbbffa4368383b38065e8e42dce9483ac1e6e6fcce4c7b729ebdebfe "在区块浏览器查看交易")
 82| 19小时前**卖出****0.0082**1 0.0082 0x3B49...9Ca4[](https://bscscan.com/tx/0xf2086db3e8a4cca43b68f48827e10bdda30d3efd90e1ca1e9ae6f2ecc57d2822 "在区块浏览器查看交易")
 83| 19小时前**卖出****0.0082**1 0.0082 0x3B49...9Ca4[](https://bscscan.com/tx/0xd8e61c4937929fc19e4279e5ecf746e1f119d8b390ccc6f45561198950a86c5b "在区块浏览器查看交易")
 84| 19小时前**卖出****0.0150**2 0.00753 0xD1fC...0B25[](https://bscscan.com/tx/0x5c2fe0d5f43301c00eee87d4577fd7003015124016153951ade2232d67b4553f "在区块浏览器查看交易")
 85| 19小时前**买入****0.00915**1 0.00915 0x8980...82c6[](https://bscscan.com/tx/0x7f1c1e945ccbebb209a40bc638b1648d9502519787fdba1e6a06c60649c2272b "在区块浏览器查看交易")
 86| 19小时前**买入****0.00915**1 0.00915 0x8980...82c6[](https://bscscan.com/tx/0x792796fdc273791488ac569ea6c81f2b639f717f487b2b988c1dfd3fc49519fa "在区块浏览器查看交易")
 87| 19小时前**卖出****0.1540**20 0.0077 0xbd6B...b385[](https://bscscan.com/tx/0x1d6d06616f96f094b478118012512e46ce09e4329a75e46b85a36fc099a9fb51 "在区块浏览器查看交易")
 88| 19小时前**卖出****0.1328**16 0.0083 0x48a4...912d[](https://bscscan.com/tx/0x9854ef45e21e046a9fb437bc383de30c0fcdb5cfdea38777c9880fa7e9acbd33 "在区块浏览器查看交易")
 89| 19小时前**卖出****0.2253**30 0.00751 0x6911...7941[](https://bscscan.com/tx/0x3d80a76d021dccbcf6e596102fd6ec9a031aee333c5108f42d3a7335885a60cc "在区块浏览器查看交易")
 90| 20小时前**卖出****0.2273**28 0.00812 0xbd6B...b385[](https://bscscan.com/tx/0x36a5ff6a8e7b2481209bfbc7fb3525c71c37be1abda2fb709c91b167afd0d6df "在区块浏览器查看交易")
 91| 20小时前**卖出****0.1161**14 0.00829 0x9359...8888[](https://bscscan.com/tx/0xba1fb556a50edf67d6473eb3bcd3d3d609422b9126a038bd5b2d0ac482277a97 "在区块浏览器查看交易")
 92| 20小时前**卖出****0.1660**20 0.0083 0x9359...8888[](https://bscscan.com/tx/0xb357af1c0270e0599c3675ec1b790187e50f0bf6b3a5ca94e6e1b232f3424236 "在区块浏览器查看交易")
 93| 20小时前**卖出****0.1562**17 0.00919 0x7c9F...9c74[](https://bscscan.com/tx/0xc73a3a244344b199764b538f5c88d6344c37476dbeb676e01fc446781026b399 "在区块浏览器查看交易")
 94| 20小时前**买入****0.1379**15 0.00919 0xAe54...E4cc[](https://bscscan.com/tx/0x224f6cba0a3ccb463776032c3a522176ecc3f2ce6bb52ed0d9d8efe7271a3c99 "在区块浏览器查看交易")
 95| 20小时前**卖出****0.0172**2 0.0086 0x48a4...912d[](https://bscscan.com/tx/0xcdcdf995fdd444b4acc886f05a9c2b35d447c8aecfbfacfb9d6d0cd50a69809c "在区块浏览器查看交易")
 96| 20小时前**卖出****0.1445**17 0.0085 0x48a4...912d[](https://bscscan.com/tx/0x8db6c4070d865c30516cb8c5f3d96e47a2c028625e8d8303dcc99c8bb3e6bc5d "在区块浏览器查看交易")
 97| 20小时前**卖出****0.0935**11 0.0085 0x48a4...912d[](https://bscscan.com/tx/0x41b6747996525a885f256de926ee4ac37da617d640ee6216acdc37eadbce6e9b "在区块浏览器查看交易")
 98| 21小时前**买入****0.0269**3 0.00898 0x7c9F...9c74[](https://bscscan.com/tx/0xcce177edafca58fcdc72e11c61467c7f4b89428e361326380e882b4b29915149 "在区块浏览器查看交易")
 99| 21小时前**买入****0.1794**20 0.00897 0x7c9F...9c74[](https://bscscan.com/tx/0x8bea7d78f79d491a779aa36ea3d4ed01c9f2e963465e8785b9ea546ab286596a "在区块浏览器查看交易")
100| 21小时前**买入****1.6213**183 0.00886 0x7c9F...9c74[](https://bscscan.com/tx/0xd2b758f6228b0e4afaed4225b0c14635df6c804f35c49fa7feca92fe3b93f1c2 "在区块浏览器查看交易")
```

## Proposed revision

Verdict: **still_accurate**

The new excerpt is again just the per-fill trade tape, structurally identical to what the entry already describes: each row (lines 1-100) shows a timestamp, buy/sell direction (买入/卖出), total BNB, quantity, unit price, a truncated counterparty wallet, and a BscScan transaction link. The oldest row is 21小时前 (line 100), so the tape still runs many hours deep, consistent with 'running hours deep.' No listings, landing-page framing, navigation, or other sections appear in this excerpt either — but per the absence-is-not-evidence rule, that doesn't justify weakening the entry's claims about the landing page or the scope note about limited retrieval, since this is again a single-surface excerpt of a client-rendered page. Nothing in the excerpt contradicts or extends the current summary, so no revision is warranted.

```json
{
  "verdict": "still_accurate",
  "summary_en": null,
  "summary_zh": null,
  "citations": [
    1,
    6,
    100
  ]
}
```
