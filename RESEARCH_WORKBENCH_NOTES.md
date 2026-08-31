# Research Workbench Notes

## Official project deep link

Tapeout Processor detail pages use a hash route keyed by the Processor contract address:

```text
https://tapeout.net/#p/{processor_address}
```

The public registry calls this route through its “View details” links. The detail surface exposes the Processor address, creator address, transistor contract, declared supply, minted amount, circuit count, and the official mint/circuit interaction surface. The workbench will generate this link from the public Processor address rather than relying on a name-based route.

## Public source fields

The current `processors.json` feed returns a `cpus` array and, for each valid Processor, includes `address`, `transistors`, `name`, `creator`, `minted`, `supplyCap`, and `circuitCount`. It does not include a stable creation timestamp or mint price in the observed current payload.

## Product implications

| Requirement | Implementation boundary |
| --- | --- |
| Official page jump | Deterministic `#p/{address}` deep link; open in a new tab with the address visible to the user. |
| Full registry | Cursor/offset API and incremental client pagination; no arbitrary 100-row presentation cap. |
| Creator dimension | Persist the public creator address from the source feed and expose address-prefix search/grouping. |
| Mint price or creation time | Do not fabricate. Treat as unavailable until a public authoritative source is added or the data is derived from verifiable chain events. |
| Historical change | Record address-level snapshots in D1 from future hourly runs; compute deltas only from recorded observations. |

The official source has a larger raw count than the public monitor’s valid public registry because the monitor only includes rows with a valid Processor address after server-side privacy and structural checks. The workbench must keep this boundary intact.
