import { execSync } from 'node:child_process';
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

// Password sign-in, sessions and account management. The Owner acts through the local developer
// sign-in; everyone else uses a context with X-Dev-No-Bypass, so they are treated as a normal visitor.

test.describe.configure({ mode: 'serial' });
test.use({ reducedMotion: 'reduce' });

const stamp = Date.now().toString(36).replace(/[0-9]/g, (d) => 'abcdefghij'[Number(d)]!);
const CLIENT = `client-${stamp}`;
const CLIENT_PASSWORD = 'river-lantern-copper-71';
const NEW_PASSWORD = 'harbour-violet-signal-38';
const ip = () => `198.19.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;

async function visitor(browser: Browser): Promise<BrowserContext> {
  // Each visitor gets its own address so login rate limits from other tests don't interfere.
  return browser.newContext({ extraHTTPHeaders: { 'X-Dev-No-Bypass': '1', 'CF-Connecting-IP': ip() } });
}

async function createAccount(page: Page, username: string, role: string, grants: string[] = []): Promise<string> {
  await page.goto('/admin/users');
  await page.getByLabel('Name', { exact: true }).fill(`Test ${username}`);
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Email', { exact: true }).fill(`${username}@example.com`);
  await page.locator('#new-role').selectOption(role);
  if (role === 'client') {
    const form = page.locator('form', { has: page.locator('#new-role') });
    for (const box of await form.locator('input[name="permissions"]').all()) await box.setChecked(grants.includes((await box.getAttribute('value'))!));
  }
  await page.getByRole('button', { name: 'Create account' }).click();
  return (await page.locator('#one-time-link').inputValue());
}

async function setPassword(page: Page, link: string, password: string) {
  await page.goto(link);
  await page.locator('#password').fill(password);
  await page.locator('#confirm').fill(password);
  await page.getByRole('button', { name: 'Save password and sign in' }).click();
}

async function login(page: Page, username: string, password: string) {
  await page.goto('/auth/login');
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

const sql = (command: string) =>
  execSync(`npx wrangler d1 execute vyom-website --local --command "${command}"`, { stdio: 'pipe', shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh' });

let setupLink = '';

test('signed-out visitors are sent to the login page; admin APIs refuse them (401)', async ({ browser }) => {
  const context = await visitor(browser);
  const page = await context.newPage();
  await page.goto('/admin/leads');
  await expect(page).toHaveURL(/\/auth\/login\?next=%2Fadmin%2Fleads$/);
  await expect(page.getByRole('heading', { name: 'Sign in to the admin' })).toBeVisible();
  for (const path of ['/api/admin/users', '/api/admin/content', '/api/admin/leads']) {
    const response = await context.request.post(path, { data: {}, headers: { Origin: new URL(page.url()).origin } });
    expect(response.status(), path).toBe(401);
  }
  expect((await context.request.get('/api/admin/leads-export')).status()).toBe(401);
  await context.close();
});

test('there is no public sign-up, and setup pages need a valid one-time link', async ({ browser }) => {
  const context = await visitor(browser);
  const page = await context.newPage();
  expect((await page.goto('/auth/signup'))?.status()).toBe(404);
  expect((await page.goto('/auth/register'))?.status()).toBe(404);
  expect((await page.goto('/auth/setup'))?.status()).toBe(410);
  expect((await page.goto(`/auth/setup?token=${'x'.repeat(43)}`))?.status()).toBe(410);
  await context.close();
});

test('the Owner creates a client account and gets a one-time setup link', async ({ page }) => {
  setupLink = await createAccount(page, CLIENT, 'client', ['leads.view', 'content.view']);
  expect(setupLink).toMatch(/\/auth\/setup\?token=[\w-]{43}$/);
  await expect(page.locator('tr', { hasText: CLIENT })).toContainText('No password yet');
});

test('the setup link sets a password, signs in, and works only once', async ({ browser }) => {
  const context = await visitor(browser);
  const page = await context.newPage();
  await setPassword(page, setupLink, 'short');
  await expect(page.getByRole('alert')).toContainText('at least 12 characters');
  await setPassword(page, setupLink, CLIENT_PASSWORD);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Welcome');
  expect((await page.goto(setupLink))?.status()).toBe(410);
  await context.close();
});

test('wrong passwords are rejected with one message that reveals nothing', async ({ browser }) => {
  const context = await visitor(browser);
  const page = await context.newPage();
  await login(page, CLIENT, 'not-the-right-password');
  const wrong = await page.getByRole('alert').textContent();
  await login(page, `nobody-${stamp}`, 'not-the-right-password');
  expect(await page.getByRole('alert').textContent()).toBe(wrong);
  await expect(page).toHaveURL(/\/auth\/login/);
  await context.close();
});

test('a client sees only what was granted and is refused Owner-only actions (403)', async ({ browser }) => {
  const context = await visitor(browser);
  const page = await context.newPage();
  await login(page, CLIENT, CLIENT_PASSWORD);
  await expect(page).toHaveURL(/\/admin$/);
  const nav = page.getByRole('navigation', { name: 'Admin' });
  await expect(nav.getByRole('link', { name: 'Leads' })).toBeVisible();
  for (const hidden of ['Accounts', 'Audit log', 'Team']) await expect(nav.getByRole('link', { name: hidden })).toHaveCount(0);

  await page.goto('/admin/users');
  await expect(page).toHaveURL(/\/admin\?err=/);

  const csrf = (await page.locator('meta[name="csrf-token"]').getAttribute('content'))!;
  const origin = new URL(page.url()).origin;
  const promote = await context.request.post('/api/admin/users', { form: { _csrf: csrf, action: 'create', username: `evil-${stamp}`, name: 'Evil', email: `evil-${stamp}@example.com`, role: 'owner' }, headers: { Origin: origin }, maxRedirects: 0 });
  expect(promote.status()).toBe(303);
  expect(promote.headers()['location']).toContain('err=');
  const exportCsv = await context.request.get('/api/admin/leads-export');
  expect(exportCsv.status()).toBe(403);
  const publish = await context.request.post('/api/admin/content', { data: { action: 'publish', collection: 'services', key: 'website-development' }, headers: { 'X-CSRF-Token': csrf, Origin: origin } });
  expect(publish.status()).toBe(403);
  await context.close();
});

test('logout revokes the session; the old cookie cannot be reused', async ({ browser }) => {
  const context = await visitor(browser);
  const page = await context.newPage();
  await login(page, CLIENT, CLIENT_PASSWORD);
  await expect(page).toHaveURL(/\/admin$/);
  const saved = await context.cookies();
  await page.goto('/auth/logout');
  await expect(page).toHaveURL(/\/auth\/login\?reason=signed-out$/);

  const replay = await visitor(browser);
  await replay.addCookies(saved);
  const replayPage = await replay.newPage();
  await replayPage.goto('/admin');
  await expect(replayPage).toHaveURL(/\/auth\/login/);
  await replay.close();
  await context.close();
});

test('an expired session cannot be used', async ({ browser }) => {
  const context = await visitor(browser);
  const page = await context.newPage();
  await login(page, CLIENT, CLIENT_PASSWORD);
  await expect(page).toHaveURL(/\/admin$/);
  sql(`UPDATE sessions SET expires_at = '2000-01-01T00:00:00.000Z' WHERE user_id = (SELECT id FROM users WHERE username = '${CLIENT}') AND revoked_at IS NULL`);
  await page.goto('/admin/leads');
  await expect(page).toHaveURL(/\/auth\/login/);
  await context.close();
});

test('changing the password signs out other devices; old password stops working', async ({ browser }) => {
  const a = await visitor(browser);
  const b = await visitor(browser);
  const pageA = await a.newPage();
  const pageB = await b.newPage();
  await login(pageA, CLIENT, CLIENT_PASSWORD);
  await login(pageB, CLIENT, CLIENT_PASSWORD);

  await pageA.goto('/admin/account');
  await pageA.locator('#current').fill(CLIENT_PASSWORD);
  await pageA.locator('#new').fill(NEW_PASSWORD);
  await pageA.locator('#confirm').fill(NEW_PASSWORD);
  await pageA.getByRole('button', { name: 'Save new password' }).click();
  await expect(pageA.getByRole('status')).toContainText('Password changed');

  await pageB.goto('/admin');
  await expect(pageB).toHaveURL(/\/auth\/login/);
  await login(pageB, CLIENT, CLIENT_PASSWORD);
  await expect(pageB.getByRole('alert')).toBeVisible();
  await login(pageB, CLIENT, NEW_PASSWORD);
  await expect(pageB).toHaveURL(/\/admin$/);
  await a.close();
  await b.close();
});

test('disabling an account signs it out everywhere and blocks new sign-ins', async ({ page, browser }) => {
  const context = await visitor(browser);
  const clientPage = await context.newPage();
  await login(clientPage, CLIENT, NEW_PASSWORD);
  await expect(clientPage).toHaveURL(/\/admin$/);

  await page.goto('/admin/users');
  await page.locator('tr', { hasText: CLIENT }).getByRole('button', { name: 'Disable' }).click();
  await expect(page.getByRole('status').first()).toContainText('signed out everywhere');

  await clientPage.goto('/admin');
  await expect(clientPage).toHaveURL(/\/auth\/login/);
  await login(clientPage, CLIENT, NEW_PASSWORD);
  await expect(clientPage.getByRole('alert')).toContainText('turned off');
  await context.close();
});

test('repeated failures lock the username for a while (rate limiting)', async ({ browser }) => {
  const context = await visitor(browser);
  const page = await context.newPage();
  const target = `lockme-${stamp}`;
  for (let i = 0; i < 5; i++) await login(page, target, `wrong-password-${i}-xx`);
  await login(page, target, 'wrong-password-final');
  await expect(page.getByRole('alert')).toContainText('Too many attempts');
  await context.close();
});

test('a login form posted from another site is refused (login CSRF)', async ({ browser }) => {
  const context = await visitor(browser);
  const response = await context.request.post('/auth/login', { form: { username: CLIENT, password: NEW_PASSWORD }, headers: { Origin: 'https://evil.example' }, maxRedirects: 0 });
  expect(response.status()).toBe(403);
  expect(response.headers()['set-cookie'] ?? '').not.toContain('vyom_session=');
  await context.close();
});
