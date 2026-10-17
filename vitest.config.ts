import { defineConfig } from 'vitest/config';

// Unit tests only; browser tests in tests/e2e run under Playwright.
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
  },
});
