// Captures full-page screenshots of key pages at mobile and desktop widths, light and dark.
// Usage: node scripts/screenshots.mjs [baseUrl] [outDir]
import { chromium } from '@playwright/test';

const base = process.argv[2] ?? 'http://127.0.0.1:4321';
const outDir = process.argv[3] ?? 'screenshots';
const pages = (process.env.PAGES ?? '/,/services,/services/website-development').split(',');
const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 900 },
];

const browser = await chromium.launch();
for (const scheme of ['light', 'dark']) {
  for (const vp of viewports) {
    const context = await browser.newContext({ viewport: vp, colorScheme: scheme, reducedMotion: 'reduce' });
    const page = await context.newPage();
    for (const path of pages) {
      await page.goto(base + path, { waitUntil: 'load' });
      await page.waitForTimeout(600);
      // Reveal everything so the full-page capture shows final states.
      await page.evaluate(() => document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-visible')));
      const file = `${outDir}/${scheme}-${vp.name}${path === '/' ? '-home' : path.replaceAll('/', '-')}.png`;
      await page.screenshot({ path: file, fullPage: true });
      await page.screenshot({ path: file.replace('.png', '-top.png') });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      console.log(file, overflow > 0 ? `HORIZONTAL OVERFLOW ${overflow}px` : 'ok');
    }
    await context.close();
  }
}
await browser.close();
