// Derives a public changelog of the catalogue from this repository's own git
// history and writes it as a served asset.
//
// The site's editorial promise is that every description was true when a human
// reviewed it on a stated date. That promise is only worth something if the dates
// can be checked, and until now they could not: a reviewed_at could move without
// anything recording that it had. The history is already public in the repo — this
// only makes it readable from the site, so a reader can see when an entry was last
// vouched for, and what the commit said it changed.
//
// Run before deploying: node scripts/build_changelog.mjs
// It is a build step rather than a runtime endpoint because a Worker has no git.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const WATCHED = [
  "src/curated_ecosystem_seed.js",
  "src/learning_resources_seed.js",
  "public/i18n/ecosystem",
  "public/i18n/learning",
];
const LIMIT = 120;

const git = args => execFileSync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });

const RECORD = "";
const FIELD = "";
const raw = git([
  "log", `-${LIMIT}`, `--format=${RECORD}%H${FIELD}%aI${FIELD}%s`, "--name-only", "--", ...WATCHED,
]);

const entries = raw.split(RECORD).slice(1).map(block => {
  const [header, ...rest] = block.split("\n");
  const [sha, date, subject] = header.split(FIELD);
  const files = rest.map(line => line.trim()).filter(Boolean);
  const scope = new Set();
  for (const file of files) {
    if (file === "src/curated_ecosystem_seed.js") scope.add("tools");
    else if (file === "src/learning_resources_seed.js") scope.add("learning");
    else if (file.startsWith("public/i18n/ecosystem/")) scope.add("tool-translations");
    else if (file.startsWith("public/i18n/learning/")) scope.add("learning-translations");
  }
  return { sha: sha.slice(0, 10), date, subject, scope: [...scope].sort(), file_count: files.length };
});

const payload = {
  generated_at: new Date().toISOString(),
  source: "this repository's git history, limited to the catalogue seed and locale files",
  commit_count: entries.length,
  entries,
  boundary:
    "A record of when the catalogue changed and what the commit said it changed — not a diff of the entries themselves, and not a claim that every listed change was editorially significant. Commit subjects are written by whoever made the change. Generated at build time from public git history; a change made without a commit could not appear here.",
};

writeFileSync(new URL("../public/changelog.json", import.meta.url), JSON.stringify(payload, null, 2) + "\n");
console.log(`changelog.json: ${entries.length} commits, newest ${entries[0]?.date ?? "none"}`);
