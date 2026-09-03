import { ECOSYSTEM_CATALOG_VERSION, ECOSYSTEM_REVIEWED_AT, CURATED_UPDATES, CURATED_TOOLS } from "./curated_ecosystem_seed.js";
import { LEARNING_CATALOG_VERSION, LEARNING_CATALOG_REVIEWED_AT, LEARNING_RESOURCES } from "./learning_resources_seed.js";

const API_RESPONSE_LOCALES = Object.freeze(["zh", "en", "ko", "ja", "es", "ar", "tr", "fr", "de", "ru", "pt"]);
export const API_LOCALE_METADATA = Object.freeze({
  default_locale: "en",
  supported_response_locales: API_RESPONSE_LOCALES,
  response_locale_parameter: "locale",
  source_language_parameter: "language",
  source_language_semantics: "Filters the external resource's original source language; it never controls the response language.",
  localized_endpoints: ["/api/v1/learn/resources", "/api/v1/updates", "/api/v1/tools"],
  invariant_fields: ["id", "tier", "stages", "language", "url", "title_zh", "title_en", "summary_zh", "summary_en", "addresses", "numeric metrics", "event evidence", "official asset holder aggregates", "cumulative minter source units", "public open-bid facts"],
  fallback: "Unsupported or unavailable response locales return English reviewed copy with locale_status=fallback; no values, protocol facts, URLs or source tiers are translated or inferred.",
  translation_scope: "localized is a TapeOut Intelligence reviewed card title/summary and governance explanation. It is not a translation claim about the third-party source page.",
  translation_method: "Canonical copy is written and reviewed in English and Chinese. Other locales are machine-translated from that copy as a build step, then checked by a second automated pass that every negation, exclusion and scope caveat survives with the same polarity; a translation that fails that check is not published. Each translation records a hash of the source text it was made from, and the site's self-audit reports any entry whose source has since changed."
});
const LEARNING_GOVERNANCE_COPY = Object.freeze({
  en: { official: "TapeOut website, official contract references, or attributable public project releases.", community: "Public community explanation; it is never labelled official and official sources prevail for mechanics.", reference: "Digital-logic or verification reference; explicitly not a TapeOut Protocol operating guide.", excluded: "No private-message solicitation, private-key/seed request, unverified contract, guaranteed-return or paid-signal material." },
  zh: { official: "TapeOut 官网、官方合约引用或可归属的公开项目发布。", community: "公开社区解释；绝不标注为官方，机制以官网为准。", reference: "数字逻辑或核验材料；明确不是 TapeOut Protocol 操作教程。", excluded: "不收录私信导流、私钥或助记词索取、未经核验合约、收益保证或付费喊单内容。" },
  ko: { official: "TapeOut 웹사이트, 공식 컨트랙트 참조 또는 출처를 확인할 수 있는 공개 프로젝트 발표입니다.", community: "공개 커뮤니티 설명이며 공식으로 표기하지 않습니다. 메커니즘은 공식 소스를 우선합니다.", reference: "디지털 논리 또는 검증 참고자료이며 TapeOut Protocol 사용 튜토리얼이 아닙니다.", excluded: "개인 메시지 유도, 개인 키/시드 문구 요구, 검증되지 않은 컨트랙트, 수익 보장 또는 유료 시그널 자료는 제외합니다." },
  ja: { official: "TapeOut の公式サイト、公式コントラクト参照、または出所を確認できる公開プロジェクト発表です。", community: "公開コミュニティによる説明であり、公式とは表示しません。仕組みは公式情報を優先します。", reference: "デジタル論理または検証の参考資料であり、TapeOut Protocol の操作チュートリアルではありません。", excluded: "DM 誘導、秘密鍵・シードフレーズの要求、未検証コントラクト、収益保証、または有料シグナル資料は除外します。" },
  es: { official: "Sitio web de TapeOut, referencias oficiales de contratos o publicaciones públicas atribuibles al proyecto.", community: "Explicación pública de la comunidad; nunca se etiqueta como oficial y las fuentes oficiales prevalecen para la mecánica.", reference: "Referencia de lógica digital o verificación; explícitamente no es un tutorial operativo de TapeOut Protocol.", excluded: "No se acepta captación por mensaje privado, solicitudes de clave privada o frase semilla, contratos no verificados, promesas de retorno ni material de señales pagadas." },
  ar: { official: "موقع TapeOut أو مراجع العقود الرسمية أو إصدارات عامة يمكن نسبتها بوضوح إلى المشروع.", community: "شرح مجتمعي علني؛ لا يُوسم أبداً بأنه رسمي، وتبقى المصادر الرسمية مرجع آليات البروتوكول.", reference: "مرجع للمنطق الرقمي أو للتحقق؛ وليس دليلاً تشغيلياً لـ TapeOut Protocol.", excluded: "لا تُقبل مواد توجّه إلى رسائل خاصة أو تطلب مفتاحاً خاصاً/عبارة استرداد أو تعرض عقداً غير متحقق منه أو تعد بعائد أو تبيع إشارات." }
});
export function requestedApiLocale(params) {
  const requested = String(params.get("locale") || "").trim().toLowerCase();
  if (!requested) return null;
  return API_RESPONSE_LOCALES.includes(requested) ? requested : "en";
}
export async function learningLocalization(request, env, locale, requestedLocale) {
  if (locale === "zh" || locale === "en") return { locale, requested_locale: requestedLocale, locale_status: "canonical", translations: {} };
  try {
    const assetUrl = new URL(`/i18n/learning/${locale}.json`, request.url);
    const response = await env.ASSETS.fetch(new Request(assetUrl.toString()));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json();
    if (!body?.translations || typeof body.translations !== "object") throw new Error("invalid localization asset");
    return { locale, requested_locale: requestedLocale, locale_status: "localized", translations: body.translations, source_catalog_version: body.source_catalog_version || null, reviewed_at: body.reviewed_at || null };
  } catch (error) {
    console.warn(`[learn-i18n] locale=${locale} fallback`, error?.message || String(error));
    return { locale: "en", requested_locale: requestedLocale, locale_status: "fallback", translations: {} };
  }
}
export function localizedLearningItem(item, localization) {
  const translation = localization.translations[item.id] || {};
  const canonical = localization.locale === "zh" ? { title: item.title_zh, summary: item.summary_zh } : { title: item.title_en, summary: item.summary_en };
  return { ...item, localized: { locale: localization.locale, requested_locale: localization.requested_locale, locale_status: localization.locale_status, title: translation.title || canonical.title, summary: translation.summary || canonical.summary, translation_scope: "TapeOut Intelligence reviewed card copy; external URL remains in its original source language.", source_languages: item.language } };
}
export async function learningResources(params, request, env) {
  const tier = params.get("tier") || "all";
  const stage = params.get("stage") || "all";
  const language = params.get("language") || "all";
  const requestedLocale = String(params.get("locale") || "").trim().toLowerCase() || null;
  const locale = requestedApiLocale(params);
  const localization = locale ? await learningLocalization(request, env, locale, requestedLocale) : null;
  if (localization && requestedLocale && !API_RESPONSE_LOCALES.includes(requestedLocale)) localization.locale_status = "fallback";
  const q = String(params.get("q") || "").trim().toLowerCase();
  const validTiers = new Set(["all", "official", "community", "reference"]);
  const validStages = new Set(["all", "basics", "canvas", "tapeout", "pod", "safety", "logic"]);
  // Original-source language of the resource itself, not the UI locale. Turkish
  // joined the set when a Turkish-language community explainer was reviewed.
  const validLanguages = new Set(["all", "zh", "en", "tr"]);
  // Reversed so the most recently added entry leads page 1 of any filtered
  // view — the seed file's append order is this catalog's only recency
  // signal (no per-item reviewed_at), and a newest-first default keeps a
  // freshly reviewed resource from being buried behind older pages.
  const filtered = [...LEARNING_RESOURCES].reverse().filter(item => {
    const localized = localization ? localizedLearningItem(item, localization).localized : null;
    return (validTiers.has(tier) ? tier === "all" || item.tier === tier : false) &&
      (validStages.has(stage) ? stage === "all" || item.stages.includes(stage) : false) &&
      (validLanguages.has(language) ? language === "all" || item.language.includes(language) : false) &&
      (!q || [item.title_zh, item.title_en, item.summary_zh, item.summary_en, localized?.title, localized?.summary].filter(Boolean).join(" ").toLowerCase().includes(q));
  });
  const pageSize = Math.min(Math.max(Number(params.get("page_size") || 6), 1), 12);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(Math.max(Number(params.get("page") || 1), 1), pageCount);
  const start = (page - 1) * pageSize;
  const baseItems = filtered.slice(start, start + pageSize);
  const governanceLocale = localization?.locale || "en";
  return {
    catalog_version: LEARNING_CATALOG_VERSION,
    reviewed_at: LEARNING_CATALOG_REVIEWED_AT,
    ...(localization ? { response_locale: localization.locale, requested_locale: requestedLocale, locale_status: localization.locale_status, localization: { ...API_LOCALE_METADATA, source_catalog_version: localization.source_catalog_version || null, reviewed_at: localization.reviewed_at || null, translation_scope: API_LOCALE_METADATA.translation_scope } } : {}),
    governance: LEARNING_GOVERNANCE_COPY[governanceLocale] || LEARNING_GOVERNANCE_COPY.en,
    filters: { tier, stage, language, locale: requestedLocale || null, q, page, page_size: pageSize },
    total: filtered.length,
    page_count: pageCount,
    items: localization ? baseItems.map(item => localizedLearningItem(item, localization)) : baseItems
  };
}

export async function ecosystemLocalization(request, env, locale, requestedLocale) {
  if (locale === "zh" || locale === "en") return { locale, requested_locale: requestedLocale, locale_status: "canonical", translations: { updates: {}, tools: {} } };
  try {
    const assetUrl = new URL(`/i18n/ecosystem/${locale}.json`, request.url);
    const response = await env.ASSETS.fetch(new Request(assetUrl.toString()));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json();
    if (!body?.translations?.updates || !body?.translations?.tools) throw new Error("invalid ecosystem localization asset");
    return { locale, requested_locale: requestedLocale, locale_status: "localized", translations: body.translations, source_catalog_version: body.source_catalog_version || null, reviewed_at: body.reviewed_at || null };
  } catch (error) {
    console.warn(`[ecosystem-i18n] locale=${locale} fallback`, error?.message || String(error));
    return { locale: "en", requested_locale: requestedLocale, locale_status: "fallback", translations: { updates: {}, tools: {} } };
  }
}
export function localizedEcosystemItem(item, localization, kind) {
  const translated = localization.translations?.[kind]?.[item.id] || {};
  const canonical = localization.locale === "zh" ? { title: item.title_zh, summary: item.summary_zh, boundary: kind === "updates" ? item.source_note_zh : item.safety_zh } : { title: item.title_en, summary: item.summary_en, boundary: kind === "updates" ? item.source_note_en : item.safety_en };
  return { ...item, localized: { locale: localization.locale, requested_locale: localization.requested_locale, locale_status: localization.locale_status, title: translated.title || canonical.title, summary: translated.summary || canonical.summary, [kind === "updates" ? "source_note" : "safety"]: translated[kind === "updates" ? "source_note" : "safety"] || canonical.boundary, translation_scope: "TapeOut Intelligence reviewed display copy only; source URL, author/operator, original language, tier and evidence fields remain canonical." } };
}
export async function curatedCollection(params, request, env, kind) {
  // Updates are appended to the seed in review order, so newest-last; the stream
  // should lead with what was reviewed most recently (learning resources already do).
  // Tools keep seed order — the client groups them by tier.
  const items = kind === "updates" ? [...CURATED_UPDATES].reverse() : CURATED_TOOLS;
  const tier = params.get("tier") || "all";
  const dimension = params.get(kind === "updates" ? "topic" : "category") || "all";
  const language = params.get("language") || "all";
  const requestedLocale = String(params.get("locale") || "").trim().toLowerCase() || null;
  const locale = requestedApiLocale(params);
  const localization = locale ? await ecosystemLocalization(request, env, locale, requestedLocale) : null;
  if (localization && requestedLocale && !API_RESPONSE_LOCALES.includes(requestedLocale)) localization.locale_status = "fallback";
  const q = String(params.get("q") || "").trim().toLowerCase();
  const validTiers = new Set(["all", "official", "community", "reference"]);
  const validLanguages = new Set(["all", "zh", "en"]);
  const filtered = items.filter(item => {
    const localized = localization ? localizedEcosystemItem(item, localization, kind).localized : null;
    const dimensions = kind === "updates" ? item.topics : [item.category, ...(item.use_cases || [])];
    const haystack = [item.title_zh, item.title_en, item.summary_zh, item.summary_en, item.author, item.operator, ...(dimensions || []), localized?.title, localized?.summary].filter(Boolean).join(" ").toLowerCase();
    return (validTiers.has(tier) ? tier === "all" || item.tier === tier : false) &&
      (dimension === "all" || dimensions.includes(dimension)) &&
      (validLanguages.has(language) ? language === "all" || item.original_language === language : false) &&
      (!q || haystack.includes(q));
  });
  const pageSize = Math.min(Math.max(Number(params.get("page_size") || 6), 1), 24);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(Math.max(Number(params.get("page") || 1), 1), pageCount);
  const start = (page - 1) * pageSize;
  const baseItems = filtered.slice(start, start + pageSize);
  return {
    catalog_version: ECOSYSTEM_CATALOG_VERSION,
    reviewed_at: ECOSYSTEM_REVIEWED_AT,
    review_mode: "editorially verified public-content flow; not real-time X ingestion",
    governance: { allowed: "Publicly reachable source URL, attributable author/operator or official site, evidence-based tier, stated practical use and risk boundary.", excluded: "Unverified contract addresses, private-message solicitation, private-key/seed requests, guaranteed-return claims, paid signals and content without verifiable provenance.", tier_boundary: "Community content never inherits official identity; translations describe this directory card only and do not claim that an external source has a translated original." },
    ...(localization ? { response_locale: localization.locale, requested_locale: requestedLocale, locale_status: localization.locale_status, localization: { ...API_LOCALE_METADATA, source_catalog_version: localization.source_catalog_version || null, reviewed_at: localization.reviewed_at || null } } : {}),
    filters: { tier, [kind === "updates" ? "topic" : "category"]: dimension, language, locale: requestedLocale || null, q, page, page_size: pageSize },
    total: filtered.length,
    page_count: pageCount,
    items: localization ? baseItems.map(item => localizedEcosystemItem(item, localization, kind)) : baseItems
  };
}
