# Research Workbench Data Contract

## Current-source dimensions

| Dimension | Source | Status | Use in workbench |
| --- | --- | --- | --- |
| Processor address | Tapeout public registry | Direct | Official deep link, deterministic identifier, search |
| Name | Tapeout public registry | Direct, untrusted text | Search and human-readable registry label |
| Creator address | Tapeout public registry | Direct | Creator grouping, concentration and address filtering |
| Transistor contract | Tapeout public registry | Direct | Research reference and contract-level provenance |
| Declared supply | Tapeout public registry | Direct | Supply bands, completion denominator |
| Minted amount | Tapeout public registry | Direct | Completion, activity filters and snapshot deltas |
| Circuit count | Tapeout public registry | Direct | Density, growth and leaderboard views |
| Mint price | Current public registry payload | Not currently present | Display as unavailable; never infer or fabricate |
| Creation time | Current public registry payload | Not currently present | Display as unavailable until derived from a public chain source |

## New D1 tables and API surfaces

| Surface | Purpose |
| --- | --- |
| `processors_current.creator_address` / `transistor_address` | Preserve the additional public identity fields from every hourly refresh. |
| `processor_snapshots` | Store address-level observed Mint, supply and Circuit values for future time-series deltas. |
| `/api/registry` | Paginated, filterable public registry with total-count metadata and official Tapeout deep links. |
| `/api/creators` | Current creator-level processor, circuit and supply concentration aggregates. |
| `/api/export.csv` | Snapshot-stamped CSV from current public records after privacy filtering. |

## Official deep-link contract

The official detail URL is generated only from a public processor address:

```text
https://tapeout.net/#p/{address}
```

This keeps a workbench row traceable to Tapeout’s own mint and circuit interface without presenting third-party market data as protocol fact.

## Privacy and numeric rules

All new endpoints use the same D1 public registry populated after the server-side private-record filter. Large integer quantities remain strings at the API edge. Derived ratios use integer arithmetic where possible and no UI feature may expose a filtered address through deep links, exports, URL state, or client-side payloads.
