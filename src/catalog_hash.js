// Per-entry source hash: the exact text a translation was made from.
//
// A version stamp on a whole locale file can say "this file is behind the
// catalogue" but not which entries; so a rewrite of one summary either forced a
// full retranslation or was quietly ignored. Hashing the translatable fields of
// each entry lets the build translate exactly what changed, and lets the site's
// self-audit report exactly which entries are serving older wording. Shared by
// the Worker (self_audit.js) and the build scripts so both agree by construction.
export const TRANSLATABLE_FIELDS = Object.freeze({
  tools: ["title_en", "summary_en", "safety_en", "title_zh", "summary_zh", "safety_zh"],
  updates: ["title_en", "summary_en", "source_note_en", "title_zh", "summary_zh", "source_note_zh"],
  learning: ["title_en", "summary_en", "title_zh", "summary_zh"],
});

// Locale-file field -> canonical English field it is a translation of.
export const LOCALE_FIELD_SOURCES = Object.freeze({
  tools: { title: "title_en", summary: "summary_en", safety: "safety_en" },
  updates: { title: "title_en", summary: "summary_en", source_note: "source_note_en" },
  learning: { title: "title_en", summary: "summary_en" },
});

export async function entrySourceHash(kind, entry) {
  const fields = TRANSLATABLE_FIELDS[kind];
  if (!fields) throw new Error(`unknown catalogue kind: ${kind}`);
  const material = fields.map(field => `${field}=${entry[field] ?? ""}`).join("\n");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(material));
  return [...new Uint8Array(digest)].slice(0, 8).map(b => b.toString(16).padStart(2, "0")).join("");
}
