-- Tapeout Public Monitor: evidence-backed event stream

CREATE TABLE IF NOT EXISTS public_events (
  id TEXT PRIMARY KEY,
  observed_at TEXT NOT NULL,
  event_type TEXT NOT NULL,
  trust TEXT NOT NULL,
  processor_address TEXT,
  creator_address TEXT,
  name TEXT,
  metric_name TEXT,
  metric_value TEXT,
  detail TEXT NOT NULL,
  evidence_url TEXT NOT NULL,
  raw_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS public_events_observed_idx
  ON public_events(observed_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS public_events_type_idx
  ON public_events(event_type, observed_at DESC);

CREATE INDEX IF NOT EXISTS public_events_processor_idx
  ON public_events(processor_address, observed_at DESC);
