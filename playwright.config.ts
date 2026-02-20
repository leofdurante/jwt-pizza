import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config tailored for coverage collection with `playwright-test-coverage`.
 * Starts the Vite dev server (instrumented via vite.config.ts) and points tests to it.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report' }]],
  use: {
    baseURL: 'http://127.0.0.1:5174',
    trace: 'on-first-retry',
    headless: true,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
    },
  ],

  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5174 --strictPort',
    port: 5174,
    reuseExistingServer: true,
    timeout: 90_000,
  },
});
