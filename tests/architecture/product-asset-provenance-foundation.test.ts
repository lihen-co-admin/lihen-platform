import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const source = () =>
  readFileSync(
    join(root, 'packages/products/src/domain/product-asset-provenance.ts'),
    'utf8',
  );

describe('WAVE 4 / GAP-013 Asset Provenance architecture', () => {
  it('keeps provenance inside the products business domain', () => {
    expect(source()).toContain('export class ProductAssetProvenance');
    expect(source()).toContain('assertProductAssetProvenanceLink');
  });

  it('reuses ProductImage sourceId instead of creating a parallel asset identity', () => {
    const value = source();
    expect(value).toContain("import type { ProductImage } from './product-image';");
    expect(value).toContain('asset.sourceId');
    expect(value).not.toMatch(/class\s+ProductAssetEntity|class\s+ParallelProductImage/);
  });

  it('does not depend on React, Supabase, database or RPC infrastructure', () => {
    const value = source();
    expect(value).not.toMatch(/from ['"]react['"]|@supabase\/|@lihen\/database/);
    expect(value).not.toMatch(/\.rpc\s*\(|createClient|fetch\s*\(/);
  });

  it('does not implement channel-selection state or APIs', () => {
    const value = source();
    expect(value).not.toMatch(
      /pdfSelected\s*[:=]|webSelected\s*[:=]|selectedPdfAsset\s*[:=]|selectedWebAssets\s*[:=]/i,
    );
    expect(value).not.toMatch(
      /selectPdfAsset\s*\(|selectWebAsset\s*\(|setPdfSelected\s*\(|setWebSelected\s*\(/i,
    );
  });

  it('documents the existing physical sourceId provenance relationship', () => {
    const value = source();
    expect(value).toContain(
      'public.product_images.source_id -> lihen_private.product_image_sources.id',
    );
  });

  it('is exported by @lihen/products', () => {
    const index = readFileSync(
      join(root, 'packages/products/src/index.ts'),
      'utf8',
    );
    expect(index).toContain(
      "export * from './domain/product-asset-provenance';",
    );
  });

  it('keeps SUPPLIER_DRIVE aligned across operational source handling', () => {
    const image = readFileSync(
      join(root, 'packages/products/src/domain/product-image.ts'),
      'utf8',
    );
    const readiness = readFileSync(
      join(root, 'packages/products/src/domain/product-media-readiness.ts'),
      'utf8',
    );
    const selection = readFileSync(
      join(root, 'packages/products/src/domain/product-media-source-selection.ts'),
      'utf8',
    );

    expect(image).toContain("| 'SUPPLIER_DRIVE'");
    expect(readiness).toContain("'SUPPLIER_DRIVE'");
    expect(selection).toContain('SUPPLIER_DRIVE:');
  });
});
