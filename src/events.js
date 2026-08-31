import { OFFICIAL_PROCESSOR_URL } from "./constants.js";

let eventSchemaReady;

export async function ensureEventSchema(env) {
  if (!eventSchemaReady) {
    eventSchemaReady = env.DB.batch([
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS public_events (
        id TEXT PRIMARY KEY, observed_at TEXT NOT NULL, event_type TEXT NOT NULL, trust TEXT NOT NULL,
        processor_address TEXT, creator_address TEXT, name TEXT, metric_name TEXT, metric_value TEXT,
        detail TEXT NOT NULL, evidence_url TEXT NOT NULL, raw_json TEXT NOT NULL
      )`),
      env.DB.prepare("CREATE INDEX IF NOT EXISTS public_events_observed_idx ON public_events(observed_at DESC, id DESC)"),
      env.DB.prepare("CREATE INDEX IF NOT EXISTS public_events_type_idx ON public_events(event_type, observed_at DESC)"),
      env.DB.prepare("CREATE INDEX IF NOT EXISTS public_events_processor_idx ON public_events(processor_address, observed_at DESC)"),
    ]);
  }
  return eventSchemaReady;
}

export function eventStatement(env, { observedAt, eventType, row, trust = "protocol_observed", metricName = "", metricValue = "", detail, evidenceUrl = OFFICIAL_PROCESSOR_URL(row.address), raw = {}, id = `${eventType}:${row.address}:${observedAt}` }) {
  return env.DB.prepare(`INSERT OR IGNORE INTO public_events
    (id, observed_at, event_type, trust, processor_address, creator_address, name, metric_name, metric_value, detail, evidence_url, raw_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, observedAt, eventType, trust, row.address, row.creatorAddress || null, row.name, metricName || null, metricValue || null, detail, evidenceUrl, JSON.stringify(raw));
}
