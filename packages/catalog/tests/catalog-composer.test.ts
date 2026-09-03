import { describe, expect, it } from 'vitest';
import {
  composeCatalogRenderModel,
  type CatalogComposerInput,
  type CatalogComposerSourceEntry,
} from '../src';

function sourceEntry(
  overrides: Partial<CatalogComposerSourceEntry> = {},
): CatalogComposerSourceEntry {
  return {
    catalogEntryId: 'entry-1',
    catalogVersionId: 'version-1',
    productId: 'product-1',
    sku: 'SKU-1',
    productCatalogCode: 'CAT-1',
    slug: 'product-1',
    productName: 'Producto 1',
    businessLine: 'BEAUTY_CARE',
    brandId: null,
    brandName: 'Marca 1',
    category: 'Categoría',
    subcategory: null,
    description: 'Descripción',
    salePriceSnapshot: 25000,
    legacyImageUrl: 'https://example.test/legacy-product.jpg',
    legacyImageAlt: 'Producto 1',
    sortOrder: 1,
    ...overrides,
  };
}

function input(
  entries: readonly CatalogComposerSourceEntry[] = [sourceEntry()],
): CatalogComposerInput {
  return {
    version: {
      catalogVersionId: 'version-1',
      catalogCode: 'CAT-2026',
      catalogTitle: 'Catálogo LIHEN',
      versionLabel: 'V1',
      catalogStatus: 'DRAFT',
    },
    scope: 'ALL',
    entries,
    institutional: null,
  };
}

describe('GAP-023 Catalog Composer', () => {
  it('composes the current render projection as explicit legacy compatibility', () => {
    const result = composeCatalogRenderModel(input());

    expect(result.model.entries).toHaveLength(1);
    expect(result.model.entries[0]?.selectedPdfAsset).toEqual({
      assetId: null,
      publicUrl: 'https://example.test/legacy-product.jpg',
      altText: 'Producto 1',
      sourceId: null,
      resolutionSource: 'LEGACY_RENDER_PROJECTION',
    });
    expect(result.legacyAssetFallbackCount).toBe(1);
    expect(result.channelSelectedAssetCount).toBe(0);
  });

  it('uses an already-resolved CATALOG_PDF Channel Selection without treating fallback as authority', () => {
    const result = composeCatalogRenderModel(
      input([
        sourceEntry({
          resolvedPdfAsset: {
            assetId: 'asset-verified',
            publicUrl: 'https://example.test/verified.jpg',
            altText: 'Verified product',
            sourceId: 'source-verified',
          },
        }),
      ]),
    );

    expect(result.model.entries[0]?.selectedPdfAsset).toEqual({
      assetId: 'asset-verified',
      publicUrl: 'https://example.test/verified.jpg',
      altText: 'Verified product',
      sourceId: 'source-verified',
      resolutionSource: 'CHANNEL_SELECTION',
    });
    expect(result.channelSelectedAssetCount).toBe(1);
    expect(result.legacyAssetFallbackCount).toBe(0);
  });

  it('filters by render scope before creating the VNext model', () => {
    const result = composeCatalogRenderModel({
      ...input([
        sourceEntry({
          catalogEntryId: 'beauty',
          productId: 'beauty-product',
          sortOrder: 2,
        }),
        sourceEntry({
          catalogEntryId: 'style',
          productId: 'style-product',
          businessLine: 'STYLE',
          sortOrder: 1,
        }),
      ]),
      scope: 'STYLE',
    });

    expect(result.sourceEntryCount).toBe(2);
    expect(result.composedEntryCount).toBe(1);
    expect(result.filteredEntryCount).toBe(1);
    expect(result.model.entries[0]?.catalogEntryId).toBe('style');
    expect(result.model.scope).toBe('STYLE');
  });

  it('projects an already-resolved canonical Brand Asset', () => {
    const result = composeCatalogRenderModel(
      input([
        sourceEntry({
          brandId: 'brand-1',
          brandVisual: {
            source: 'CANONICAL_BRAND_ASSET',
            assetId: 'brand-asset-1',
            publicUrl: 'https://example.test/brand.svg',
            kind: 'LOGO',
            approvalMode: 'MANUAL_VERIFIED',
          },
        }),
      ]),
    );

    expect(result.model.entries[0]?.brand.visual).toEqual({
      source: 'CANONICAL_BRAND_ASSET',
      assetId: 'brand-asset-1',
      publicUrl: 'https://example.test/brand.svg',
      kind: 'LOGO',
      approvalMode: 'MANUAL_VERIFIED',
    });
    expect(result.canonicalBrandVisualCount).toBe(1);
  });

  it('keeps a legacy brand visual explicitly non-canonical', () => {
    const result = composeCatalogRenderModel(
      input([
        sourceEntry({
          brandVisual: {
            source: 'LEGACY_COMPATIBILITY',
            assetId: null,
            publicUrl: 'https://example.test/legacy-brand.png',
            kind: 'LOGO',
          },
        }),
      ]),
    );

    expect(result.model.entries[0]?.brand.visual.source).toBe(
      'LEGACY_COMPATIBILITY',
    );
    expect(result.model.entries[0]?.brand.visual.approvalMode).toBeNull();
    expect(result.legacyBrandVisualCount).toBe(1);
  });

  it('uses TEXT_ONLY when no resolved brand visual exists', () => {
    const result = composeCatalogRenderModel(input());

    expect(result.model.entries[0]?.brand.visual).toEqual({
      source: 'TEXT_ONLY',
      assetId: null,
      publicUrl: null,
      kind: null,
      approvalMode: null,
    });
    expect(result.textOnlyBrandCount).toBe(1);
  });

  it('rejects canonical Brand Asset input without canonical brandId', () => {
    expect(() =>
      composeCatalogRenderModel(
        input([
          sourceEntry({
            brandId: null,
            brandVisual: {
              source: 'CANONICAL_BRAND_ASSET',
              assetId: 'brand-asset-1',
              publicUrl: 'https://example.test/brand.svg',
              kind: 'LOGO',
              approvalMode: 'AUTO_VERIFIED',
            },
          }),
        ]),
      ),
    ).toThrow(/requires brandId/);
  });

  it('rejects entries without either a resolved PDF asset or a legacy fallback', () => {
    expect(() =>
      composeCatalogRenderModel(
        input([
          sourceEntry({
            legacyImageUrl: null,
          }),
        ]),
      ),
    ).toThrow(/no resolved CATALOG_PDF asset/);
  });

  it('rejects source entries from another catalog version and duplicate entry ids', () => {
    expect(() =>
      composeCatalogRenderModel(
        input([sourceEntry({ catalogVersionId: 'other-version' })]),
      ),
    ).toThrow(/requested catalogVersionId/);

    expect(() =>
      composeCatalogRenderModel(
        input([
          sourceEntry({ productId: 'product-a' }),
          sourceEntry({ productId: 'product-b' }),
        ]),
      ),
    ).toThrow(/duplicate catalogEntryId/);
  });

  it('delegates immutable ordering and commercial invariants to CatalogRenderModelVNext', () => {
    const result = composeCatalogRenderModel(
      input([
        sourceEntry({
          catalogEntryId: 'entry-b',
          productId: 'product-b',
          sortOrder: 2,
        }),
        sourceEntry({
          catalogEntryId: 'entry-a',
          productId: 'product-a',
          sortOrder: 1,
        }),
      ]),
    );

    expect(result.model.entries.map((entry) => entry.catalogEntryId)).toEqual([
      'entry-a',
      'entry-b',
    ]);
    expect(Object.isFrozen(result.model.entries)).toBe(true);

    expect(() =>
      composeCatalogRenderModel(
        input([sourceEntry({ salePriceSnapshot: -1 })]),
      ),
    ).toThrow(/salePriceSnapshot/);
  });
});
