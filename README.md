# TapeOut Intelligence

A public-source research terminal for the [TapeOut Protocol](https://tapeout.net/) — an on-chain logic-circuit protocol on BNB Chain where NAND/LATCH transistor tokens (ERC-1155) are combined into circuits, "taped out" as NFTs (ERC-721), and mined for `$BEM` via Proof of Design (PoD).

**Live site:** https://tapeout.work
**API:** https://tapeout.work/api/v1/catalog

Everything here is read-only and derived from public sources: TapeOut's own public registry and PoD endpoints, public BNB Chain RPC/logs, and a handful of independently-verified community tools and datasets that are explicitly credited wherever their data or design ideas are used. Nothing on this site connects a wallet, holds funds, or executes a transaction on anyone's behalf. Nothing here is investment advice.

## What it does

- **Registry tracking** — the full public Processor registry, paginated, with completion/circuit-density segmentation, a public event stream (`processor.created`, `.mint_delta`, `.circuit_delta`, `.completed`), and CSV export.
- **`$BEM` Proof of Design** — the official mining snapshot (with a scoped RPC fallback), the public taskbank, officially disclosed scoring rules, and third-party price/liquidity data from a verified BEM/USDT pair.
- **Official three-project observation** — aggregate holder/minter/open-bid data for TapeOut, Behemoth and Genesis CPU, plus NAND/LATCH executed-trade candles from public trade records.
- **Budget-first mining quote** — walks a public order book to quote a real fillable cost for a mining machine and its projected daily `$BEM`. Methodology adapted with credit from [0xLukin/TapeOutGo](https://github.com/0xLukin/tapeoutgo) (MIT); this site never buys, tapes out, or claims for you.
- **Circuit-count leaderboard** — wallet and task concentration, processor split, and pool-weight growth, computed independently from the official public miner index. Chart selection was informed by reviewing [@ekonomeest's Dune dashboard](https://dune.com/ekonomeest/tapeout-mining-intelligence), credited in the API response.
- **Community processor board** — a snapshot of TapeOut Club's own public wallet leaderboard, with independent freshness tracking and honest degradation when the upstream source changes shape (it has, more than once).
- **Curated ecosystem directory** — reviewed community tools and update posts, tiered `official` / `community` / `reference`, each with an explicit safety note (wallet risk, audit status, non-official boundary) — never just a link.
- **Newcomer learning center** — governed, safety-reviewed learning resources with a bilingual glossary of official terminology.
- **11 languages** — `zh` and `en` are canonical; nine more locales (`ko` `ja` `es` `ar` `tr` `fr` `de` `ru` `pt`) are covered by reviewed UI translations, with an explicit English (not Chinese) fallback for anything not yet translated.

The full machine-readable list is always the source of truth: [`/api/v1/catalog`](https://tapeout.work/api/v1/catalog) and [`/api/v1/openapi.json`](https://tapeout.work/api/v1/openapi.json).

## How it's built

A single Cloudflare Worker (`src/worker.js`), split into domain modules under `src/`, with a D1 (SQLite) database for snapshots and a static `public/` frontend served from the same Worker. Cron triggers (`* * * * *` for the volatile third-party price feed, `*/5 * * * *` for everything else) do the data collection; on-demand freshness checks (`ensureXFresh` pattern) recover a stale domain if a scheduled run was missed, without blocking a request behind a slow external fetch unless one is actually due.

No build step, no framework, no dependencies beyond `wrangler` itself.

## Editorial rules this project holds itself to

These aren't aspirational — they're enforced by the contract scripts in `scripts/` and checked before every deploy:

- **No fabricated data.** A missing or stale source is shown as `stale`/`pending`/`error` with the last successful snapshot, never backfilled with zeros or invented numbers.
- **No identity inference.** Public addresses are never labeled as an investor, LP, router, or real-world identity. Official/certified/community labels are only ever shown when TapeOut's own site already displays them.
- **Every community tool and update is independently reviewed** before it's added — the operator opens the actual site, checks whether it asks for a wallet connection or a real signed transaction, and writes an honest safety note. Nothing is added on the strength of a tweet alone.
- **Credit where methodology is borrowed.** If a feature's approach was adapted from someone else's open-source tool or public dashboard, that's stated in the API response and the UI, not just a commit message.

## Self-hosting

1. Create a D1 database: `npx wrangler d1 create tapeout-monitor`, then put the returned `database_id` into `wrangler.toml`.
2. Apply the base schema: `npx wrangler d1 execute tapeout-monitor --remote --file=schema.sql` (and `schema_events.sql`, `schema_workbench.sql` — see `DEPLOYMENT_NOTES.md` for why these are separate from the domain modules' own auto-created tables).
3. Deploy: `npx wrangler deploy`.
4. Optional: a dedicated BSC RPC provider as the `BSC_LOGS_RPC_URL` Worker secret enables the Circuit Market sale scanner and any future on-chain log-based features; without it, those domains stay explicitly `not_configured` rather than silently degrading.

The cron triggers do the rest. Nothing here needs GitHub Actions, a scheduled task runner, or a browser session.

## Contributing

Issues and PRs are welcome — new community tools/resources for the curated directory, new locales, bug reports, or new data domains. If you're adding a community tool or update, please review it yourself first (open the site, check wallet/signing behavior) rather than just forwarding a link; that review is part of what makes the directory worth trusting.

## License

MIT — see `LICENSE`.
