# TapeOut Intelligence API 国际化

## 设计原则

API 国际化不是把链上事实、钱包地址、数值、事件或标签名称翻译成另一套数据。它只为经过 TapeOut Intelligence 审核的**教学目录、公开更新流与工具目录展示文案**提供多语言响应。Processor 地址、Creator 地址、合约地址、URL、作者/运营方、时间戳、数值、事件类型、来源层级和原始中英字段保持不变，以便 Agent、分析工具和已有消费者复核同一事实。

> `language` 与 `locale` 是不同概念。`language` 过滤外部资源本身的原始来源语言；`locale` 决定 API 返回的 TapeOut Intelligence 本地化标题、摘要和治理说明。两者可以同时使用，且不会互相覆盖。

## 接口

### `GET /api/v1/i18n`

返回 API 的响应语言契约、已支持语言、可本地化端点、不可变字段及回退规则。

### `GET /api/v1/updates`

人工审核的公开 TapeOut 更新流。它**不是实时 X 抓取**；每条记录均含原始 `url`、`author`、`source_type`、`tier`、`original_language`、`published_at` 或 `reviewed_at` 与 `risk_tags`。支持 `locale`、`tier`、`topic`、`language`、`q`、`page`、`page_size`。

```text
/api/v1/updates?locale=es&tier=official&page=1&page_size=12
/api/v1/updates?language=en&locale=ar&topic=canvas
```

本地化字段位于 `localized.title`、`localized.summary` 和 `localized.source_note`。即使显示语言为阿拉伯语或日语，原帖作者、原帖 URL、原始语言与 Official/Community/Reference 层级均保持原样。

### `GET /api/v1/tools`

人工审核的 TapeOut 工具与网站目录。每条记录均含 `operator`、`category`、`use_cases`、`url`、`tier`、`original_language`、`reviewed_at` 与明确的安全边界。支持 `locale`、`tier`、`category`、`language`、`q`、`page`、`page_size`。

```text
/api/v1/tools?locale=ko&category=verification
/api/v1/tools?locale=ja&tier=official&page_size=12
```

本地化字段位于 `localized.title`、`localized.summary` 和 `localized.safety`。工具目录不把区块浏览器视为审计结论，也不会因目录收录而暗示收益、背书或安全保证。

### `GET /api/v1/learn/resources`

保留所有现有参数，并新增可选 `locale`：`zh`、`en`、`ko`、`ja`、`es`、`ar`、`tr`、`fr`、`de`、`ru`、`pt`。

| 参数 | 含义 | 示例 |
|---|---|---|
| `locale` | 响应中已审计教学文案的语言 | `locale=ja` |
| `language` | 外部资源原始来源语言过滤，不是翻译语言 | `language=en` |
| `tier` | `official`、`community`、`reference` 或 `all` | `tier=official` |
| `stage` | 学习阶段过滤 | `stage=pod` |
| `q` | 以中英文原始文案及所选本地化卡片文案检索 | `q=Canvas` |

例如：

```text
/api/v1/learn/resources?locale=ko&page=1&page_size=6
/api/v1/learn/resources?language=en&locale=ar&tier=official
```

当传入 `locale` 时，每个资源仍保留 `title_zh`、`title_en`、`summary_zh`、`summary_en` 和原始 `url`，并新增：

```json
{
  "localized": {
    "locale": "ko",
    "requested_locale": "ko",
    "locale_status": "localized",
    "title": "검토된 한국어 제목",
    "summary": "검토된 한국어 요약",
    "translation_scope": "TapeOut Intelligence reviewed card copy; external URL remains in its original source language.",
    "source_languages": ["zh", "en"]
  }
}
```

## 回退与安全边界

未传 `locale` 时，响应保持旧版结构，不新增 `localized` 字段，避免破坏已有客户端。传入未支持语言（如 `locale=it`）时，API 返回英文审核文案，并明确 `response_locale: "en"` 与 `locale_status: "fallback"`；绝不返回伪造的零值、翻译后的链上事实或无法核验的外部内容。

`Official`、`Community` 和 `Reference` 的分层保持原样。社区内容不会因被本地化而继承官方身份；本地化摘要不表示第三方网页存在相同语言的原文；收益承诺、私钥/助记词请求、未核验合约和付费喊单材料继续被排除。审核更新流在来源暂不可访问时保留最后一次已审核条目与审核时间，但不伪造实时性、零值或新的未经证实内容。


## 官方三项目地址观察

`/api/v1/official-assets/overview`、`/api/v1/official-assets/addresses` 与 `/api/v1/official-assets/health` 也会出现在 API 目录中，但**不是**响应文本本地化端点。它们返回可机器复核、语言无关的事实字段：TapeOut、Behemoth、Genesis CPU 的官方合约范围、holder 聚合数、累计铸造来源单位、公开买单、地址、时间与健康状态。调用 `locale` 不会改写这些字段。

页面可以以十一种语言解释字段，但 API 始终保持下列边界：累计铸造地址不是当前余额地址；公开买单地址不是成交、持仓或身份归因；项目级 holder 总数不是完整按地址余额清单。详见 [`OFFICIAL_THREE_ASSET_OBSERVATION_API.md`](./OFFICIAL_THREE_ASSET_OBSERVATION_API.md)。
