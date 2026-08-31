import { readFile, mkdir, writeFile } from 'node:fs/promises';

const source = await readFile('public/app.js', 'utf8');
const start = source.indexOf('const text = {');
const end = source.indexOf('\n\nconst $ = selector =>', start);
if (start < 0 || end < 0) throw new Error('Unable to find the UI text dictionary boundary');
const block = source.slice(start, end);
const runner = `${block}\nconsole.log(JSON.stringify(text));`;
await mkdir('public/i18n', { recursive: true });
const temp = '/tmp/tapeout-ui-dictionary-source.mjs';
await writeFile(temp, runner);
const { spawnSync } = await import('node:child_process');
const result = spawnSync(process.execPath, [temp], { encoding: 'utf8' });
if (result.status !== 0) throw new Error(result.stderr || 'Dictionary evaluation failed');
const text = JSON.parse(result.stdout);
for (const locale of ['en', 'zh']) {
  await writeFile(`public/i18n/${locale}.json`, `${JSON.stringify(text[locale], null, 2)}\n`);
}
console.log(JSON.stringify({ en_keys: Object.keys(text.en).length, zh_keys: Object.keys(text.zh).length, output: 'public/i18n/en.json, public/i18n/zh.json' }));
