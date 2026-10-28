import { defineConfig, devices } from '@playwright/test';

const browserReport = process.env.BROWSER_PROJECT || 'all';

export default defineConfig({
  testDir: './tests/browser',
  timeout: 45_000,
  expect: { timeout: 12_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: `playwright-report/${browserReport}` }]],
  outputDir: `test-results/${browserReport}`,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: {
      ...devices['Desktop Chrome'],
      // Nur lokale Ausweichroute, falls Playwright-CDN-Binärdownloads gesperrt
      // sind. GitHub Actions nutzt weiterhin den offiziellen Playwright-Browser.
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
        ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } }
        : {}),
    } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
  webServer: {
    command: 'node scripts/test-server.mjs',
    url: 'http://127.0.0.1:4173/',
    reuseExistingServer: false,
    timeout: 20_000,
  },
});
