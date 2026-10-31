import { expect, test } from '@playwright/test';

// Version history and Trash (admin Phase 2). Uses the local developer sign-in as the Owner.

test.describe.configure({ mode: 'serial' });
test.use({ reducedMotion: 'reduce' });

const stamp = Date.now().toString(36).replace(/[0-9]/g, (d) => 'abcdefghij'[Number(d)]!);

test.beforeEach(({ page }) => {
  page.on('dialog', (dialog) => dialog.accept());
});

test('every save is kept as a version, and an older one can be restored into the draft', async ({ page }) => {
  // Its own item, so parallel admin tests editing other content never collide with it.
  await page.goto('/admin/content/engagement/dedicated-team');
  const description = page.locator('#engagement-description');
  const original = await description.inputValue();

  await description.fill(`A dedicated team that works as part of yours, week after week, reference ${stamp}.`);
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Draft saved' })).toBeVisible();
  await page.reload();

  const history = page.getByRole('region', { name: 'Version history' });
  const rows = history.locator('tbody tr');
  await expect(rows.first()).toContainText('Saved');
  await expect(rows.first()).toContainText('Current draft');
  await expect(rows.first()).toContainText('Description');
  await expect(rows.first().getByRole('button', { name: /Restore/ })).toHaveCount(0);

  // The version before our save holds the original headline.
  await rows.nth(1).getByRole('button', { name: /Restore/ }).click();
  await expect(page.getByText('That version is back in the draft')).toBeVisible();
  await expect(page.locator('#engagement-description')).toHaveValue(original);
  await expect(history.locator('tbody tr').first()).toContainText('Restored');

  await page.goto('/admin/audit?entity=engagement');
  await expect(page.getByText('content.restore_version').first()).toBeVisible();
});

test('a deleted item goes to the Trash, leaves the list, and can be restored', async ({ page }) => {
  // If an earlier run stopped half-way, take the item out of the Trash first (409 = it was not there).
  await page.goto('/admin/content/engagement');
  const csrf = (await page.locator('meta[name="csrf-token"]').getAttribute('content'))!;
  await page.request.post('/api/admin/content', { data: { action: 'untrash', collection: 'engagement', key: 'monthly-retainer' }, headers: { 'X-CSRF-Token': csrf, Origin: new URL(page.url()).origin } });

  await page.goto('/admin/content/engagement/monthly-retainer');
  await expect(page.getByRole('region', { name: 'Delete this item' })).toBeVisible();
  await page.getByRole('button', { name: 'Move to Trash' }).click();

  await expect(page).toHaveURL(/\/admin\/content\/engagement\?msg=/);
  await expect(page.getByText('moved to the Trash')).toBeVisible();
  await expect(page.locator('tbody')).not.toContainText('monthly-retainer');
  await page.goto('/admin/content/engagement/monthly-retainer');
  await expect(page).toHaveURL(/err=/);

  await page.goto('/admin/content/trash');
  const row = page.locator('tr', { hasText: 'monthly-retainer' });
  await expect(row).toContainText('30 days');
  await row.getByRole('button', { name: /Restore/ }).click();
  await expect(page.getByText('restored and back on the website')).toBeVisible();
  await expect(page.locator('tr', { hasText: 'monthly-retainer' })).toHaveCount(0);

  await page.goto('/admin/content/engagement');
  await expect(page.locator('tbody')).toContainText('monthly-retainer');
  await page.goto('/admin/audit?entity=engagement');
  await expect(page.getByText('content.untrash').first()).toBeVisible();
  await expect(page.getByText('content.trash').first()).toBeVisible();
});

test('required pages cannot be deleted, and trash actions need publishing rights', async ({ page, browser }) => {
  await page.goto('/admin/content/home/main');
  await expect(page.getByRole('button', { name: 'Move to Trash' })).toHaveCount(0);
  const csrf = (await page.locator('meta[name="csrf-token"]').getAttribute('content'))!;
  const origin = new URL(page.url()).origin;
  const single = await page.request.post('/api/admin/content', { data: { action: 'trash', collection: 'home', key: 'main' }, headers: { 'X-CSRF-Token': csrf, Origin: origin } });
  expect(single.status()).toBe(422);

  // A signed-out visitor is refused outright.
  const visitor = await browser.newContext({ extraHTTPHeaders: { 'X-Dev-No-Bypass': '1' } });
  const refused = await visitor.request.post('/api/admin/content', { data: { action: 'trash', collection: 'engagement', key: 'fixed-scope' }, headers: { Origin: origin } });
  expect(refused.status()).toBe(401);
  await visitor.close();
});
