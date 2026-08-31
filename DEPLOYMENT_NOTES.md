# Cloudflare deployment notes

## 2026-08-19 first Git build

The initial Cloudflare Workers build reached `npx wrangler deploy`, uploaded the three public assets, and then failed with code `10021`: the `DB` D1 binding did not contain a valid `database_id`.

The build log showed that the checked-out repository configuration still used `REPLACE_WITH_CLOUDFLARE_D1_DATABASE_ID`. The next deployment commit must update the repository's `wrangler.toml` to use the already-created `tapeout-monitor` database ID, while preserving the binding name `DB` and the hourly cron schedule.

## 2026-08-19 deployed and verified

The repository is now connected to Cloudflare Workers Builds. The `main` branch deploys `npx wrangler deploy` and uses the `DB` binding for `tapeout-monitor`.

The Worker has an hourly cron trigger at minute 15 UTC. The initial verified public snapshot was stored at `2026-08-19T07:22:18.425Z`, with 565 public processor records and 3,309 observed circuits. The public source returned 566 records at that time; one protected private record was excluded by the server-side SHA-256 filter.

The original public Worker was available under the account's initial default workers.dev subdomain, since migrated away (see the entry below). Public UI rendering escapes externally supplied Processor names and change text, while raw API values remain source-attributed observations.

## 2026-08-19 intelligence workbench and public event API

The account Workers subdomain was migrated to the neutral `tapeout-labs.workers.dev` namespace. The live public entrypoint is now `https://tapeout-public-monitor.tapeout-labs.workers.dev/`.

The current Worker stores public Creator and transistor-contract fields, address-level snapshots, and evidence-backed public events. It supports the full public Processor registry through server-side pagination, deterministic official Tapeout detail links, current Creator aggregates, current-view CSV exports, and client-side non-executing research strategies.

All public endpoints are discoverable under `/api/v1/catalog`; `/api/v1/openapi.json` provides a lightweight OpenAPI descriptor. The event stream at `/api/v1/events` currently emits only `protocol_observed` events derived from public registry changes: Processor creation, Mint deltas, Circuit deltas, and first observed supply completion. It deliberately does not infer official/community endorsements, creator wallet actions, marketplace sales, or price metrics without a public verifiable source.

At the latest validated refresh (`2026-08-19T08:36:27.931Z`), the public registry contained 568 structurally valid, privacy-filtered Processor rows and 3,512 observed circuits. API validation covered the catalog, OpenAPI description, final pagination page, evidence events, non-executing strategy schema, CSV header, and absence of protected-record data in the public catalog.

## 2026-08-28 custom domain

The user registered `tapeout.work` and added it to the same Cloudflare account as a zone (nameservers already active). Attached it to the Worker as a Custom Domain route via `wrangler.toml` (`[[routes]] pattern = "tapeout.work", custom_domain = true`) and `wrangler deploy`; confirmed in the deploy output (`tapeout.work (custom domain)`) and via public DNS (resolves to real Cloudflare edge IPs). `https://tapeout-public-monitor.tapeout-labs.workers.dev/` remains attached and serves identical content — no redirect was configured, both are live. `tapeout.work` is now the documented primary entrypoint (API.md updated); live reachability from this session's sandboxed network could not be independently confirmed (the sandbox's own outbound network policy does not yet recognize the brand-new domain, confirmed by testing a known-working domain over the same path) and should be checked directly by the user.
