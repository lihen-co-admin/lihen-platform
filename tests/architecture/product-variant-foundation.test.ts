import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const variantSource = () =>
  readFileSync(
    join(root, 'packages/products/src/domain/product-variant.ts'),
    'utf8',
  );

describe('WAVE 4 / GAP-011 Product Variant architecture', () => {
  it('keeps Product Variant in the products business domain', () => {
    const source = variantSource();
    expect(source).toContain('export class ProductVariant');
    expect(source).toContain('productId');
  });

  it('does not depend on React, Supabase, database or infrastructure', () => {
    const source = variantSource();
    expect(source).not.toMatch(/react|@supabase\/|@lihen\/database/i);
    expect(source).not.toMatch(/\.rpc\s*\(|createClient|fetch\s*\(/);
  });

  it('does not duplicate pricing, inventory, assets or supplier authority', () => {
    const source = variantSource();
    expect(source).not.toMatch(/salePrice|currentCost|stockOnHand|imageUrl|supplierId/);
  });

  it('keeps fingerprint explicitly non-canonical', () => {
    const source = variantSource();
    expect(source).toContain('must never replace Product Master identity');
  });

  it('is exported by @lihen/products', () => {
    const index = readFileSync(
      join(root, 'packages/products/src/index.ts'),
      'utf8',
    );
    expect(index).toContain("export * from './domain/product-variant';");
  });
});
