import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const domainPath = resolve(
  root,
  'packages/suppliers/src/domain/supplier-source-intake.ts',
);
const indexPath = resolve(root, 'packages/suppliers/src/index.ts');

describe('WAVE 6 / GAP-018 Supplier Document Canonical Intake architecture', () => {
  const source = readFileSync(domainPath, 'utf8');
  const index = readFileSync(indexPath, 'utf8');

  it('lives in the canonical suppliers package and is exported publicly', () => {
    expect(index).toContain(
      "export * from './domain/supplier-source-intake';",
    );
  });

  it('models the current controlled intake vocabulary without a parallel persistence system', () => {
    expect(source).toContain("'PDF'");
    expect(source).toContain("'XLSX'");
    expect(source).toContain("'CSV'");
    expect(source).toContain("'READY_FOR_CANDIDATES'");
    expect(source).toContain("'REVIEW_REQUIRED'");
    expect(source).toContain('sourceSha256');
    expect(source).toContain('sourceRowKey');
  });

  it('does not couple the supplier domain to React, Supabase or database infrastructure', () => {
    expect(source).not.toMatch(/from ['"]react['"]/);
    expect(source).not.toMatch(/@supabase\//);
    expect(source).not.toMatch(/@lihen\/database/);
    expect(source).not.toMatch(/\.rpc\s*\(/);
    expect(source).not.toMatch(/createClient\s*\(/);
  });

  it('does not absorb GAP-019 Document Intelligence', () => {
    expect(source).not.toMatch(/@lihen\/intelligence-core/);
    expect(source).not.toMatch(/DocumentExtractionPort/);
    expect(source).not.toMatch(/VisionPort/);
    expect(source).not.toMatch(/SearchPort/);
  });

  it('does not create Product Master, pricing, purchase or publication mutations', () => {
    expect(source).not.toMatch(/createProduct/i);
    expect(source).not.toMatch(/updateProduct/i);
    expect(source).not.toMatch(/changeProductSalePrice/i);
    expect(source).not.toMatch(/receivePurchase/i);
    expect(source).not.toMatch(/publishCatalog/i);
  });

  it('keeps supplier observations as evidence rather than canonical decisions', () => {
    expect(source).toContain('supplierReference');
    expect(source).toContain('brandText');
    expect(source).toContain('unitCost');
    expect(source).toContain('extractionConfidence');
    expect(source).toContain('evidence');
  });
});
