import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

const appSource = readFileSync(
  join(root, 'apps/control-center/src/app/App.tsx'),
  'utf8',
);

const shellSource = readFileSync(
  join(root, 'apps/control-center/src/components/AppShell.tsx'),
  'utf8',
);

const mainSource = readFileSync(
  join(root, 'apps/control-center/src/main.tsx'),
  'utf8',
);

const requiredRoutes = [
  '/',
  '/products',
  '/brands',
  '/categories',
  '/catalogs',
  '/inventory',
  '/suppliers',
  '/purchases',
  '/orders',
  '/customers/benefits',
  '/sales',
  '/finance',
  '/content/public-hub',
  '/content/social',
  '/conversations',
  '/cloud',
  '/assistant',
  '/operations',
  '/dev-auth-probe',
  '/dev-whatsapp-preflight',
] as const;

function registeredRoute(route: string) {
  return appSource.includes(`path="${route}"`);
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const tsxFiles = walk(join(root, 'apps/control-center/src'))
  .filter((path) => path.endsWith('.tsx'));

describe('Control Center UX navigation contract', () => {
  it('keeps HashRouter for GitHub Pages-safe internal navigation', () => {
    expect(mainSource).toContain('HashRouter');
    expect(mainSource).not.toContain('BrowserRouter');
  });

  it.each(requiredRoutes)('registers required route %s', (route) => {
    expect(registeredRoute(route)).toBe(true);
  });

  it('keeps every static sidebar destination registered', () => {
    const destinations = [
      ...shellSource.matchAll(/\bto="(\/[^"]*)"/g),
    ].map((match) => match[1]!);

    expect(destinations.length).toBeGreaterThan(0);

    for (const destination of destinations) {
      expect(
        registeredRoute(destination),
        `Sidebar destination not registered: ${destination}`,
      ).toBe(true);
    }
  });

  it('keeps every static Intelligence targetRoute registered', () => {
    const destinations = tsxFiles.flatMap((path) => {
      const source = readFileSync(path, 'utf8');

      return [...source.matchAll(/targetRoute:\s*['"](\/[^'"]+)['"]/g)]
        .map((match) => ({
          path,
          destination: match[1]!,
        }));
    });

    for (const { path, destination } of destinations) {
      expect(
        registeredRoute(destination),
        `Unregistered targetRoute ${destination} in ${path}`,
      ).toBe(true);
    }
  });

  it('does not use hardcoded root-relative href for internal app navigation', () => {
    const offenders = tsxFiles.flatMap((path) => {
      const source = readFileSync(path, 'utf8');

      const direct = [
        ...source.matchAll(/href\s*=\s*["']\/(?!\/)[^"']*["']/g),
      ].map((match) => `${path}: ${match[0]}`);

      const braced = [
        ...source.matchAll(/href\s*=\s*\{\s*["']\/(?!\/)[^"']*["']\s*\}/g),
      ].map((match) => `${path}: ${match[0]}`);

      return [...direct, ...braced];
    });

    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});
