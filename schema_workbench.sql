-- Tapeout Public Monitor: workbench upgrade
-- Execute once against the existing tapeout-monitor D1 database.

ALTER TABLE processors_current ADD COLUMN creator_address TEXT;
ALTER TABLE processors_current ADD COLUMN transistor_address TEXT;

CREATE TABLE IF NOT EXISTS processor_snapshots (
  observed_at TEXT NOT NULL,
  address TEXT NOT NULL,
  minted TEXT NOT NULL,
  supply_cap TEXT NOT NULL,
  circuit_count INTEGER NOT NULL,
  PRIMARY KEY (observed_at, address)
);

CREATE INDEX IF NOT EXISTS processor_snapshots_address_observed_idx
  ON processor_snapshots(address, observed_at DESC);

CREATE INDEX IF NOT EXISTS processors_current_creator_idx
  ON processors_current(creator_address);
