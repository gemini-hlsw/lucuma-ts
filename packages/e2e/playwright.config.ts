import fs from 'node:fs';

import { defineConfig, devices } from '@playwright/test';

if (fs.existsSync('./.env')) process.loadEnvFile('./.env');

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: process.env.CI ? [['github'], ['html']] : [['list'], ['html']],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    // Use the docker-compose service URL in CI, or the local URL when running locally.
    baseURL: process.env.CI ? 'http://navigate.gemini.edu:9070' : 'https://navigate.gemini.edu:5173',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'cd ../ui && pnpm dev',
  //   url: 'https://navigate.gemini.edu:5173',
  //   reuseExistingServer: true,
  // },
});
