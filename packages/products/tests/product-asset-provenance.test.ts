import { describe, expect, it } from 'vitest';
import {
  assertProductAssetProvenanceLink,
  ProductAssetProvenance,
  ProductImage,
} from '../src';

const SHA = 'a'.repeat(64);

const provenance = (
  overrides: Partial<ConstructorParameters<typeof ProductAssetProvenance>[0]> = {},
) =>
  new ProductAssetProvenance({
    id: 'source-1',
    productId: 'product-1',
    sourceType: 'SUPPLIER_PDF',
    sha256: SHA,
    mimeType: 'image/webp',
    ...overrides,
  });

const asset = (
  overrides: Partial<ConstructorParameters<typeof ProductImage>[0]> = {},
) =>
  new ProductImage({
    id: 'asset-1',
    productId: 'product-1',
    publicUrl: 'https://example.com/asset.webp',
    isMain: false,
    sortOrder: 0,
    sourceType: 'SUPPLIER_PDF',
    sourceId: 'source-1',
    ...overrides,
  });

describe('WAVE 4 / GAP-013 Asset Provenance', () => {
  it('models the existing provenance source types including SUPPLIER_DRIVE', () => {
    expect(
      provenance({ sourceType: 'SUPPLIER_DRIVE' }).sourceType,
    ).toBe('SUPPLIER_DRIVE');
  });

  it('preserves evidence identity and source metadata', () => {
    const source = provenance({
      sourceReferenceId: 'supplier-ref-7',
      sourceDocumentKey: 'catalog-2026-09',
      sourcePage: 7,
      supplierReference: 'SKU-42',
      sourceUrl: 'https://supplier.example/item',
      widthPx: 1200,
      heightPx: 1600,
      byteSize: 240000,
      qualityScore: 88.5,
      confidenceScore: 96,
    });

    expect(source.sourcePage).toBe(7);
    expect(source.supplierReference).toBe('SKU-42');
    expect(source.qualityScore).toBe(88.5);
    expect(source.confidenceScore).toBe(96);
  });

  it('requires a valid lowercase sha256 fingerprint', () => {
    expect(() => provenance({ sha256: 'ABC' })).toThrow(
      'Product asset provenance sha256 must be lowercase 64-char hex.',
    );
  });

  it('validates dimensions, page and byte size as positive integers', () => {
    expect(() => provenance({ sourcePage: 0 })).toThrow('sourcePage');
    expect(() => provenance({ widthPx: -1 })).toThrow('widthPx');
    expect(() => provenance({ byteSize: 1.5 })).toThrow('byteSize');
  });

  it('validates quality/confidence scores in the database range', () => {
    expect(() => provenance({ qualityScore: 101 })).toThrow('qualityScore');
    expect(() => provenance({ confidenceScore: -1 })).toThrow('confidenceScore');
  });

  it('enforces the existing HUMAN_APPROVED invariant', () => {
    expect(
      () =>
        provenance({
          reviewStatus: 'HUMAN_APPROVED',
          isExactProductMatch: false,
          requiresReview: false,
        }),
    ).toThrow(
      'HUMAN_APPROVED provenance requires exact product match and no pending review.',
    );

    expect(
      provenance({
        reviewStatus: 'HUMAN_APPROVED',
        isExactProductMatch: true,
        requiresReview: false,
      }).reviewStatus,
    ).toBe('HUMAN_APPROVED');
  });

  it('verifies the existing sourceId link between asset and provenance', () => {
    expect(() =>
      assertProductAssetProvenanceLink(asset(), provenance()),
    ).not.toThrow();

    expect(() =>
      assertProductAssetProvenanceLink(
        asset({ sourceId: 'source-other' }),
        provenance(),
      ),
    ).toThrow('Product asset sourceId must match provenance id.');
  });

  it('does not allow provenance from another Product Master to be linked', () => {
    expect(() =>
      assertProductAssetProvenanceLink(
        asset(),
        provenance({ productId: 'product-2' }),
      ),
    ).toThrow(
      'Product asset and provenance must belong to the same productId.',
    );
  });
});
