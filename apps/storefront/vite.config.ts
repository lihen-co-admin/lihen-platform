import { defineConfig } from 'vite';

export default defineConfig({
  // Relative assets keep the hash-routed Storefront deployable under a GitHub Pages subpath.
  base: './',
});
