import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/drafts-e2e',
  fullyParallel: true,
  retries: 0,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4187', trace: 'retain-on-failure' },
  webServer: {
    cwd: './apps/control-center',
    command:
      'node node_modules/vite/bin/vite.js --config vite.config.ts --host 127.0.0.1 --port 4187 --strictPort',
    url: 'http://127.0.0.1:4187/tests/drafts-browser/index.html',
    reuseExistingServer: false,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
