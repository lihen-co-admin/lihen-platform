import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('GitHub Pages DEV deployment contract', () => {
  it('uses hash routing so Pages deep routes do not require server rewrites', () => {
    const main = read('apps/control-center/src/main.tsx');

    expect(main).toContain('HashRouter');
    expect(main).not.toContain('BrowserRouter');
  });

  it('uses relative Vite assets for the Control Center Pages subpath', () => {
    const config = read('apps/control-center/vite.config.ts');
    expect(config).toContain("base: './'");
  });

  it('keeps Storefront routing deployable below a Pages subpath', () => {
    const config = read('apps/storefront/vite.config.ts');
    expect(config).toContain("base: './'");
  });

  it('makes the Storefront public URL configurable instead of hardcoding localhost', () => {
    const hub = read('apps/control-center/src/pages/PublicHubPage.tsx');
    const env = read('apps/control-center/.env.example');

    expect(hub).toContain('VITE_STOREFRONT_PUBLIC_URL');
    expect(hub).not.toContain('href="http://localhost:5174/#descubre"');
    expect(hub).not.toContain('href="/#descubre"');
    expect(env).toContain(
      'VITE_STOREFRONT_PUBLIC_URL=http://localhost:5174/#descubre',
    );
  });

  it('keeps local env files outside version control', () => {
    const gitignore = read('.gitignore');

    expect(gitignore).toContain('.env.*');
    expect(gitignore).toContain('*.local');
  });

  it('ships Pages only through an explicit DEV workflow', () => {
    const workflow = read('.github/workflows/pages-dev.yml');

    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).not.toMatch(/branches:\s*\[\s*main\s*\]/);
    expect(workflow).toContain('actions/upload-pages-artifact@v3');
    expect(workflow).toContain('actions/deploy-pages@v4');
  });
});
