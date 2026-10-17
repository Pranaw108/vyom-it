import { expect, test } from '@playwright/test';

test.describe('Quote form', () => {
  test('pre-selects the service, validates each step and submits (TC-001, TC-002)', async ({ page }) => {
    // A fresh address per run, so repeated local runs don't trip the 5-per-10-minutes limit.
    // (On Cloudflare this header is always set by the edge, never by the visitor.)
    const ip = `198.18.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
    await page.route('**/api/leads', (route) => route.continue({ headers: { ...route.request().headers(), 'cf-connecting-ip': ip } }));
    await page.goto('/quote?service=mobile-app-development');
    await expect(page.getByRole('checkbox', { name: 'Mobile app development' })).toBeChecked();

    // Step 1: missing project type shows an error summary and blocks progress.
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.locator('#error-summary')).toContainText('Project type');
    await page.getByRole('radio', { name: 'A new product or website' }).check();
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 2
    await expect(page.getByRole('heading', { name: /Your project/ })).toBeFocused();
    await page.getByRole('radio', { name: 'Both' }).check();
    await page.getByLabel('Describe your project').fill('A booking app for our three clinics, with reminders and UPI payments.');
    await page.getByLabel('When do you want to start?').selectOption('1-3-months');
    await page.getByLabel('Approximate budget').selectOption('prefer-not-to-say');
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 3
    await page.getByLabel('Your name').fill('Priya Sharma');
    await page.locator('#email').fill('priya@example.com');
    await expect(page.locator('.review')).toContainText('Prefer not to say');
    await page.getByRole('button', { name: 'Send request' }).click();
    await expect(page.locator('#consentContact-error')).toBeVisible();
    await page.getByLabel('I agree that the team may contact me about this request.').check();

    // The fill-time check needs a few seconds since load; real visitors take longer than this.
    await page.waitForTimeout(3200);
    await page.getByRole('button', { name: 'Send request' }).click();
    await expect(page.getByRole('status')).toContainText(/VY-\d{2}-\d{4}/, { timeout: 20_000 });
  });

  test('keeps entered data after a refresh', async ({ page }) => {
    await page.goto('/quote');
    await page.getByRole('checkbox', { name: 'UI/UX design' }).check();
    await page.getByRole('radio', { name: 'A redesign' }).check();
    await page.reload();
    await expect(page.getByRole('checkbox', { name: 'UI/UX design' })).toBeChecked();
  });
});

test.describe('Contact form', () => {
  test('shows inline errors and keeps data (TC-002)', async ({ page }) => {
    await page.goto('/contact');
    await page.getByLabel('Your name').fill('R');
    await page.locator('#email').fill('not-an-email');
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.locator('#error-summary')).toBeFocused();
    await expect(page.locator('#email-error')).toBeVisible();
    await expect(page.locator('#email')).toHaveValue('not-an-email');
  });

  test('switches to the audit request from the SEO page link', async ({ page }) => {
    await page.goto('/contact?intent=audit');
    await expect(page.getByText('free website audit')).toBeVisible();
  });
});
