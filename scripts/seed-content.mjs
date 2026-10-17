// Copies the seed content in src/data into the content_entries table as published items.
// Existing items are never overwritten (INSERT OR IGNORE), so it is safe to run again.
// Usage: node scripts/seed-content.mjs --local | --remote
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const target = process.argv.includes('--remote') ? '--remote' : '--local';
const load = async (file) => import(new URL(`../src/data/${file}`, import.meta.url).href);

const { settings } = await load('settings.ts');
const { home } = await load('home.ts');
const { about, team } = await load('about.ts');
const { services } = await load('services.ts');
const { engagementModels } = await load('engagement.ts');
const { caseStudies, testimonials } = await load('work.ts');

const slugify = (v) => v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const rows = [
  ['settings', 'main', 0, settings],
  ['home', 'main', 0, home],
  ['about', 'main', 0, about],
  ...services.map((s, i) => ['services', s.slug, i, s]),
  ...engagementModels.map((m, i) => ['engagement', slugify(m.name), i, m]),
  ...caseStudies.map((c, i) => ['work', c.slug, i, c]),
  ...team.map((t, i) => ['team', t.slug, i, t]),
  ...testimonials.map((t, i) => ['testimonials', slugify(`${t.name}-${t.company}`), i, t]),
];

const quote = (v) => `'${String(v).replace(/'/g, "''")}'`;
const now = new Date().toISOString();
const sql = rows
  .map(([collection, key, position, data]) => {
    const json = quote(JSON.stringify(data));
    return `INSERT OR IGNORE INTO content_entries (collection, key, position, draft_data, published_data, review_status, published_at, updated_at) VALUES (${quote(collection)}, ${quote(key)}, ${position}, ${json}, ${json}, 'clean', ${quote(now)}, ${quote(now)});`;
  })
  .join('\n');

const file = join(mkdtempSync(join(tmpdir(), 'vyom-seed-')), 'seed.sql');
writeFileSync(file, sql);
execFileSync('npx', ['wrangler', 'd1', 'execute', 'vyom-website', target, '--file', file, '--yes'], { stdio: 'inherit', shell: process.platform === 'win32' });
console.log(`Seeded ${rows.length} content item(s) (${target}). Existing items were left unchanged.`);
