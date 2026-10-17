// Runs before every build. Writes the PUBLISHED admin content to src/data/generated/content.json,
// which the site then uses instead of the seed files. Drafts are never read (FR-160).
// CONTENT_SOURCE=local | remote selects the database; when unset, the seed files are used.
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';

const source = process.env.CONTENT_SOURCE;
const outDir = new URL('../src/data/generated/', import.meta.url);
const outFile = new URL('content.json', outDir);

if (source !== 'local' && source !== 'remote') {
  rmSync(outFile, { force: true });
  console.log('pull-content: CONTENT_SOURCE not set; using seed content.');
  process.exit(0);
}

const query = 'SELECT collection, key, position, published_data FROM content_entries ORDER BY collection, position, id';
const output = execFileSync('npx', ['wrangler', 'd1', 'execute', 'vyom-website', `--${source}`, '--json', '--command', JSON.stringify(query)], {
  encoding: 'utf8',
  shell: process.platform === 'win32',
});
const results = JSON.parse(output)[0]?.results;
if (!Array.isArray(results)) throw new Error('pull-content: unexpected response from the database');

// Every collection that exists in the database is written, even if nothing in it is published,
// so taking the last item offline really removes it from the site.
const content = {};
for (const row of results) {
  content[row.collection] ??= [];
  if (row.published_data) content[row.collection].push(JSON.parse(row.published_data));
}
mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, JSON.stringify(content, null, 2));
console.log(`pull-content: wrote ${Object.values(content).flat().length} published item(s) from ${source} D1.`);
