// Performance budgets (SOW §9, NFR-001..009, TC-022) against a running preview.
// 1. Byte budgets: every JS/CSS/font/image the page loads, gzip-compressed (as Cloudflare serves it).
// 2. Lighthouse mobile lab run: LCP, CLS, TBT and the performance score.
// Usage: node scripts/perf-budget.mjs [baseUrl]   (exits 1 if a hard budget is broken)
import { gzipSync } from 'node:zlib';
import { chromium } from '@playwright/test';
import lighthouse from 'lighthouse';
import { existsSync } from 'node:fs';
import * as chromeLauncher from 'chrome-launcher';

const base = process.argv[2] ?? 'http://127.0.0.1:4321';
const pages = ['/', '/services/website-development', '/work/carepoint-clinic-booking', '/about', '/quote'];
const KB = 1024;
const BUDGET = { js: 50 * KB, css: 30 * KB, font: 100 * KB, total: 600 * KB, lcpMs: 2500, cls: 0.1, score: 90 };
// Third-party scripts that only load on form pages and are not ours to shrink.
const EXEMPT = ['challenges.cloudflare.com'];

const kind = (type, url) => {
  if (type === 'script') return 'js';
  if (type === 'stylesheet') return 'css';
  if (type === 'font' || /\.woff2?($|\?)/.test(url)) return 'font';
  if (type === 'image') return 'image';
  if (type === 'document') return 'html';
  return 'other';
};

let failures = 0;
const fail = (msg) => {
  failures++;
  console.log(`  FAIL ${msg}`);
};

// --- 1. Byte budgets --------------------------------------------------------
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
console.log('Byte budgets (gzip):');
for (const path of pages) {
  const page = await context.newPage();
  const seen = new Map();
  page.on('response', async (response) => {
    const url = response.url();
    if (seen.has(url) || EXEMPT.some((h) => url.includes(h)) || response.status() >= 300) return;
    seen.set(url, null);
    try {
      const body = await response.body();
      seen.set(url, { kind: kind(response.request().resourceType(), url), bytes: gzipSync(body).length });
    } catch {
      seen.delete(url);
    }
  });
  await page.goto(base + path, { waitUntil: 'load' });
  await page.waitForTimeout(1000);
  const totals = { js: 0, css: 0, font: 0, image: 0, html: 0, other: 0 };
  for (const entry of seen.values()) if (entry) totals[entry.kind] += entry.bytes;
  const total = Object.values(totals).reduce((a, b) => a + b, 0);
  const fmt = (n) => `${(n / KB).toFixed(1)} KB`;
  console.log(`${path}\n  js ${fmt(totals.js)} · css ${fmt(totals.css)} · fonts ${fmt(totals.font)} · images ${fmt(totals.image)} · total ${fmt(total)}`);
  if (totals.js > BUDGET.js) fail(`JavaScript ${fmt(totals.js)} > ${fmt(BUDGET.js)}`);
  if (totals.css > BUDGET.css) fail(`CSS ${fmt(totals.css)} > ${fmt(BUDGET.css)}`);
  if (totals.font > BUDGET.font) fail(`fonts ${fmt(totals.font)} > ${fmt(BUDGET.font)}`);
  if (total > BUDGET.total) fail(`page weight ${fmt(total)} > ${fmt(BUDGET.total)}`);
  await page.close();
}
await browser.close();

// --- 2. Lighthouse mobile lab run -------------------------------------------
console.log('\nLighthouse (mobile, simulated slow 4G):');
// Lighthouse needs a stable Chrome; Playwright's newest Chromium can break its tracing (NO_NAVSTART).
const installedChrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable'].find(existsSync);
const chromePath = process.env.CHROME_PATH ?? installedChrome ?? chromium.executablePath();
const chrome = await chromeLauncher.launch({ chromePath, chromeFlags: ['--headless=new', '--no-sandbox'] });
try {
  for (const path of pages) {
    const result = await lighthouse(base + path, { port: chrome.port, onlyCategories: ['performance', 'accessibility', 'seo', 'best-practices'], logLevel: 'error' });
    if (result.lhr.runtimeError) {
      fail(`${path}: Lighthouse could not measure (${result.lhr.runtimeError.code})`);
      continue;
    }
    const { audits, categories } = result.lhr;
    const score = Math.round(categories.performance.score * 100);
    const lcp = audits['largest-contentful-paint'].numericValue;
    const cls = audits['cumulative-layout-shift'].numericValue;
    const tbt = audits['total-blocking-time'].numericValue;
    const other = ['accessibility', 'seo', 'best-practices'].map((c) => `${c} ${Math.round(categories[c].score * 100)}`).join(' · ');
    console.log(`${path}\n  performance ${score} · LCP ${(lcp / 1000).toFixed(2)} s · CLS ${cls.toFixed(3)} · TBT ${Math.round(tbt)} ms · ${other}`);
    if (lcp > BUDGET.lcpMs) fail(`LCP ${(lcp / 1000).toFixed(2)} s > 2.5 s`);
    if (cls > BUDGET.cls) fail(`CLS ${cls.toFixed(3)} > 0.1`);
    if (score < BUDGET.score) console.log(`  NOTE performance ${score} is below the goal of ${BUDGET.score} (a goal, not a guarantee)`);
  }
} finally {
  await chrome.kill();
}

console.log(failures ? `\n${failures} budget(s) broken` : '\nAll budgets met');
process.exit(failures ? 1 : 0);
