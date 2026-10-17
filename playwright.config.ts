import { defineConfig, devices } from '@playwright/test';

// E2E and accessibility tests run against the built site served by `astro preview`.
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  retries: 0,
  // The local preview server is single-process; more workers make timings flaky, not tests faster.
  workers: 2,
  reporter: [['list']],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://127.0.0.1:4321',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npx astro preview --port 4321 --host 127.0.0.1',
    url: 'http://127.0.0.1:4321',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
