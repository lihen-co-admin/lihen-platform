import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/editorial-e2e',
  testMatch: 'editorial-operational-closure.spec.ts',
  use: { baseURL: 'http://127.0.0.1:4175' },
  webServer: {
    command:
      'corepack pnpm --filter @lihen/control-center exec vite --host 127.0.0.1 --port 4175 --strictPort',
    url: 'http://127.0.0.1:4175',
    reuseExistingServer: false,
  },
});
