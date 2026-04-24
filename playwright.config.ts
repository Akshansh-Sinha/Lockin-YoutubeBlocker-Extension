import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // Look for test files in the tests/ directory
  testDir: './tests',
  fullyParallel: true,
  // Fail the build on CI if any test.only is left in source
  forbidOnly: !!process.env.CI,
  // No retries locally; 1 retry in CI (YouTube can be flaky)
  retries: process.env.CI ? 1 : 0,
  // Show 1 parallel worker in CI to avoid rate limiting from YouTube
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    // Base URL for the canary tests
    baseURL: 'https://www.youtube.com',
    // Record traces on the first retry to help debug failures
    trace: 'on-first-retry',
    // 10 second default timeout for actions
    actionTimeout: 10_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
