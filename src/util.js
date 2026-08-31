export async function sha256(text) {
  const bytes = new TextEncoder().encode(String(text).trim().toLowerCase());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, "0")).join("");
}

export function pick(raw, keys, fallback = "") {
  for (const key of keys) if (raw?.[key] !== undefined && raw?.[key] !== null) return String(raw[key]);
  return fallback;
}

export function toBigInt(value) {
  try { return BigInt(String(value || "0")); }
  catch { return 0n; }
}

export function comparison(left, right) {
  const a = toBigInt(left), b = toBigInt(right);
  return a > b ? 1 : a < b ? -1 : 0;
}

export function completionBps(minted, supplyCap) {
  const supply = toBigInt(supplyCap);
  return supply > 0n ? Number((toBigInt(minted) * 10000n) / supply) : null;
}

export function completionBand(bps) {
  if (bps === null || bps === 0) return "0%";
  if (bps < 100) return "0–1%";
  if (bps < 2500) return "1–25%";
  if (bps < 7500) return "25–75%";
  if (bps < 10000) return "75–99%";
  return "100%+";
}

export function circuitBand(circuitCount) {
  if (!circuitCount) return "0";
  if (circuitCount === 1) return "1";
  if (circuitCount < 5) return "2–4";
  if (circuitCount < 10) return "5–9";
  return "10+";
}

// Declared-supply bands follow the observed public Registry distribution
// (2026-08-27: half the sample sits in 10K–100K, with meaningful tails at
// both ends). Keys are locale-neutral literals rendered as-is by the mixer.
export function supplyBand(supplyCap) {
  const supply = toBigInt(supplyCap);
  if (supply <= 0n) return "0";
  if (supply <= 10_000n) return "≤10K";
  if (supply <= 100_000n) return "10K–100K";
  if (supply <= 1_000_000n) return "100K–1M";
  if (supply <= 10_000_000n) return "1M–10M";
  return ">10M";
}

export function json(value, status = 200, headers = {}) {
  // API payloads contain live health and last-success state. Static assets remain
  // versioned separately, but dynamic JSON must never preserve a stale edge value.
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });
}

export function hexToNumber(value) { return Number.parseInt(String(value || "0x0"), 16) || 0; }
export function hexToBigInt(value) { try { return BigInt(value || "0x0"); } catch { return 0n; } }
export function hexWord(value, index) { return hexToBigInt(`0x${String(value || "").replace(/^0x/, "").slice(index * 64, (index + 1) * 64) || "0"}`); }
export function hexAddress(value, index) { const word = String(value || "").replace(/^0x/, "").slice(index * 64, (index + 1) * 64); return word.length === 64 ? `0x${word.slice(-40).toLowerCase()}` : ""; }

export async function fetchJsonWithTimeout(url, init = {}, timeoutMs = 8000) {
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, cf: { cacheTtl: 0, cacheEverything: false } });
    if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
    return await response.json();
  } finally { clearTimeout(timeout); }
}

export async function fetchTextWithTimeout(url, init = {}, timeoutMs = 8000) {
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, cf: { cacheTtl: 0, cacheEverything: false } });
    if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
    return await response.text();
  } finally { clearTimeout(timeout); }
}

export function topicAddress(value) { const clean = String(value || "").replace(/^0x/, ""); return clean.length >= 40 ? `0x${clean.slice(-40).toLowerCase()}` : ""; }
export function dataWord(value, index) { const clean = String(value || "").replace(/^0x/, ""); return `0x${clean.slice(index * 64, (index + 1) * 64) || "0"}`; }

export function formatBnb(wei) { const value = toBigInt(wei), whole = value / 1000000000000000000n, fraction = String(value % 1000000000000000000n).padStart(18, "0").slice(0, 4); return `${whole}.${fraction}`; }

export function csvEscape(value) {
  const string = String(value ?? "");
  return /[",\n]/.test(string) ? `"${string.replaceAll('"', '""')}"` : string;
}

// The public Registry lists processors but does not provide an independently
// verifiable official/certified/community attestation for individual projects.
// Do not turn a project name, its creator, or a website-side display convention
// into a governance tier. Official scope is limited to the separate, explicitly
// sourced three-project address-observation module.
export function websiteLabel() {
  return null;
}
