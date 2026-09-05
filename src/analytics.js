import { PROCESSORS_URL, CIRCUIT_MARKET_ADDRESS, PROTOCOL_TIME_BASIS } from "./constants.js";
import { toBigInt, completionBps, completionBand, circuitBand, supplyBand, websiteLabel } from "./util.js";
import { ensureEventSchema } from "./events.js";
import { ensureRefreshSchema, ensureRegistryFresh, sortProcessors, toPublicProcessor } from "./registry.js";
import { ensureAirdropFresh, airdropOverview } from "./airdrop.js";
import { ensureBemMiningFresh, ensureBemPriceFresh, ensureBemSchema, bemHealth } from "./bem.js";
import { ensureOfficialAssetsFresh, ensureOfficialAssetSchema, officialAssetsHealth, ensureTransistorCandleSchema, transistorCandlesHealth } from "./official_assets.js";
import { ensureCommunityBoardFresh, ensureCommunityHolderSchema, communityProcessorBoardHealth } from "./community.js";
import { ensureMarketSchema, marketRpcUrl } from "./market.js";

export async function ensureFreshnessRecovery(env) {
  return Promise.allSettled([ensureRegistryFresh(env), ensureAirdropFresh(env), ensureBemMiningFresh(env), ensureBemPriceFresh(env), ensureOfficialAssetsFresh(env), ensureCommunityBoardFresh(env)]);
}

export async function protocolPulse(env, snapshot) {
  if (!snapshot?.observed_at) return { window_start: null, observed_at: null, new_processors: 0, mint_delta: "0", circuit_delta: 0, active_creators: 0, active_processors: 0, event_count: 0 };
  const observed = new Date(snapshot.observed_at), windowStart = new Date(Date.UTC(observed.getUTCFullYear(), observed.getUTCMonth(), observed.getUTCDate())).toISOString();
  const baseline = await env.DB.prepare("SELECT observed_at FROM snapshots WHERE processor_count > 0 ORDER BY id ASC LIMIT 1").first();
  const result = await env.DB.prepare("SELECT event_type, creator_address, processor_address, metric_value FROM public_events WHERE observed_at >= ? AND observed_at <= ? AND (trust = 'chain_observed' OR observed_at > ?) AND (trust = 'chain_observed' OR observed_at NOT IN (SELECT attempted_at FROM refresh_runs WHERE status = 'updated' AND processor_count > 0 AND changed_processors >= processor_count))").bind(windowStart, snapshot.observed_at, baseline?.observed_at || "").all();
  const creators = new Set(), processors = new Set();
  let newProcessors = 0, mintDelta = 0n, circuitDelta = 0;
  for (const event of result.results) {
    if (event.creator_address) creators.add(event.creator_address);
    if (event.processor_address) processors.add(event.processor_address);
    if (event.event_type === "processor.created") newProcessors += 1;
    if (event.event_type === "processor.mint_delta") mintDelta += toBigInt(event.metric_value);
    if (event.event_type === "processor.circuit_delta") circuitDelta += Number(event.metric_value || 0);
  }
  return { window_start: windowStart, observed_at: snapshot.observed_at, new_processors: newProcessors, mint_delta: mintDelta.toString(), circuit_delta: circuitDelta, active_creators: creators.size, active_processors: processors.size, event_count: result.results.length };
}

export function segmentAnalytics(processors) {
  const make = key => ({ key, processor_count: 0, minted_total: 0n, circuit_total: 0, fully_minted: 0 });
  const labels = new Map(["official", "certified", "community", "unlabelled"].map(key => [key, make(key)]));
  const completions = new Map(["0%", "0–1%", "1–25%", "25–75%", "75–99%", "100%+"].map(key => [key, make(key)]));
  const supplies = new Map(["0", "≤10K", "10K–100K", "100K–1M", "1M–10M", ">10M"].map(key => [key, make(key)]));
  const densities = new Map(["0", "1", "2–4", "5–9", "10+"].map(key => [key, make(key)]));
  for (const row of processors) {
    const bps = completionBps(row.minted, row.supply_cap), labelKey = websiteLabel(row.address)?.label || "unlabelled", completionKey = completionBand(bps);
    for (const segment of [labels.get(labelKey), completions.get(completionKey), supplies.get(supplyBand(row.supply_cap)), densities.get(circuitBand(Number(row.circuit_count || 0)))]) {
      segment.processor_count += 1;
      segment.minted_total += toBigInt(row.minted);
      segment.circuit_total += Number(row.circuit_count || 0);
      if (bps !== null && bps >= 10000) segment.fully_minted += 1;
    }
  }
  const serialize = segment => ({ ...segment, minted_total: segment.minted_total.toString() });
  return { by_website_label: [...labels.values()].map(serialize), by_completion_band: [...completions.values()].map(serialize), by_supply_scale: [...supplies.values()].map(serialize), by_circuit_density: [...densities.values()].map(serialize) };
}

export function activityOffsetMs(timezone) { return timezone === "Asia/Shanghai" ? 8 * 60 * 60 * 1000 : 0; }
export function activityBucketStartMs(value, granularity, timezone) {
  const offset = activityOffsetMs(timezone), shifted = new Date(Date.parse(value) + offset);
  return granularity === "day"
    ? Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - offset
    : Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate(), shifted.getUTCHours()) - offset;
}
export function activityBucketKey(startMs, granularity, timezone) {
  const shifted = new Date(startMs + activityOffsetMs(timezone)), pad = value => String(value).padStart(2, "0"), day = `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
  return granularity === "day" ? day : `${day} ${pad(shifted.getUTCHours())}:00`;
}

export async function dailyActivity(env, query = new URLSearchParams()) {
  await Promise.all([ensureEventSchema(env), ensureRefreshSchema(env)]);
  await ensureRegistryFresh(env);
  const requestedRange = ["1d", "7d", "30d", "all"].includes(query.get("range")) ? query.get("range") : "7d";
  const granularity = ["hour", "day"].includes(query.get("granularity")) ? query.get("granularity") : "day";
  const timezone = ["Asia/Shanghai", "UTC"].includes(query.get("timezone")) ? query.get("timezone") : "Asia/Shanghai";
  const rangeMs = { "1d": 24 * 60 * 60 * 1000, "7d": 7 * 24 * 60 * 60 * 1000, "30d": 30 * 24 * 60 * 60 * 1000, all: 180 * 24 * 60 * 60 * 1000 }[requestedRange];
  const [latest, baseline] = await Promise.all([
    env.DB.prepare("SELECT observed_at, processor_count, circuit_total FROM snapshots WHERE processor_count > 0 ORDER BY id DESC LIMIT 1").first(),
    env.DB.prepare("SELECT observed_at FROM snapshots WHERE processor_count > 0 ORDER BY id ASC LIMIT 1").first(),
  ]);
  if (!latest?.observed_at || !baseline?.observed_at) return { observed_at: null, mode: "time_series", requested_range: requestedRange, granularity, timezone, coverage_start: null, coverage_end: null, coverage_days: 0, partial_first_bucket: false, buckets: [] };
  const endMs = Date.parse(latest.observed_at), requestedStartMs = requestedRange === "all" ? Math.max(Date.parse(baseline.observed_at), endMs - rangeMs) : endMs - rangeMs;
  const coverageStartMs = Math.max(Date.parse(baseline.observed_at), requestedStartMs), firstBucketMs = activityBucketStartMs(new Date(coverageStartMs).toISOString(), granularity, timezone), bucketMs = granularity === "day" ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
  const [eventsResult, snapshotsResult] = await Promise.all([
    env.DB.prepare("SELECT observed_at, event_type, trust, creator_address, processor_address, metric_value FROM public_events WHERE observed_at >= ? AND observed_at <= ? AND event_type IN ('processor.created','processor.mint_delta','processor.circuit_delta','processor.completed') AND trust = 'protocol_observed' AND observed_at NOT IN (SELECT attempted_at FROM refresh_runs WHERE status = 'updated' AND processor_count > 0 AND changed_processors >= processor_count) ORDER BY observed_at ASC").bind(new Date(coverageStartMs).toISOString(), latest.observed_at).all(),
    env.DB.prepare("SELECT observed_at, processor_count, circuit_total FROM snapshots WHERE processor_count > 0 AND observed_at <= ? ORDER BY observed_at ASC").bind(latest.observed_at).all(),
  ]);
  const series = new Map();
  for (let cursor = firstBucketMs; cursor <= endMs; cursor += bucketMs) {
    const key = activityBucketKey(cursor, granularity, timezone);
    series.set(key, { bucket_start: key, bucket_start_utc: new Date(cursor).toISOString(), bucket_end_utc: new Date(Math.min(cursor + bucketMs, endMs + 1)).toISOString(), new_processors: 0, mint_delta: 0n, minting_processors: new Set(), circuit_delta: 0, active_creators: new Set(), processor_total: null, circuit_total: null });
  }
  for (const event of eventsResult.results) {
    const key = activityBucketKey(activityBucketStartMs(event.observed_at, granularity, timezone), granularity, timezone), row = series.get(key);
    if (!row) continue;
    if (event.event_type === "processor.created") row.new_processors += 1;
    if (event.event_type === "processor.mint_delta") { row.mint_delta += toBigInt(event.metric_value); if (event.processor_address) row.minting_processors.add(event.processor_address); }
    if (event.event_type === "processor.circuit_delta") row.circuit_delta += Number(event.metric_value || 0);
    if (event.creator_address) row.active_creators.add(event.creator_address);
  }
  let snapshotIndex = 0, currentSnapshot = null;
  for (const row of series.values()) {
    const bucketEndMs = Math.min(Date.parse(row.bucket_end_utc), endMs + 1);
    while (snapshotIndex < snapshotsResult.results.length && Date.parse(snapshotsResult.results[snapshotIndex].observed_at) < bucketEndMs) currentSnapshot = snapshotsResult.results[snapshotIndex++];
    if (currentSnapshot) { row.processor_total = Number(currentSnapshot.processor_count); row.circuit_total = Number(currentSnapshot.circuit_total); }
  }
  const buckets = [...series.values()].map(row => ({ ...row, mint_delta: row.mint_delta.toString(), minting_processors: row.minting_processors.size, active_creators: row.active_creators.size }));
  return { observed_at: latest.observed_at, mode: "time_series", requested_range: requestedRange, range_limited: requestedRange === "all" && requestedStartMs > Date.parse(baseline.observed_at), granularity, timezone, bucket_minutes: granularity === "day" ? 1440 : 60, coverage_start: new Date(coverageStartMs).toISOString(), coverage_end: latest.observed_at, monitor_coverage_start: baseline.observed_at, coverage_days: Number(((endMs - coverageStartMs) / (24 * 60 * 60 * 1000)).toFixed(2)), partial_first_bucket: coverageStartMs > firstBucketMs, metrics: ["new_processors", "minting_processors", "circuit_delta", "active_creators", "processor_total", "circuit_total", "mint_delta"], buckets };
}

// The run table stores "ok"; the page and the other domains speak "healthy".
// A last run older than four ticks is stale even if it succeeded.
function marketStatus(env, run, lastSuccessRun = null) {
  if (!marketRpcUrl(env)) return "not_configured";
  if (!run) return "pending";
  // The log provider rate-limits Cloudflare's shared egress, so roughly three ticks in
  // four fail by design. Returning the latest attempt's status made the domain read
  // "error" while the scan was keeping pace perfectly well. Judge the data by when it
  // was last actually advanced; the failing attempt stays visible in last_run.
  const successAt = (run.status === "ok" ? run.attempted_at : null) || lastSuccessRun?.attempted_at || null;
  if (!successAt) return run.status === "error" ? "error" : "pending";
  const age = Date.now() - Date.parse(successAt);
  return Number.isFinite(age) && age > 20 * 60000 ? "stale" : "healthy";
}

export async function dataHealth(env) {
  // Schema steps are writes; if D1 is refusing writes they fail, and this endpoint
  // must still answer. Each is awaited on its own and a failure is tolerated here.
  await Promise.all([ensureMarketSchema(env), ensureRefreshSchema(env), ensureBemSchema(env), ensureCommunityHolderSchema(env), ensureOfficialAssetSchema(env), ensureTransistorCandleSchema(env)].map(p => Promise.resolve(p).catch(() => null)));
  // ensureFreshnessRecovery only needs to block a request when it actually triggers a
  // background sync (rare, and each domain's own *Health helper already races its own
  // freshness check against its reads); otherwise it is one more concurrent branch here
  // instead of a sequential gate in front of all eight reads below.
  // This endpoint exists to report degradation, so it must survive it. A branch that
  // throws (a background sync hitting the D1 daily write limit did this once and took
  // the whole response down with a 500) is reported as its own error status instead.
  const guarded = (label, promise) => promise.catch(error => ({ status: "error", error: `${label}: ${String(error?.message || error).slice(0, 200)}` }));
  const [, snapshot, refreshRun, market, marketSuccess, airdrop, bem, community_processor_board, official_three_assets, transistor_candles] = await Promise.all([
    guarded("freshness_recovery", ensureFreshnessRecovery(env)),
    env.DB.prepare("SELECT observed_at, processor_count FROM snapshots WHERE processor_count > 0 ORDER BY id DESC LIMIT 1").first(),
    env.DB.prepare("SELECT attempted_at, status, source_generated_at, processor_count, changed_processors, error FROM refresh_runs ORDER BY id DESC LIMIT 1").first(),
    env.DB.prepare("SELECT attempted_at, status, from_block, to_block, sale_count, error FROM market_sync_runs ORDER BY id DESC LIMIT 1").first(),
    env.DB.prepare("SELECT attempted_at FROM market_sync_runs WHERE status = 'ok' ORDER BY id DESC LIMIT 1").first(),
    guarded("airdrop", airdropOverview(env)), guarded("bem", bemHealth(env)), guarded("community_processor_board", communityProcessorBoardHealth(env)), guarded("official_three_assets", officialAssetsHealth(env)), guarded("transistor_candles", transistorCandlesHealth(env)),
  ]);
  const checkedAgeMinutes = refreshRun?.attempted_at ? Math.max(0, Math.round((Date.now() - Date.parse(refreshRun.attempted_at)) / 60000)) : null;
  const dataAgeMinutes = snapshot?.observed_at ? Math.max(0, Math.round((Date.now() - Date.parse(snapshot.observed_at)) / 60000)) : null;
  const registryStatus = !snapshot ? "unavailable" : refreshRun?.status === "error" || checkedAgeMinutes === null || checkedAgeMinutes > 12 ? "stale" : "healthy";
  return { checked_at: new Date().toISOString(), registry: { status: registryStatus, source: PROCESSORS_URL, cadence: "every 5 minutes", last_checked_at: refreshRun?.attempted_at || null, last_data_change_at: snapshot?.observed_at || null, source_generated_at: refreshRun?.source_generated_at || null, check_age_minutes: checkedAgeMinutes, data_age_minutes: dataAgeMinutes, processor_count: snapshot?.processor_count || 0, last_run: refreshRun || null }, airdrop, market: { status: marketStatus(env, market, marketSuccess), checked_at: marketSuccess?.attempted_at || (market?.status === "ok" ? market.attempted_at : null), last_attempt_failed: market?.status === "error", provider_configured: Boolean(marketRpcUrl(env)), last_run: market || null, contract: CIRCUIT_MARKET_ADDRESS, note: marketRpcUrl(env) ? "Uses configured dedicated provider and confirmed incremental windows." : "Market metrics are disabled until a dedicated BSC provider URL is configured as a Worker secret." }, bem, official_three_assets, community_processor_board, transistor_candles };
}

export async function analytics(env) {
  // Same race-instead-of-gate pattern as dataHealth: ensureRegistryFresh only blocks a
  // request when it actually triggers a background sync.
  const [, processorsResult, snapshotsResult, snapshot] = await Promise.all([
    ensureRegistryFresh(env),
    env.DB.prepare("SELECT address, name, supply_cap, minted, circuit_count, creator_address, observed_at FROM processors_current").all(),
    env.DB.prepare("SELECT observed_at, processor_count, circuit_total FROM snapshots WHERE processor_count > 0 ORDER BY id DESC LIMIT 168").all(),
    env.DB.prepare("SELECT observed_at, processor_count, minted_total, circuit_total FROM snapshots WHERE processor_count > 0 ORDER BY id DESC LIMIT 1").first(),
  ]);
  const processors = processorsResult.results;
  const completionOrder = ["0%", "0–1%", "1–25%", "25–75%", "75–99%", "100%+"];
  const circuitOrder = ["0", "1", "2–4", "5–9", "10+"];
  const completion = new Map(completionOrder.map(key => [key, 0]));
  const circuits = new Map(circuitOrder.map(key => [key, 0]));
  let fullyMinted = 0, mintedPositive = 0, overSupply = 0;
  for (const row of processors) {
    const minted = toBigInt(row.minted), supply = toBigInt(row.supply_cap), bps = completionBps(row.minted, row.supply_cap);
    completion.set(completionBand(bps), (completion.get(completionBand(bps)) || 0) + 1);
    circuits.set(circuitBand(row.circuit_count), (circuits.get(circuitBand(row.circuit_count)) || 0) + 1);
    if (minted > 0n) mintedPositive += 1;
    if (supply > 0n && minted >= supply) fullyMinted += 1;
    if (supply > 0n && minted > supply) overSupply += 1;
  }
  const topCircuits = sortProcessors(processors, "circuits").slice(0, 50).map(toPublicProcessor);
  const scatter = processors.map(row => ({ address: row.address, name: row.name, completion_bps: completionBps(row.minted, row.supply_cap), circuit_count: Number(row.circuit_count || 0), minted: row.minted, website_label: websiteLabel(row.address)?.label || "unlabelled" })).filter(row => row.completion_bps !== null && row.circuit_count > 0).sort((a, b) => b.circuit_count - a.circuit_count).slice(0, 120);
  const [pulse, segments, airdrop] = await Promise.all([protocolPulse(env, snapshot), Promise.resolve(segmentAnalytics(processors)), airdropOverview(env)]);
  return { snapshot, pulse, segments, scatter, airdrop, protocol_time_basis: PROTOCOL_TIME_BASIS, protocol_scope: "All publicly listed TapeOut Processors after server-side privacy filtering; includes official, certified, community and unlabelled public Registry records.", counts: { processors: processors.length, fully_minted: fullyMinted, minted_positive: mintedPositive, over_supply: overSupply }, completion: completionOrder.map(key => ({ key, count: completion.get(key) || 0 })), circuit_density: circuitOrder.map(key => ({ key, count: circuits.get(key) || 0 })), top_circuits: topCircuits, history: snapshotsResult.results.slice().reverse() };
}
