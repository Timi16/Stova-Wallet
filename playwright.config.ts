import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end run on real Stellar Testnet: create → back up → fund → add USDC →
 * receive → send → history → lock/unlock. Needs network access.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 420_000,
  expect: { timeout: 20_000 },
  retries: 0,
  workers: 1,
  reporter: [['list']],
  outputDir: 'test-results',
  use: {
    baseURL: 'http://localhost:4173',
    ...devices['iPhone 13'],
    browserName: 'chromium',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
