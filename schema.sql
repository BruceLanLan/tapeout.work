CREATE TABLE IF NOT EXISTS processors_current (
  address TEXT PRIMARY KEY,
  name TEXT,
  supply_cap TEXT,
  minted TEXT,
  mint_price TEXT,
  circuit_count INTEGER NOT NULL DEFAULT 0,
  raw_json TEXT NOT NULL,
  source_updated_at TEXT,
  observed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  observed_at TEXT NOT NULL,
  processor_count INTEGER NOT NULL,
  minted_total TEXT NOT NULL,
  circuit_total INTEGER NOT NULL,
  source_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  observed_at TEXT NOT NULL,
  change_type TEXT NOT NULL,
  address TEXT,
  name TEXT,
  detail TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS changes_observed_at_idx ON changes(observed_at DESC);
CREATE INDEX IF NOT EXISTS processors_observed_at_idx ON processors_current(observed_at DESC);
