import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();

const reactOrSupabaseImport = /from\s+['"](?:react|@supabase\/)/i;
const controlCenterPersistenceImport = /from\s+['"](?:@supabase\/|@lihen\/database)|SupabaseProductRepository|InMemoryProductRepository/i;

function filesUnder(dir: string): string[] {
  const absolute = join(root, dir);
  const results: string[] = [];
  for (const entry of readdirSync(absolute)) {
    const path = join(absolute, entry);
    if (statSync(path).isDirectory()) results.push(...filesUnder(relative(root, path)));
    else if (/\.(ts|tsx)$/.test(entry)) results.push(path);
  }
  return results;
}

function expectNoImport(dir: string, forbidden: RegExp): void {
  for (const file of filesUnder(dir)) {
    const source = readFileSync(file, 'utf8');
    expect(source, `${relative(root, file)} violates dependency boundary`).not.toMatch(forbidden);
  }
}

describe('architecture boundaries', () => {
  it('dependency guardrails detect lowercase Supabase imports', () => {
    expect("import { createClient } from '@supabase/supabase-js';").toMatch(reactOrSupabaseImport);
    expect("import { createClient } from '@supabase/supabase-js';").toMatch(controlCenterPersistenceImport);
  });

  it(
    'packages never import applications',
    () => {
      expectNoImport('packages', /from\s+['"][^'"]*apps\//);
    },
    30_000,
  );

  it('product domain does not depend on React or Supabase', () => {
    expectNoImport('packages/products/src/domain', reactOrSupabaseImport);
  });

  it('core events and strategies do not depend on React or Supabase', () => {
    expectNoImport('packages/core/src', reactOrSupabaseImport);
  });

  it('supplier domain does not depend on React or Supabase', () => {
    expectNoImport('packages/suppliers/src/domain', reactOrSupabaseImport);
  });

  it('procurement domain does not depend on React or Supabase', () => {
    expectNoImport('packages/procurement/src/domain', reactOrSupabaseImport);
  });

  it('inventory domain does not depend on React or Supabase', () => {
    expectNoImport('packages/inventory/src/domain', reactOrSupabaseImport);
  });

  it('orders domain does not depend on React or Supabase', () => {
    expectNoImport('packages/orders/src/domain', reactOrSupabaseImport);
  });

  it('sales domain does not depend on React or Supabase', () => {
    expectNoImport('packages/sales/src/domain', reactOrSupabaseImport);
  });

  it('finance domain does not depend on React or Supabase', () => {
    expectNoImport('packages/finance/src/domain', reactOrSupabaseImport);
  });

  it('catalog domain does not depend on React or Supabase', () => {
    expectNoImport('packages/catalog/src/domain', reactOrSupabaseImport);
  });

  it('public hub domain does not depend on React or Supabase', () => {
    expectNoImport('packages/public-hub/src/domain', reactOrSupabaseImport);
  });

  it('shared does not depend on business domains', () => {
    expectNoImport('packages/shared/src', /from\s+['"]@lihen\/(?:products|suppliers|inventory|sales|finance|catalog)/);
  });

  it('storefront does not import private administrative domains', () => {
    expectNoImport('apps/storefront/src', /from\s+['"]@lihen\/(?:finance|suppliers|inventory|procurement)/);
  });

  it('Control Center RPC names stay within PostgreSQL identifier limits', () => {
    const rpcCall = /\.rpc\(\s*['"]([^'"]+)['"]/g;
    for (const file of filesUnder('apps/control-center/src')) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(rpcCall)) {
        const rpcName = match[1] ?? '';
        expect(
          Buffer.byteLength(rpcName, 'utf8'),
          `${relative(root, file)} calls RPC ${rpcName} beyond PostgreSQL's 63-byte identifier limit`,
        ).toBeLessThanOrEqual(63);
      }
    }
  });

  it('Control Center pages do not import persistence adapters directly', () => {
    expectNoImport(
      'apps/control-center/src/pages',
      controlCenterPersistenceImport,
    );
  });
});
