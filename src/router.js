import {
  RELEASE, PROTOCOL_TIME_BASIS, HOME_URL, PROCESSORS_URL, OFFICIAL_SITE_URL, BSC_CHAIN_ID, AIRDROP_ADDRESS,
  CIRCUIT_MARKET_ADDRESS, BEM_MINING_ADDRESS, BEM_TOKEN_ADDRESS, BEM_TASKBANK_URL, BEM_MINERS_URL, BEM_PRICE_URL, BEM_PRICE_PAIR_URL, BEM_PRICE_PROVIDER, BEM_CHAIN_ID,
} from "./constants.js";
import { json, csvEscape, websiteLabel, toBigInt } from "./util.js";
import { ensureEventSchema } from "./events.js";
import { currentRows, applyProcessorFilters, sortProcessors, toPublicProcessor, ensureRegistryFresh, refresh } from "./registry.js";
import { airdropOverview } from "./airdrop.js";
import { marketOverview, marketRpcUrl } from "./market.js";
import { bemMiningOverview, bemPriceOverview, bemTasks, bemAlgorithm, bemLeaderboardOverview, bemTrendingOverview, BEM_RPC_METRICS } from "./bem.js";
import { dataHealth, analytics, dailyActivity } from "./analytics.js";
import { officialAssetOverview, officialAssetAddresses, officialAssetsHealth, officialTransistorCandles } from "./official_assets.js";
import { communityProcessorLeaderboard, communityProcessorBoardHealth } from "./community.js";
import { ecosystemToolHealthOverview } from "./ecosystem_health.js";
import { selfAuditOverview } from "./self_audit.js";
import { bemTradesOverview } from "./bem_trades.js";
import { API_LOCALE_METADATA, learningResources, curatedCollection } from "./api_i18n.js";
import { GLOSSARY, GLOSSARY_VERSION, GLOSSARY_REVIEWED_AT } from "./glossary_seed.js";
import { bemBudgetQuote } from "./budget_quote.js";
import { bemHoldersOverview } from "./bem_holders.js";

export async function v1(request, env) {
  const url = new URL(request.url);
  if (url.pathname === "/api/v1/catalog") return json({
    version: "2026-08-25", release: RELEASE, name: "Tapeout Public Research API", source: PROCESSORS_URL, cadence: "every 5 minutes", protocol_time_basis: PROTOCOL_TIME_BASIS, privacy: "Server-side filtered public registry; no protected records are returned.", api_i18n: API_LOCALE_METADATA,
    endpoints: ["/api/v1/catalog", "/api/v1/openapi.json", "/api/v1/i18n", "/api/v1/updates", "/api/v1/tools", "/api/v1/learn/resources", "/api/v1/glossary", "/api/v1/bem/budget-quote", "/api/v1/official-assets/overview", "/api/v1/official-assets/addresses", "/api/v1/official-assets/health", "/api/v1/official-assets/candles", "/api/v1/community/processor-leaderboard", "/api/v1/community/processor-health", "/api/v1/ecosystem/health", "/api/v1/self-audit", "/api/v1/summary", "/api/v1/analytics", "/api/v1/daily-activity", "/api/v1/protocol-pulse", "/api/v1/airdrop-overview", "/api/v1/market-overview", "/api/v1/bem/overview", "/api/v1/bem/price", "/api/v1/bem/tasks", "/api/v1/bem/algorithm", "/api/v1/bem/leaderboard", "/api/v1/bem/trending", "/api/v1/bem/trades", "/api/v1/bem/holders", "/api/v1/data-health", "/api/v1/events", "/api/v1/processors", "/api/v1/creators", "/api/v1/attestations", "/api/v1/changes", "/api/v1/export.csv", "/api/v1/source-status", "/api/v1/strategies/schema"]
  });
  if (url.pathname === "/api/v1/openapi.json") return json({
    openapi: "3.1.0", info: { title: "Tapeout Public Research API", version: "2026-08-25", description: "Public-source, evidence-backed Tapeout research data. Protocol metrics use the TapeOut Day 1 zero baseline; D1 snapshot history begins later and is disclosed as a monitor boundary. No protected records are returned." },
    paths: {
      "/api/v1/catalog": { get: { summary: "API catalog" } }, "/api/v1/i18n": { get: { summary: "API response-locale contract, localized endpoints and invariant evidence fields" } }, "/api/v1/updates": { get: { summary: "Editorially reviewed public TapeOut update flow; source URL, tier, author and risk boundary are explicit", parameters: [{ name: "tier", in: "query" }, { name: "topic", in: "query" }, { name: "language", in: "query", description: "Original source language only" }, { name: "locale", in: "query", description: "Optional response locale: zh, en, ko, ja, es, ar, tr, fr, de, ru or pt" }, { name: "q", in: "query" }, { name: "page", in: "query" }, { name: "page_size", in: "query" }] } }, "/api/v1/tools": { get: { summary: "Reviewed TapeOut tool directory with practical-use and safety boundaries", parameters: [{ name: "tier", in: "query" }, { name: "category", in: "query" }, { name: "language", in: "query", description: "Original source language only" }, { name: "locale", in: "query", description: "Optional response locale: zh, en, ko, ja, es, ar, tr, fr, de, ru or pt" }, { name: "q", in: "query" }, { name: "page", in: "query" }, { name: "page_size", in: "query" }] } }, "/api/v1/learn/resources": { get: { summary: "Curated TapeOut learning resources with source tier, stage, original-source language filters and optional localized response copy; no return-promising material", parameters: [{ name: "tier", in: "query" }, { name: "stage", in: "query" }, { name: "language", in: "query", description: "Original external source language only" }, { name: "locale", in: "query", description: "Optional response locale: zh, en, ko, ja, es, ar, tr, fr, de, ru or pt" }, { name: "q", in: "query" }, { name: "page", in: "query" }, { name: "page_size", in: "query" }] } }, "/api/v1/glossary": { get: { summary: "Bilingual TapeOut term glossary summarizing publicly displayed official material, with per-term official evidence links", parameters: [{ name: "q", in: "query", description: "Optional case-insensitive term/definition filter" }] } }, "/api/v1/bem/budget-quote": { get: { summary: "Budget-first TapeOut vs Behemoth mining quote: walks Firsto's public ask book for a real fillable cost and applies the official non-pioneer weight formula for a daily $BEM estimate. Methodology adapted with credit from 0xLukin's TapeOutGo (MIT); this API never connects a wallet or executes a transaction.", parameters: [{ name: "budget_bnb", in: "query", description: "Budget in BNB, required" }] } }, "/api/v1/summary": { get: { summary: "Latest global snapshot" } }, "/api/v1/analytics": { get: { summary: "Current distributions, cross-sections, snapshot history, current all-public-Registry protocol pulse, and Airdrop summary" } }, "/api/v1/daily-activity": { get: { summary: "Public Registry activity series with range (1d/7d/30d/all), hour/day granularity and Asia/Shanghai or UTC day-boundary controls", parameters: [{ name: "range", in: "query" }, { name: "granularity", in: "query" }, { name: "timezone", in: "query" }] } }, "/api/v1/protocol-pulse": { get: { summary: "Current UTC-day all-public-Registry observation aggregate; not a complete on-chain transaction count" } }, "/api/v1/airdrop-overview": { get: { summary: "TapeOut public Airdrop contract summary with independent freshness status" } }, "/api/v1/market-overview": { get: { summary: "Confirmed Circuit Market Sold logs with bounded scan coverage" } }, "/api/v1/bem/overview": { get: { summary: "$BEM Proof of Design mining overview with official snapshot / RPC fallback status" } }, "/api/v1/bem/price": { get: { summary: "$BEM third-party aggregated price, liquidity and volume with explicit risk boundary" } }, "/api/v1/bem/tasks": { get: { summary: "Official $BEM taskbank with server-side pagination", parameters: [{ name: "page", in: "query" }, { name: "page_size", in: "query" }, { name: "q", in: "query" }, { name: "tier", in: "query" }, { name: "kind", in: "query" }, { name: "onchain", in: "query" }, { name: "group", in: "query" }] } }, "/api/v1/bem/algorithm": { get: { summary: "Officially disclosed $BEM Proof of Design rules and formulae" } }, "/api/v1/bem/leaderboard": { get: { summary: "Circuit-count-based wallet and task leaderboard computed from the official public miner index, plus historical pool-weight and miner/owner-count growth series; not the protocol's H-weight formula and never expressed as BEM/day" } }, "/api/v1/bem/trending": { get: { summary: "Community hot topics: tasks and wallets whose circuit count grew fastest over the trailing 24 hours, ranked purely from deltas between our own stored top-30 leaderboard snapshots. Not a social/discussion metric; entries without a comparable 24h-old baseline are omitted rather than shown with a fabricated change value." } }, "/api/v1/bem/trades": { get: { summary: "Large trades and buy/sell flow aggregated across the highest-volume BEM pools on BSC (selected by descending 24h volume until ~99% of observed volume is covered, from GeckoTerminal's public trades feed). A disclosed `coverage` block lists every tracked pool with its own freshness and states the achieved coverage share and untracked-pool count. The 'large trade' threshold is computed from the observed distribution of the aggregated stored window (95th percentile, floored at a small absolute minimum); not official protocol data or a trading signal." } }, "/api/v1/bem/holders": { get: { summary: "$BEM token holder count from a full ERC-20 Transfer-log balance census, with explicit scan coverage. Disabled (not_configured) until the shared BSC_LOGS_RPC_URL Worker secret provides a dedicated log provider; while the incremental scan is catching up the count is a lower bound, never a fabricated zero." } }, "/api/v1/data-health": { get: { summary: "Source freshness, configuration and degradation status" } },
      "/api/v1/official-assets/overview": { get: { summary: "Official TapeOut, Behemoth and Genesis CPU aggregate holder/minter/order observations. Holder counts are aggregate only; cumulative minters and open bids are not current holder balances." } },
      "/api/v1/official-assets/addresses": { get: { summary: "Official-snapshot address aggregation for cumulative minters or public open bids across TapeOut, Behemoth and Genesis CPU. Never a full current holder-balance census or identity attribution.", parameters: [{ name: "project", in: "query", description: "all, tapeout, behemoth or genesis" }, { name: "view", in: "query", description: "mints or open_bids" }, { name: "q", in: "query" }, { name: "page", in: "query" }, { name: "page_size", in: "query" }] } },
      "/api/v1/official-assets/health": { get: { summary: "Independent freshness and last-success status for official three-project snapshots" } },
      "/api/v1/official-assets/candles": { get: { summary: "Third-party public executed-trade OHLCV for the official three projects' NAND/LATCH assets. Not an official price feed, complete market history or investment signal.", parameters: [{ name: "project", in: "query", description: "tapeout, behemoth or genesis" }, { name: "asset", in: "query", description: "nand or latch" }, { name: "interval", in: "query", description: "5m, 1h or 1d; UTC buckets" }, { name: "range", in: "query", description: "24h, 7d or 30d; availability begins with the verified third-party trade archive" }] } },
      "/api/v1/community/processor-leaderboard": { get: { summary: "TapeOut Club's own top-ranked public wallet leaderboard (currently ~30 wallets), not a full transistor-holder census. Not official and never identity-attributed. TapeOut Club retired its per-circuit board on 2026-08-29, so the old view/asset_type/status filters no longer apply.", parameters: [{ name: "q", in: "query", description: "Filter by a substring of the wallet address" }, { name: "page", in: "query" }, { name: "page_size", in: "query" }] } },
      "/api/v1/community/processor-health": { get: { summary: "Independent freshness and last-success status for the TapeOut Club community processor board" } },
      "/api/v1/ecosystem/health": { get: { summary: "Self-probed HEAD/GET reachability check of every curated ecosystem tool's own URL, at most once per 60 minutes per tool. Not uptime history, content correctness or an endorsement of the linked tool." } }, "/api/v1/self-audit": { get: { summary: "The monitor auditing its own catalogue: which catalogued tool pages have shipped a change since we last reviewed their description, plus invariant checks over localisation coverage, evidence fields and review age. Detects that a page changed, never what changed or whether our description is now wrong; nothing is written into the catalogue automatically." } },
      "/api/v1/events": { get: { summary: "Cursor-paginated evidence ledger", parameters: [{ name: "type", in: "query" }, { name: "processor", in: "query" }, { name: "trust", in: "query" }, { name: "cursor", in: "query" }, { name: "page_size", in: "query" }] } },
      "/api/v1/processors": { get: { summary: "Paginated public Processor registry", parameters: [{ name: "q", in: "query" }, { name: "completion", in: "query" }, { name: "creator", in: "query" }, { name: "min_circuits", in: "query" }, { name: "sort", in: "query" }, { name: "page", in: "query" }, { name: "page_size", in: "query" }] } },
      "/api/v1/creators": { get: { summary: "Creator concentration aggregates" } }, "/api/v1/attestations": { get: { summary: "Public Tapeout website labels with source evidence" } }, "/api/v1/changes": { get: { summary: "Legacy public registry diff log" } }, "/api/v1/export.csv": { get: { summary: "Filtered Processor registry CSV" } }, "/api/v1/source-status": { get: { summary: "Data source and cadence status" } }
    }
  });
  if (url.pathname === "/api/v1/i18n") return json(API_LOCALE_METADATA);
  if (url.pathname === "/api/v1/updates") return json(await curatedCollection(url.searchParams, request, env, "updates"));
  if (url.pathname === "/api/v1/tools") return json(await curatedCollection(url.searchParams, request, env, "tools"));
  if (url.pathname === "/api/v1/strategies/schema") return json({
    execution: "none", storage: "browser URL fragment or local storage", fields: {
      event_types: ["processor.created", "processor.mint_delta", "processor.circuit_delta", "processor.completed", "attestation.website_label", "market.circuit_sold_large"],
      trust: ["protocol_observed", "official_site_label", "chain_observed"], min_mint_delta: "non-negative integer string", min_circuit_delta: "non-negative integer", completion_bands: ["0%", "0–1%", "1–25%", "25–75%", "75–99%", "100%+"], processor_or_creator_contains: "optional public address or text filter"
    }
  });
  if (url.pathname === "/api/v1/learn/resources") return json(await learningResources(url.searchParams, request, env));
  if (url.pathname === "/api/v1/glossary") {
    const q = String(url.searchParams.get("q") || "").trim().toLowerCase();
    const items = q ? GLOSSARY.filter(item => [item.id, item.term_en, item.term_zh, item.def_en, item.def_zh].some(field => String(field).toLowerCase().includes(q))) : GLOSSARY;
    return json({ version: GLOSSARY_VERSION, reviewed_at: GLOSSARY_REVIEWED_AT, total: GLOSSARY.length, matched: items.length, boundary: "Definitions summarize publicly displayed official TapeOut material; the official site remains the only rule source. Not investment advice.", items });
  }
  // Official three-project snapshots also change on the scheduled source cadence.
  // Never edge-cache an initial pending response or a stale last-success state.
  if (url.pathname === "/api/v1/official-assets/overview") return json(await officialAssetOverview(env), 200, { "cache-control": "no-store" });
  if (url.pathname === "/api/v1/official-assets/addresses") return json(await officialAssetAddresses(env, url.searchParams), 200, { "cache-control": "no-store" });
  if (url.pathname === "/api/v1/official-assets/health") return json(await officialAssetsHealth(env), 200, { "cache-control": "no-store" });
  if (url.pathname === "/api/v1/official-assets/candles") return json(await officialTransistorCandles(env, url.searchParams), 200, { "cache-control": "no-store" });
  // Community board freshness is itself user-facing. Do not retain a first-run pending
  // response at the edge after the scheduled source has produced a valid snapshot.
  if (url.pathname === "/api/v1/community/processor-leaderboard") return json(await communityProcessorLeaderboard(env, url.searchParams), 200, { "cache-control": "no-store" });
  if (url.pathname === "/api/v1/community/processor-health") return json(await communityProcessorBoardHealth(env), 200, { "cache-control": "no-store" });
  // Ecosystem tool reachability is itself user-facing (a tool marked pending/unreachable
  // should not linger cached at the edge past its own recheck cadence).
  if (url.pathname === "/api/v1/ecosystem/health") return json(await ecosystemToolHealthOverview(env), 200, { "cache-control": "no-store" });
  // The audit reports on the catalogue's current state and on its own last run;
  // a cached answer here would be a stale claim about staleness.
  if (url.pathname === "/api/v1/self-audit") return json(await selfAuditOverview(env), 200, { "cache-control": "no-store" });
  if (url.pathname === "/api/v1/analytics") return json(await analytics(env));
  if (url.pathname === "/api/v1/daily-activity") return json(await dailyActivity(env, url.searchParams));
  if (url.pathname === "/api/v1/airdrop-overview") return json(await airdropOverview(env));
  if (url.pathname === "/api/v1/market-overview") return json(await marketOverview(env));
  if (url.pathname === "/api/v1/bem/overview") return json(await bemMiningOverview(env));
  if (url.pathname === "/api/v1/bem/price") return json(await bemPriceOverview(env));
  if (url.pathname === "/api/v1/bem/tasks") return json(await bemTasks(env, url.searchParams));
  if (url.pathname === "/api/v1/bem/algorithm") return json(await bemAlgorithm(env, url.searchParams.get("locale")));
  if (url.pathname === "/api/v1/bem/leaderboard") return json(await bemLeaderboardOverview(env));
  if (url.pathname === "/api/v1/bem/trending") return json(await bemTrendingOverview(env), 200, { "cache-control": "no-store" });
  // Large-trade flags and buy/sell flow are themselves time-sensitive; never let a
  // pre-threshold or stale-window response linger cached at the edge.
  if (url.pathname === "/api/v1/bem/trades") return json(await bemTradesOverview(env), 200, { "cache-control": "no-store" });
  // Holder-scan configuration and coverage state are themselves user-facing; never
  // let a pre-configuration not_configured response linger cached at the edge.
  if (url.pathname === "/api/v1/bem/holders") return json(await bemHoldersOverview(env), 200, { "cache-control": "no-store" });
  if (url.pathname === "/api/v1/bem/budget-quote") {
    const budgetBnb = url.searchParams.get("budget_bnb");
    if (!budgetBnb) return json({ status: "error", error: "budget_bnb query parameter is required" }, 400);
    try {
      return json(await bemBudgetQuote(env, budgetBnb), 200, { "cache-control": "no-store" });
    } catch (error) {
      return json({ status: "error", error: error?.message || String(error) }, 400);
    }
  }
  if (url.pathname === "/api/v1/data-health") return json(await dataHealth(env));
  if (url.pathname === "/api/v1/protocol-pulse") { const data = await analytics(env); return json({ snapshot: data.snapshot, pulse: data.pulse, evidence: "Current UTC-day aggregate of public Registry observation events; not a complete on-chain transaction count." }); }
  if (url.pathname === "/api/v1/changes") return json((await env.DB.prepare("SELECT observed_at, change_type, address, name, detail FROM changes ORDER BY id DESC LIMIT 100").all()).results);
  if (url.pathname === "/api/v1/source-status") return json({ release: RELEASE, protocol_time_basis: PROTOCOL_TIME_BASIS, processors: PROCESSORS_URL, homepage: HOME_URL, cadence: "every 5 minutes", storage: "Cloudflare D1", official_processor_route: "https://tapeout.net/#p/{processor_address}", chain_sources: [{ chain_id: BSC_CHAIN_ID, provider: "public RPC fallback", contract: AIRDROP_ADDRESS, method: "getDrops(uint256,uint256)", scope: "Airdrop contract aggregate; independently health-checked and cache-backed" }, { chain_id: BSC_CHAIN_ID, provider: marketRpcUrl(env) ? "configured dedicated provider" : "not configured", contract: CIRCUIT_MARKET_ADDRESS, event: "Sold(uint256,address,address,uint256,uint256,uint256)", scan_mode: "disabled until BSC_LOGS_RPC_URL Worker secret is configured" }, { chain_id: BSC_CHAIN_ID, provider: marketRpcUrl(env) ? "configured dedicated provider" : "not configured", contract: BEM_TOKEN_ADDRESS, event: "Transfer(address,address,uint256)", scan_mode: "disabled until the same BSC_LOGS_RPC_URL Worker secret is configured (shared with the Circuit Market scan)", scope: "$BEM token holder count via a full Transfer-log balance census from an estimated deployment block; coverage boundaries are disclosed per response" }, { chain_id: BEM_CHAIN_ID, provider: "TapeOut public snapshot with TapeOut root-RPC fallback", contract: BEM_MINING_ADDRESS, methods: BEM_RPC_METRICS.map(([name]) => `${name}()`), scope: "$BEM Proof of Design mining overview; public read-only and independently health-checked" }], static_sources: [{ url: "/api/v1/ecosystem/health", scope: "Self-probed HEAD/GET reachability check of every curated ecosystem tool's own URL, checked at most once per 60 minutes per tool; not uptime history or an endorsement of the linked tool" }, { url: "/api/v1/bem/budget-quote", scope: "Read-only budget-first mining quote against Firsto's public ask book; methodology credited to 0xLukin/TapeOutGo (MIT), no wallet or transaction execution" }, { url: "/api/v1/bem/trending", scope: "Community hot topics computed from deltas between our own stored top-30 leaderboard snapshots over a trailing 24h window; not a social/discussion signal, entries without a comparable baseline are omitted" }, { url: "/api/v1/bem/trades", provider: "GeckoTerminal (keyless public trades feed)", scope: "Third-party aggregated executed-trade records across the highest-volume BEM pools on BSC (pool set discovered from GeckoTerminal's live token-pools listing, never hardcoded, refreshed every few hours; trades round-robin-synced a few pools per tick to respect GeckoTerminal's rate limit); the response's coverage block discloses tracked pools, achieved coverage share of total observed 24h volume, and untracked-pool count. Large-trade threshold is a disclosed 95th-percentile-with-floor computation over the aggregated stored window, not a fabricated fixed dollar amount, official protocol data or a trading signal" }, { url: "/api/v1/bem/leaderboard", scope: "Circuit-count-based wallet/task leaderboard computed from the official public miner index (tapeout.net/pod/pod-miners.json); chart selection informed by reviewing the community @ekonomeest Dune dashboard, all figures independently computed, never expressed as BEM/day or official weight" }, { url: "/api/v1/glossary", scope: "Bilingual glossary of official TapeOut terms; definitions cite the official pages they summarize" }, { url: "/api/v1/learn/resources", scope: "Curated public learning-resource catalog; reviewed daily and tiered as official/community/reference" }, { url: BEM_TASKBANK_URL, scope: "Official $BEM taskbank" }, { url: BEM_MINERS_URL, scope: "Official miner-index aggregate only" }, { url: BEM_PRICE_URL, fallback: BEM_PRICE_PAIR_URL, provider: BEM_PRICE_PROVIDER, scope: "Third-party BEM market aggregation, not official price" }], event_trust: "protocol_observed events are derived from public registry deltas; official_site_label events cite labels displayed by the public Tapeout website; chain_observed events are confirmed decoded public BNB Chain logs" });
  if (url.pathname === "/api/v1/attestations") {
    const rows = await currentRows(env, { boot: true });
    return json({ source: OFFICIAL_SITE_URL, trust: "official_site_label", items: rows.map(row => ({ processor_address: row.address, label: websiteLabel(row.address)?.label, evidence_url: OFFICIAL_SITE_URL })).filter(item => item.label) });
  }
  if (url.pathname === "/api/v1/processors" || url.pathname === "/api/v1/export.csv" || url.pathname === "/api/v1/creators") {
    const rows = await currentRows(env, { boot: true });
    const filtered = applyProcessorFilters(rows, url.searchParams);
    if (url.pathname === "/api/v1/creators") {
      const groups = new Map();
      for (const row of filtered) {
        const key = row.creator_address || "unavailable";
        const group = groups.get(key) || { creator_address: key, processor_count: 0, circuit_total: 0, minted_total: 0n, supply_total: 0n };
        group.processor_count += 1; group.circuit_total += Number(row.circuit_count || 0); group.minted_total += toBigInt(row.minted); group.supply_total += toBigInt(row.supply_cap); groups.set(key, group);
      }
      const items = [...groups.values()].map(group => ({ ...group, minted_total: group.minted_total.toString(), supply_total: group.supply_total.toString() })).sort((a, b) => b.circuit_total - a.circuit_total || b.processor_count - a.processor_count);
      return json({ observed_at: rows[0]?.observed_at || null, total: items.length, items });
    }
    const sorted = sortProcessors(filtered, url.searchParams.get("sort") || "circuits").map(toPublicProcessor);
    if (url.pathname === "/api/v1/export.csv") {
      const header = ["observed_at", "name", "processor_address", "creator_address", "transistor_address", "minted", "supply_cap", "completion_bps", "circuit_count", "official_url"];
      const body = sorted.map(row => [row.observed_at, row.name, row.address, row.creator_address, row.transistor_address, row.minted, row.supply_cap, row.completion_bps, row.circuit_count, row.official_url].map(csvEscape).join(","));
      return new Response([header.join(","), ...body].join("\n"), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": "attachment; filename=tapeout-public-registry.csv", "cache-control": "public, max-age=300" } });
    }
    const pageSize = Math.min(Math.max(Number(url.searchParams.get("page_size") || 50), 1), 100);
    const page = Math.min(Math.max(Number(url.searchParams.get("page") || 1), 1), Math.max(1, Math.ceil(sorted.length / pageSize)));
    const start = (page - 1) * pageSize;
    return json({ observed_at: rows[0]?.observed_at || null, total: sorted.length, page, page_size: pageSize, page_count: Math.ceil(sorted.length / pageSize), filters: Object.fromEntries(url.searchParams), items: sorted.slice(start, start + pageSize) });
  }
  if (url.pathname === "/api/v1/events") {
    await ensureEventSchema(env);
    const type = url.searchParams.get("type"), processor = (url.searchParams.get("processor") || "").toLowerCase(), trust = url.searchParams.get("trust"), pageSize = Math.min(Math.max(Number(url.searchParams.get("page_size") || 50), 1), 100);
    const cursorValue = url.searchParams.get("cursor"), where = ["(trust = 'chain_observed' OR observed_at > COALESCE((SELECT observed_at FROM snapshots WHERE processor_count > 0 ORDER BY id ASC LIMIT 1), ''))", "(trust = 'chain_observed' OR observed_at NOT IN (SELECT attempted_at FROM refresh_runs WHERE status = 'updated' AND processor_count > 0 AND changed_processors >= processor_count))"], bindings = [];
    if (type) { where.push("event_type = ?"); bindings.push(type); }
    if (processor) { where.push("processor_address = ?"); bindings.push(processor); }
    if (trust) { where.push("trust = ?"); bindings.push(trust); }
    if (cursorValue) {
      const [observedAt, ...idParts] = cursorValue.split("|");
      const id = idParts.join("|");
      if (observedAt && id) { where.push("(observed_at < ? OR (observed_at = ? AND id < ?))"); bindings.push(observedAt, observedAt, id); }
    }
    const statement = `SELECT id, observed_at, event_type, trust, processor_address, creator_address, name, metric_name, metric_value, detail, evidence_url, raw_json FROM public_events${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY observed_at DESC, id DESC LIMIT ?`;
    const result = await env.DB.prepare(statement).bind(...bindings, pageSize + 1).all();
    const page = result.results.slice(0, pageSize).map(event => ({ ...event, evidence: [{ kind: event.trust === "official_site_label" ? "official_website_label" : "official_processor_page", url: event.evidence_url }], raw: JSON.parse(event.raw_json) }));
    const last = page.at(-1), hasMore = result.results.length > pageSize;
    return json({ page_size: pageSize, has_more: hasMore, next_cursor: hasMore && last ? `${last.observed_at}|${last.id}` : null, items: page });
  }
  return null;
}

export async function api(request, env) {
  const url = new URL(request.url);
  const v1Response = await v1(request, env);
  if (v1Response) return v1Response;
  if (url.pathname === "/api/summary" || url.pathname === "/api/v1/summary") {
    // ensureRegistryFresh only needs to block when it actually triggers a background sync
    // (rare); otherwise it races the read below instead of gating it sequentially.
    const [, firstSnapshot] = await Promise.all([ensureRegistryFresh(env), env.DB.prepare("SELECT observed_at, processor_count, minted_total, circuit_total FROM snapshots ORDER BY id DESC LIMIT 1").first()]);
    let snapshot = firstSnapshot;
    if (!snapshot || Number(snapshot.processor_count) === 0) { await refresh(env); snapshot = await env.DB.prepare("SELECT observed_at, processor_count, minted_total, circuit_total FROM snapshots ORDER BY id DESC LIMIT 1").first(); }
    return json({ snapshot, source: PROCESSORS_URL, privacy: "Private processor records are excluded from public results." });
  }
  if (url.pathname === "/api/processors") {
    const limit = Math.min(Number(url.searchParams.get("limit") || 100), 1000);
    const rows = await currentRows(env, { boot: true });
    return json(sortProcessors(rows, "circuits").slice(0, limit).map(toPublicProcessor));
  }
  if (url.pathname === "/api/changes") return json((await env.DB.prepare("SELECT observed_at, change_type, address, name, detail FROM changes ORDER BY id DESC LIMIT 100").all()).results);
  if (url.pathname === "/api/analytics") return json(await analytics(env));
  if (url.pathname === "/api/source-status") return json({ processors: PROCESSORS_URL, homepage: HOME_URL, cadence: "every 5 minutes", storage: "Cloudflare D1", circuit_market: CIRCUIT_MARKET_ADDRESS, chain_id: BSC_CHAIN_ID, event_trust: "protocol_observed events are derived from public registry deltas; chain_observed events are confirmed decoded public BNB Chain logs" });
  if (url.pathname === "/api/refresh") return json({ error: "Refresh is restricted to the Cloudflare scheduled handler." }, 403);
  return null;
}
