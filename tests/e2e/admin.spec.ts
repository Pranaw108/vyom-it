import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

// Admin tests use the local developer sign-in (localhost only). OWNER is DEV_ADMIN_EMAIL in .dev.vars.
const OWNER = 'owner@localhost.test';
// Letters only: names with digits are rejected by the form rules.
const stamp = Date.now().toString(36).replace(/[0-9]/g, (d) => 'abcdefghij'[Number(d)]!);

test.describe.configure({ mode: 'serial' });
test.use({ reducedMotion: 'reduce' });

async function csrfFor(page: Page): Promise<string> {
  return (await page.locator('meta[name="csrf-token"]').getAttribute('content')) ?? '';
}

async function addUser(page: Page, name: string, email: string, role: string) {
  await page.goto('/admin/users');
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByLabel('Username').fill(email.split('@')[0]!.toLowerCase());
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.locator('#new-role').selectOption(role);
  await page.getByRole('button', { name: 'Create account' }).click();
}

test('owner sees the dashboard with health and all sections', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Welcome');
  await expect(page.getByLabel('System health')).toContainText('Lead emails');
  const nav = page.getByRole('navigation', { name: 'Admin' });
  for (const item of ['Dashboard', 'Leads', 'Content', 'Team', 'Accounts', 'Audit log', 'Your account']) await expect(nav.getByRole('link', { name: item })).toBeVisible();
});

test('editing and publishing content is recorded (AC-I3, TC-031)', async ({ page }) => {
  await page.goto('/admin/content/home/main');
  const headline = page.locator('#home-hero-headline');
  await headline.fill(`We design and build the digital products your customers actually use ${stamp}.`);
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Draft saved' })).toBeVisible();
  await expect(page.locator('.pill').first()).toHaveText('Live · unpublished changes');
  await page.getByRole('button', { name: 'Publish' }).click();
  await expect(page.locator('.pill').first()).toHaveText('Live');

  await page.goto('/admin/audit?entity=home');
  await expect(page.locator('tbody tr').first()).toContainText('content.publish');
  await expect(page.getByText('content.save').first()).toBeVisible();
});

test('publishing is refused while content breaks the rules (FR-159)', async ({ page }) => {
  await page.goto('/admin/content/home/main');
  const answers = page.locator('textarea[id^="home-faqs-"][id$="-answer"]');
  const original = await answers.first().inputValue();
  await answers.first().fill('Too short');
  await page.getByRole('button', { name: 'Publish' }).click();
  await expect(page.getByRole('alert')).toContainText('Fix these before publishing');
  await answers.first().fill(original);
  await page.getByRole('button', { name: 'Publish' }).click();
  await expect(page.locator('.pill').first()).toHaveText('Live');
});

test('a contributor can edit but cannot publish, even through the API (TC-029)', async ({ page, request }) => {
  const email = `contrib-${stamp}@localhost.test`;
  await addUser(page, 'Test Contributor', email, 'contributor');
  await expect(page.getByRole('status').first()).toContainText('added as Contributor');

  await page.setExtraHTTPHeaders({ 'X-Dev-Admin-Email': email });
  await page.goto('/admin/content/services/website-development');
  await expect(page.getByRole('button', { name: 'Publish' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Submit for review' })).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Admin' });
  await expect(nav.getByRole('link', { name: 'Accounts' })).toHaveCount(0);

  const csrf = await csrfFor(page);
  const response = await page.request.post('/api/admin/content', {
    headers: { 'X-CSRF-Token': csrf, 'X-Dev-Admin-Email': email, Origin: new URL(page.url()).origin },
    data: { action: 'publish', collection: 'services', key: 'website-development', rowVersion: 999 },
  });
  expect(response.status()).toBe(403);

  const usersPage = await page.request.get('/admin/users', { headers: { 'X-Dev-Admin-Email': email }, maxRedirects: 0 });
  expect(usersPage.status()).toBe(302);
});

test('state-changing requests need a valid CSRF token and same origin (FR-152)', async ({ request, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const noToken = await request.post('/api/admin/content', { headers: { Origin: origin }, data: { action: 'save', collection: 'home', key: 'main' } });
  expect(noToken.status()).toBe(403);
  const forged = await request.post('/api/admin/content', { headers: { Origin: origin, 'X-CSRF-Token': 'a'.repeat(64) }, data: { action: 'save', collection: 'home', key: 'main' } });
  expect(forged.status()).toBe(403);
});

test('unknown accounts are refused (TC-012)', async ({ page }) => {
  await page.setExtraHTTPHeaders({ 'X-Dev-Admin-Email': `stranger-${stamp}@example.com` });
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/no-access$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText("You don't have access yet");
});

test('a disabled user loses access on their next request (TC-032)', async ({ page }) => {
  const email = `cm-${stamp}@localhost.test`;
  await addUser(page, 'Test Manager', email, 'content_manager');
  const row = page.locator('tr', { hasText: email });
  await row.getByRole('button', { name: 'Disable' }).click();
  await expect(page.getByRole('status').first()).toContainText('can no longer sign in');

  await page.setExtraHTTPHeaders({ 'X-Dev-Admin-Email': email });
  await page.goto('/admin');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your access has been turned off');
});

test('the last Owner cannot be demoted or disabled (TC-036)', async ({ page }) => {
  await page.goto('/admin/users');
  const row = page.locator('tr', { hasText: OWNER });
  await row.locator('select').selectOption('viewer');
  await row.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('alert')).toContainText('at least one Owner');
});

async function submitLead(request: APIRequestContext, baseURL: string, name: string) {
  const response = await request.post('/api/leads', {
    headers: { Origin: new URL(baseURL).origin, 'CF-Connecting-IP': `203.0.113.${Math.floor(Math.random() * 250)}` },
    data: {
      formType: 'contact', submissionId: crypto.randomUUID(), name, email: 'lead@example.com',
      message: 'Please call me about a new website.', consentContact: true, elapsedMs: 9000, turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX',
    },
  });
  expect(response.status()).toBe(201);
}

test('leads can be found, updated and annotated, and every change is audited', async ({ page, request, baseURL }) => {
  const name = `Lead Tester ${stamp}`;
  await submitLead(request, baseURL!, name);
  await page.goto(`/admin/leads?q=${encodeURIComponent(name)}`);
  await page.getByRole('link', { name: /VY-\d{2}-\d{4}/ }).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);

  await page.locator('#lead-status').selectOption('contacted');
  await page.getByRole('button', { name: 'Update status' }).click();
  await expect(page.getByRole('status')).toContainText('Status changed to contacted');

  await page.locator('#note-body').fill('Called, sending proposal on Monday.');
  await page.getByRole('button', { name: 'Add note' }).click();
  await expect(page.getByText('Called, sending proposal on Monday.')).toBeVisible();

  await page.goto('/admin/audit?entity=lead');
  await expect(page.getByText('lead.status').first()).toBeVisible();
  await expect(page.getByText('lead.note').first()).toBeVisible();
});

test('erasing a lead removes personal data but keeps the record (FR-147)', async ({ page, request, baseURL }) => {
  const name = `Erase Me ${stamp}`;
  await submitLead(request, baseURL!, name);
  await page.goto(`/admin/leads?q=${encodeURIComponent(name)}`);
  await page.getByRole('link', { name: /VY-\d{2}-\d{4}/ }).first().click();
  await page.getByText('Erase personal data').click();
  await page.locator('#erase-reason').fill('Deletion request by email');
  await page.locator('#erase-confirm').fill('ERASE');
  await page.getByRole('button', { name: 'Erase permanently' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('(erased)');
  await expect(page.getByText(name)).toHaveCount(0);
  await expect(page.getByText('erased: Deletion request by email')).toBeVisible();
});

test('admin pages fit a phone screen without sideways scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ['/admin', '/admin/leads', '/admin/content', '/admin/content/services/website-development', '/admin/users', '/admin/audit']) {
    await page.goto(path);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), path).toBeLessThanOrEqual(0);
  }
});
