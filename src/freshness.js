// Cron remains the normal collection path. These bounded, per-isolate single-flight
// checks only recover a domain when its most recent scheduled check is materially old.
export const freshnessFlights = new Map();
export function minutesSince(timestamp) {
  const parsed = Date.parse(timestamp || "");
  return Number.isFinite(parsed) ? Math.max(0, (Date.now() - parsed) / 60000) : Infinity;
}
export async function inFreshnessFlight(key, task) {
  if (freshnessFlights.has(key)) return freshnessFlights.get(key);
  const promise = Promise.resolve().then(task).finally(() => freshnessFlights.delete(key));
  freshnessFlights.set(key, promise);
  return promise;
}
export function needsFreshnessRecovery(run, maxAgeMinutes, errorBackoffMinutes = 2) {
  const age = minutesSince(run?.attempted_at);
  return !run || (run.status === "error" ? age >= errorBackoffMinutes : age >= maxAgeMinutes);
}
export async function ensureScheduledDomainFresh({ key, env, prepare, latestRun, sync, maxAgeMinutes, errorBackoffMinutes = 2 }) {
  await prepare();
  const run = await latestRun();
  if (!needsFreshnessRecovery(run, maxAgeMinutes, errorBackoffMinutes)) return { triggered: false, run };
  return inFreshnessFlight(key, async () => {
    const latest = await latestRun();
    if (!needsFreshnessRecovery(latest, maxAgeMinutes, errorBackoffMinutes)) return { triggered: false, run: latest };
    const result = await sync(env);
    return { triggered: true, run: result };
  });
}
