import { defineConfig, devices } from '@playwright/test';
import { readFileSync } from 'node:fs';
const modeNames = [
  ...readFileSync('packages/database/src/env.ts', 'utf8').matchAll(/(VITE_\w+_MODE):/g),
].map((m) => m[1]!);
export default defineConfig({
  testDir: './tests/layout',
  workers: 1,
  retries: 0,
  reporter: 'list',
  outputDir: 'test-results/layout',
  use: { baseURL: 'http://127.0.0.1:5191' },
  webServer: {
    command:
      'corepack pnpm --filter @lihen/control-center dev --host 127.0.0.1 --port 5191 --strictPort',
    url: 'http://127.0.0.1:5191',
    reuseExistingServer: false,
    env: {
      ...Object.fromEntries(modeNames.map((n) => [n, 'blocked'])),
      VITE_AUTH_MODE: 'disabled',
      VITE_PRODUCT_READ_SOURCE: 'memory',
      VITE_DEV_FORM_DRAFTS_ENABLED: 'false',
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
