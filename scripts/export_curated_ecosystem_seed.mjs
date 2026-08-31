import { ECOSYSTEM_CATALOG_VERSION, ECOSYSTEM_REVIEWED_AT, CURATED_UPDATES, CURATED_TOOLS } from '../src/curated_ecosystem_seed.js';
process.stdout.write(JSON.stringify({ version: ECOSYSTEM_CATALOG_VERSION, reviewed_at: ECOSYSTEM_REVIEWED_AT, updates: CURATED_UPDATES, tools: CURATED_TOOLS }));
