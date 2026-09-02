import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const assetSource = () =>
  readFileSync(
    join(root, 'packages/products/src/domain/product-asset.ts'),
    'utf8',
  );

describe('WAVE 4 / GAP-012 Product Assets 1:N architecture', () => {
  it('reuses ProductImage instead of creating a parallel media entity', () => {
    const source = assetSource();
    expect(source).toContain("import { ProductImage } from './product-image';");
    expect(source).toContain('export type ProductAsset = ProductImage;');
  });

  it('keeps Product Asset Set inside the products business domain', () => {
    const source = assetSource();
    expect(source).toContain('export class ProductAssetSet');
    expect(source).toContain('productId');
  });

  it('does not depend on React, Supabase, database or RPC infrastructure', () => {
    const source = assetSource();
    expect(source).not.toMatch(/react|@supabase\/|@lihen\/database/i);
    expect(source).not.toMatch(/\.rpc\s*\(|createClient|fetch\s*\(/);
  });

  it('does not absorb provenance or channel-selection implementation responsibilities', () => {
    const source = assetSource();
    expect(source).not.toMatch(
      /sourceAuthority|verificationScore|evidenceFingerprint/,
    );

    // GAP-012 may mention channel-selection terminology in comments to document
    // the boundary. What it must not implement is channel-selection state/API.
    expect(source).not.toMatch(
      /pdfSelected\s*[:=]|webSelected\s*[:=]|selectedPdfAsset\s*[:=]|selectedWebAssets\s*[:=]/i,
    );
    expect(source).not.toMatch(
      /selectPdfAsset\s*\(|selectWebAsset\s*\(|setPdfSelected\s*\(|setWebSelected\s*\(/i,
    );
  });

  it('documents generic main as compatibility rather than channel authority', () => {
    const source = assetSource();
    expect(source).toContain('Generic main is NOT PDF_SELECTED or WEB_SELECTED');
  });

  it('is exported by @lihen/products', () => {
    const index = readFileSync(
      join(root, 'packages/products/src/index.ts'),
      'utf8',
    );
    expect(index).toContain("export * from './domain/product-asset';");
  });
});
