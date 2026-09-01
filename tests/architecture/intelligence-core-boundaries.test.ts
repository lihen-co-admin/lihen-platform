import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();

function filesUnder(dir: string): string[] {
  const absolute = join(root, dir);
  const results: string[] = [];

  for (const entry of readdirSync(absolute)) {
    const path = join(absolute, entry);
    if (statSync(path).isDirectory()) {
      results.push(...filesUnder(relative(root, path)));
    } else if (/\.ts$/.test(entry)) {
      results.push(path);
    }
  }

  return results;
}

function expectNoImport(dir: string, forbidden: RegExp): void {
  for (const file of filesUnder(dir)) {
    const source = readFileSync(file, 'utf8');
    expect(
      source,
      `${relative(root, file)} violates Intelligence Core boundary`,
    ).not.toMatch(forbidden);
  }
}

describe('Intelligence Core architecture — GAP-003', () => {
  it('does not depend on React, Supabase, database adapters, or Control Center application code', () => {
    expectNoImport(
      'packages/intelligence-core/src',
      /from\s+['"](?:react|@supabase\/|@lihen\/database)|from\s+['"][^'"]*apps\/control-center/i,
    );
  });

  it('does not expose direct mutation vocabulary as executable functions', () => {
    for (const file of filesUnder('packages/intelligence-core/src')) {
      const source = readFileSync(file, 'utf8');
      expect(source, `${relative(root, file)} contains a direct persistence call`).not.toMatch(
        /\.(?:insert|update|delete|upsert|rpc)\s*\(/,
      );
    }
  });

  it('exports the transversal contracts from a single package entry point', () => {
    const source = readFileSync(
      join(root, 'packages/intelligence-core/src/index.ts'),
      'utf8',
    );
    expect(source).toContain("export * from './contracts';");
  });
});
