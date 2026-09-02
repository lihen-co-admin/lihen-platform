import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const domainPath = resolve(
  root,
  'packages/products/src/domain/product-channel-asset-selection.ts',
);
const indexPath = resolve(root, 'packages/products/src/index.ts');

describe('WAVE 4 / GAP-014 channel asset selection architecture', () => {
  const source = readFileSync(domainPath, 'utf8');

  it('lives in the products domain and reuses ProductAsset', () => {
    expect(source).toContain("import type { ProductAsset } from './product-asset';");
  });

  it('formalizes PDF and Web surfaces without using generic isMain as channel selection', () => {
    expect(source).toContain("'CATALOG_PDF'");
    expect(source).toContain("'WEB_CARD'");
    expect(source).toContain("'WEB_DETAIL'");
    expect(source).not.toMatch(/\.isMain\s*===|isMain\s*:/);
  });

  it('does not absorb provenance responsibilities from GAP-013', () => {
    expect(source).not.toMatch(
      /sha256\s*[:=]|sourceAuthority\s*[:=]|supplierReference\s*[:=]|sourcePage\s*[:=]/,
    );
  });

  it('does not persist, publish or couple to infrastructure', () => {
    expect(source).not.toMatch(
      /@supabase|@lihen\/database|createClient\s*\(|\.rpc\s*\(|fetch\s*\(|INSERT|UPDATE|DELETE/,
    );
    expect(source).not.toMatch(/React|useState|useEffect|publishCatalog/i);
  });

  it('keeps source-readiness selection as a separate existing concern', () => {
    expect(source).not.toContain("from './product-media-source-selection'");
    expect(source).not.toContain("from './product-media-readiness'");
  });

  it('is exported by @lihen/products', () => {
    const index = readFileSync(indexPath, 'utf8');
    expect(index).toContain(
      "export * from './domain/product-channel-asset-selection';",
    );
  });
});
