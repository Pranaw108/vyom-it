import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const pages = [
  '/',
  '/services',
  '/services/website-development',
  '/services/digital-marketing-seo',
  '/work',
  '/work/carepoint-clinic-booking',
  '/about',
  '/contact',
  '/quote',
  '/privacy',
  '/terms',
  '/cookies',
];

// Scans run with motion settled; mid-fade text would otherwise be measured at partial opacity.
test.describe('accessibility', () => {
  test.use({ reducedMotion: 'reduce' });
  for (const path of pages) {
    test(`${path} has no serious accessibility violations and no sideways scroll (TC-023)`, async ({ page }) => {
      await page.goto(path);
      await page.evaluate(() => document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-visible')));
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
      const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')}`)).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
      await expect(page.locator('h1')).toHaveCount(1);
    });
  }
});

test('unknown pages return a real 404 (TC-019)', async ({ request }) => {
  const response = await request.get('/this-page-does-not-exist');
  expect(response.status()).toBe(404);
});

test('mobile menu traps focus and closes with Escape (TC-017)', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile only');
  await page.goto('/');
  const button = page.getByRole('button', { name: 'Open menu' });
  await button.click();
  await expect(page.getByRole('dialog', { name: 'Menu' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Menu' })).toBeHidden();
  await expect(button).toBeFocused();
});

test('work filter narrows projects and updates the URL', async ({ page }) => {
  await page.goto('/work');
  await page.getByRole('button', { name: 'Mobile apps' }).click();
  await expect(page).toHaveURL(/service=mobile-app-development/);
  await expect(page.locator('[data-services]:visible')).toHaveCount(1);
});

test('concept projects are always labelled (TC-014)', async ({ page }) => {
  await page.goto('/work');
  const cards = page.locator('[data-services]');
  const count = await cards.count();
  for (let i = 0; i < count; i++) await expect(cards.nth(i)).toContainText(/Concept project|Client project/);
});

test('plain text uses the default cursor; links and inputs do not', async ({ page }) => {
  await page.goto('/contact');
  const cursor = (selector: string) => page.locator(selector).first().evaluate((el) => getComputedStyle(el).cursor);
  expect(await cursor('h1')).toBe('default');
  expect(await cursor('footer p')).toBe('default');
  expect(await cursor('a[href="/work"]')).toBe('pointer');
  expect(await cursor('#email')).toBe('text');
});

test.describe('security (TC-025)', () => {
  const cspPages = ['/', '/services/website-development', '/work', '/about', '/contact', '/quote', '/admin', '/admin/content/home/main'];
  for (const path of cspPages) {
    test(`${path} loads with no Content Security Policy violations`, async ({ page }) => {
      const violations: string[] = [];
      await page.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', (e) => {
          (window as unknown as { __csp: string[] }).__csp ??= [];
          (window as unknown as { __csp: string[] }).__csp.push(`${e.violatedDirective} ${e.blockedURI}`);
        });
      });
      page.on('console', (m) => m.text().includes('Content Security Policy') && violations.push(m.text()));
      await page.goto(path);
      // Turnstile keeps polling, so wait a fixed moment for late scripts instead of network idle.
      await page.waitForTimeout(1500);
      const fromPage = await page.evaluate(() => (window as unknown as { __csp?: string[] }).__csp ?? []);
      expect([...violations, ...fromPage]).toEqual([]);
    });
  }

  test('static pages and Worker responses send the security headers', async ({ request }) => {
    for (const path of ['/', '/api/leads', '/admin']) {
      const response = await request.get(path, { maxRedirects: 0 });
      const headers = response.headers();
      expect(headers['x-content-type-options'], path).toBe('nosniff');
      expect(headers['x-frame-options'], path).toBe('DENY');
      expect(headers['strict-transport-security'], path).toContain('max-age=31536000');
      expect(headers['content-security-policy'], path).toContain("frame-ancestors 'none'");
    }
  });
});
