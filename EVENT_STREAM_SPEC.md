# Tapeout Event Stream and API Specification

## Event principle

The public feed is an **evidence ledger**, not an alpha feed. Every event must identify its source, observation time, entity addresses, and at least one evidence URL. The system may rank events by a user-defined rule, but it must not label a project, wallet, or community as “officially verified” without a public protocol source or a separately documented attestation.

## Launchable event classes

| Class | Trigger | Evidence | Trust label |
| --- | --- | --- | --- |
| `processor.created` | A valid public Processor appears between registry snapshots | Tapeout official `processors.json` and official `#p/{address}` page | `protocol_observed` |
| `processor.mint_delta` | Observed minted amount increases by a configurable threshold between address snapshots | Current and prior D1 address snapshots, official page deep link | `protocol_observed` |
| `processor.circuit_delta` | Observed circuit count increases by a configurable threshold | Current and prior D1 address snapshots, official page deep link | `protocol_observed` |
| `processor.completed` | Mint completion first reaches or exceeds 100% | D1 snapshots and official page deep link | `protocol_observed` |
| `registry.changed` | Supply, Mint amount, or circuit count changes | D1 current and prior snapshots | `protocol_observed` |

## Reserved classes requiring another public source

| Class | Why it is not auto-emitted yet | Safe future condition |
| --- | --- | --- |
| `attestation.official` | The current registry has no stable official-attestation field or signed registry endpoint | A public Tapeout attestation registry, official signed message, or named official wallet list is available. |
| `attestation.community` | Community recognition needs a public and reviewable issuer/criteria | A disclosed community registry with issuer, evidence link and revocation state is available. |
| `creator.protocol_action` | Creator address is public, but generic wallet activity is noisy and should not be treated as a project action | Decoded interaction with a documented Tapeout protocol contract, carrying a transaction hash. |
| `nft.large_sale` | The current public registry does not expose Circuit NFT marketplace sale price or venue | A public marketplace/contract source exposes a verifiable sale and price. |

## Shared event envelope

```json
{
  "id": "processor.mint_delta:0x...:2026-08-19T08:15:00.000Z",
  "type": "processor.mint_delta",
  "observed_at": "2026-08-19T08:15:00.000Z",
  "trust": "protocol_observed",
  "entity": {"processor": "0x...", "creator": "0x..."},
  "metrics": {"mint_delta": "100000", "completion_bps": 4250},
  "evidence": [{"kind": "official_processor_page", "url": "https://tapeout.net/#p/0x..."}],
  "summary": "Observed mint increase between public registry snapshots."
}
```

## Unified public API surface

| Endpoint | Audience | Purpose |
| --- | --- | --- |
| `/api/v1/catalog` | Humans, Bot, Agent | Machine-readable list of endpoints, schemas, cadence and source boundary. |
| `/api/v1/events` | Humans, Bot, Agent | Cursor-paginated evidence ledger with type, trust and entity filters. |
| `/api/v1/processors` | Humans, Bot, Agent | Full public Processor registry with filters, pagination and official deep link. |
| `/api/v1/creators` | Humans, Bot, Agent | Public creator concentration aggregates from the registry. |
| `/api/v1/export.csv` | Humans, Bot, Agent | Snapshot-stamped export of the current filtered public Processor view. |
| `/api/v1/strategies/schema` | UI, Agent | Supported non-executing rule fields and thresholds. |

## User strategy scope

Strategies are **client-side research rules** and never execute wallet, transaction, or trading actions. A strategy contains allowed event types, minimum Mint/Circuit delta, completion bands, supply bands, creator or Processor allowlists, and trust levels. It is serialized in the URL fragment or browser storage; sharing it never transmits a private wallet address to the service.
