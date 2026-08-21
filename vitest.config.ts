import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'packages/**/tests/**/*.test.ts',
      'tests/architecture/**/*.test.ts',
      'apps/**/tests/**/*.test.ts',
    ],
    environment: 'node',
  },
});
