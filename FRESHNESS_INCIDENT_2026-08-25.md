# Data Freshness Incident Baseline — 2026-08-25

## Production observation time

The baseline was collected on 2026-08-25 around `13:16:31Z` from `https://tapeout-public-monitor.tapeout-labs.workers.dev` and direct public market endpoints. This file records raw source facts for remediation and must not be interpreted as a price forecast or investment view.

## Whole-site health finding

`/api/v1/data-health` reported that the Registry, Airdrop, $BEM mining, official three-project snapshots were stale at the same time. Registry `last_checked_at` was `2026-08-25T12:55:43.454Z`, giving `check_age_minutes: 21` despite the Worker configuration declaring `*/5 * * * *`. Official three-project data also showed a 26-minute check age. This indicates a shared scheduler/freshness recovery gap rather than a price-only presentation issue.

The same health response showed `market.status: not_configured`, which is an explicit configured-provider gap rather than a zero-sales result. Taskbank health was reported healthy because its successful check was recent even though the content snapshot was older; it must remain labelled as a static source rather than realtime data.

## $BEM price finding

Production `/api/v1/bem/price` at `2026-08-25T13:16Z` returned `$104.11` with platform snapshot time `2026-08-25T13:05:43.454Z`, provider `DexScreener (third-party aggregation)`, and verified pair `0x2f5ec19ab0583d3fcd9bcbcd9ab416d2858eea38`.

At the collection time, direct public sources for that exact BEM/USDT pair returned materially different prices:

| Source | Public endpoint | Pair | Price USD | Notes |
|---|---|---|---:|---|
| DexScreener direct pair | `https://api.dexscreener.com/latest/dex/pairs/bsc/0x2f5ec19ab0583d3fcd9bcbcD9AB416d2858EeA38` | exact verified BEM/USDT V3 pair | 87.90 | 5m price change was -24.15%; high intraperiod volatility visible |
| DexScreener token aggregation | `https://api.dexscreener.com/latest/dex/tokens/0x5ce033B2bFCa3Af30b3e8C8457DeaF776A8b695a` | same verified pair appears first | 87.90 | also lists lower-liquidity BEM pairs |
| GeckoTerminal verified pool | `https://api.geckoterminal.com/api/v2/networks/bsc/pools/0x2f5ec19ab0583d3fcd9bcbcD9AB416d2858EeA38` | exact verified BEM/USDT pool | 84.3896036237105 | separate indexer, meaningful but expected fast-market lag possible |

The Worker had been fetching the **token aggregation route first**, selected the highest-liquidity candidate, and only used the direct verified pair on primary failure. Its generic JSON response default used `cache-control: public, max-age=300`. Thus the user could see a platform snapshot up to the scheduled lag plus up to five minutes of edge cache delay, while rapid price movement continued.

## Remediation principles

1. Treat the direct, verified BEM/USDT pair as the display primary; use GeckoTerminal and token aggregation as visible cross-checks and fallbacks.
2. Never call any third-party price official.
3. Preserve last-success snapshot on errors, but show `stale`, `source disagreement`, source check time, snapshot time, and pair identity.
4. Dynamic API responses must not inherit the five-minute public edge cache intended for ordinary API payloads.
5. Add bounded on-demand recovery when a scheduled source is stale, with independent per-domain locking and no impact on core rendering.

## Raw capture location

Original captured response bodies and headers are in `/tmp/tapeout-freshness-baseline/` during this session. Relevant public URLs are listed above.

## Real-time hardening follow-up

The initial repair removed stale edge caching and introduced bounded on-demand recovery. The follow-up now separates the volatile market quote from the five-minute public-source workflow: the verified BEM/USDT quote is scheduled once per minute, while Registry, Airdrop, mining, official three-project snapshots and other domains retain their existing independent cadences. The five-minute job deliberately skips the price fetch when the one-minute quote job already owns that responsibility.

The public price health window is now two minutes. An already open browser refreshes only the $BEM price card once per minute and immediately when the tab becomes visible again; it does not re-run the whole dashboard. Failed quote requests keep the last verified snapshot with its original check time and explicit stale state, rather than inventing a new price. Cross-check providers remain bounded independent diagnostics and cannot replace a successful direct verified-pair quote merely because an auxiliary provider is rate-limited.
