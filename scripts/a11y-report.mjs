// Prints axe accessibility violations for the given pages at desktop and mobile widths.
// Usage: node scripts/a11y-report.mjs [baseUrl] [path ...]
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const base = process.argv[2] ?? 'http://127.0.0.1:4321';
const paths = process.argv.slice(3).length ? process.argv.slice(3) : ['/'];
const browser = await chromium.launch();
for (const scheme of ['light', 'dark']) {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    for (const path of paths) {
      const context = await browser.newContext({ viewport, colorScheme: scheme, reducedMotion: 'reduce' });
      const page = await context.newPage();
      await page.goto(base + path);
      await page.evaluate(() => document.querySelectorAll('[data-reveal]').forEach((e) => e.classList.add('is-visible')));
      const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
      for (const v of result.violations) {
        const nodes = v.nodes.slice(0, 4).map((n) => `${n.target.join(' ')} :: ${(n.failureSummary ?? '').split('\n')[1]?.trim()}`);
        console.log(`${scheme} ${viewport.width} ${path} [${v.impact}] ${v.id}\n   ${nodes.join('\n   ')}`);
      }
      await context.close();
    }
  }
}
await browser.close();
