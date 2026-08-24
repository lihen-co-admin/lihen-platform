import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /storefront\.spec\.ts/,
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report-storefront', open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4174',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm --filter @lihen/storefront build && pnpm --filter @lihen/storefront preview --host 127.0.0.1 --port 4174',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_SUPABASE_URL: 'http://127.0.0.1:4174',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'e2e_publishable_key',
    },
  },
  projects: [
    { name: 'storefront-desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'storefront-mobile', use: { ...devices['Pixel 7'] } },
  ],
});
