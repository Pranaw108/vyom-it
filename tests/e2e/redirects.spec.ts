import { expect, test } from '@playwright/test';

// Redirect manager (admin Phase 2). Uses the local developer sign-in as the Owner.

test.describe.configure({ mode: 'serial' });
test.use({ reducedMotion: 'reduce' });

const stamp = Date.now().toString(36);
const FROM = `/old-services-${stamp}`;

test.beforeEach(({ page }) => {
  page.on('dialog', (dialog) => dialog.accept());
});

async function addRedirect(page: import('@playwright/test').Page, from: string, to: string, temporary = false) {
  await page.goto('/admin/redirects');
  await page.getByLabel('From (old address)').fill(from);
  await page.getByLabel('To (new address)').fill(to);
  if (temporary) await page.getByLabel(/Temporary/).check();
  await page.getByRole('button', { name: 'Add redirect' }).click();
}

test('an Owner adds a redirect and visitors are sent on, keeping their query string', async ({ page, browser }) => {
  await addRedirect(page, `${FROM}/`, '/services');
  await expect(page.getByRole('status').first()).toContainText(`Visitors to ${FROM} now go to /services`);
  const row = page.locator('tr', { hasText: FROM });
  await expect(row).toContainText('Permanent');
  await expect(row).toContainText('Not yet');

  const visitor = await browser.newContext({ extraHTTPHeaders: { 'X-Dev-No-Bypass': '1' } });
  const response = await visitor.request.get(`${FROM}?utm_source=mail`, { maxRedirects: 0 });
  expect(response.status()).toBe(301);
  expect(response.headers()['location']).toBe('/services?utm_source=mail');
  const followed = await visitor.newPage();
  await followed.goto(`${FROM}/`);
  await expect(followed).toHaveURL(/\/services\/?$/);
  await visitor.close();

  await expect.poll(async () => {
    await page.goto('/admin/redirects');
    return page.locator('tr', { hasText: FROM }).textContent();
  }).toContain('time');
});

test('loops, duplicates, live pages and the site’s own addresses are refused', async ({ page }) => {
  await addRedirect(page, '/services', '/about');
  await expect(page.getByRole('alert')).toContainText('still a live page');

  await addRedirect(page, '/admin/users', '/about');
  await expect(page.getByRole('alert')).toContainText('cannot be redirected');

  await addRedirect(page, FROM, '/about');
  await expect(page.getByRole('alert')).toContainText('already a redirect');

  await addRedirect(page, `/loop-a-${stamp}`, `/loop-b-${stamp}`);
  await addRedirect(page, `/loop-b-${stamp}`, `/loop-a-${stamp}`);
  await expect(page.getByRole('alert')).toContainText('round in a circle');
  await page.locator('tr', { hasText: `/loop-a-${stamp}` }).getByRole('button', { name: /Remove/ }).click();
  await expect(page.getByRole('status').first()).toContainText('removed');

  await addRedirect(page, `/bad-target-${stamp}`, 'javascript:alert(1)');
  await expect(page.getByRole('alert')).toContainText('“To”');
});

test('removing a redirect is audited, and the old address is a 404 again', async ({ page, request }) => {
  await page.goto('/admin/redirects');
  await page.locator('tr', { hasText: FROM }).getByRole('button', { name: /Remove/ }).click();
  await expect(page.getByRole('status').first()).toContainText(`Redirect from ${FROM} removed`);
  expect((await request.get(FROM, { maxRedirects: 0, headers: { 'X-Dev-No-Bypass': '1' } })).status()).toBe(404);

  await page.goto('/admin/audit?entity=redirect');
  await expect(page.getByText('redirect.delete').first()).toBeVisible();
  await expect(page.getByText('redirect.create').first()).toBeVisible();
});

test('only signed-in publishers can change redirects', async ({ browser, baseURL }) => {
  const visitor = await browser.newContext({ extraHTTPHeaders: { 'X-Dev-No-Bypass': '1' } });
  const response = await visitor.request.post('/api/admin/redirects', { form: { action: 'create', from: '/x-evil', to: 'https://evil.example' }, headers: { Origin: baseURL! }, maxRedirects: 0 });
  expect(response.status()).toBe(401);
  await visitor.close();
});
