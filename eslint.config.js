import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/node_modules/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['tooling/**/*.mjs'],
    languageOptions: {
      globals: {
        Buffer: 'readonly',
        Headers: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        process: 'readonly',
      },
    },
  },
  {
    files: ['supabase/functions/intelligence-runtime/intelligence-core-edge.mjs'],
    languageOptions: {
      globals: {
        URL: 'readonly',
      },
    },
  },
  {
    files: ['supabase/functions/intelligence-runtime/document-extraction-edge.mjs'],
    languageOptions: {
      globals: {
        AbortController: 'readonly',
        btoa: 'readonly',
        clearTimeout: 'readonly',
        fetch: 'readonly',
        performance: 'readonly',
        setTimeout: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
);
