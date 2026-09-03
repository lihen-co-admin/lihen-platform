import { describe, expect, it } from 'vitest';
import {
  composeCatalogPdfRenderSnapshot,
  toLegacyStyleRenderEntry,
} from '../catalog-pdf-render-model';
import type { CatalogRenderEntry } from '../catalogs';

function entry(
  overrides: Partial<CatalogRenderEntry> = {},
): CatalogRenderEntry {
  return {
    catalogVersionId: 'version-1',
    catalogCode: 'CAT-2026',
    catalogTitle: 'Catálogo LIHEN',
    versionLabel: 'V1',
    catalogStatus: 'DRAFT',
    catalogEntryId: 'entry-1',
    productId: 'product-1',
    sku: 'SKU-1',
    productCatalogCode: 'CAT-1',
    slug: 'product-1',
    productName: 'Producto 1',
    businessLine: 'BEAUTY_CARE',
    brand: 'Marca 1',
    category: 'Categoría',
    subcategory: null,
    description: 'Descripción',
    salePrice: 25000,
    imageUrl: 'https://example.test/product.jpg',
    imageAlt: 'Producto 1',
    sortOrder: 1,
    ...overrides,
  };
}

describe('GAP-024 PDF renderer model composition', () => {
  it('composes legacy projection input into CatalogRenderModelVNext', () => {
    const result = composeCatalogPdfRenderSnapshot([entry()], null, 'ALL');

    expect(result.model?.version.catalogVersionId).toBe('version-1');
    expect(result.model?.entries[0]?.selectedPdfAsset.resolutionSource).toBe(
      'LEGACY_RENDER_PROJECTION',
    );
    expect(result.model?.entries[0]?.salePriceSnapshot).toBe(25000);
  });

  it('moves line filtering into the Catalog Composer boundary', () => {
    const result = composeCatalogPdfRenderSnapshot(
      [
        entry(),
        entry({
          catalogEntryId: 'style-entry',
          productId: 'style-product',
          businessLine: 'STYLE',
        }),
      ],
      null,
      'STYLE',
    );

    expect(result.model?.entries).toHaveLength(1);
    expect(result.model?.entries[0]?.businessLine).toBe('STYLE');
  });

  it('keeps a compatibility seed only for deferred STYLE editorial work', () => {
    const source = entry();
    const result = composeCatalogPdfRenderSnapshot([source], null, 'STYLE');

    expect(result.model?.entries).toHaveLength(0);
    expect(result.stylePreviewSeed).toBe(source);
  });

  it('adapts VNext entries back to legacy STYLE shape without changing commercial data', () => {
    const result = composeCatalogPdfRenderSnapshot(
      [entry({ businessLine: 'STYLE' })],
      null,
      'STYLE',
    );
    const model = result.model;
    expect(model).not.toBeNull();

    const legacy = toLegacyStyleRenderEntry(
      model!.entries[0]!,
      model!.version,
    );

    expect(legacy.salePrice).toBe(25000);
    expect(legacy.imageUrl).toBe('https://example.test/product.jpg');
    expect(legacy.businessLine).toBe('STYLE');
  });

  it('rejects unsupported business lines before rendering', () => {
    expect(() =>
      composeCatalogPdfRenderSnapshot(
        [entry({ businessLine: 'OTHER' })],
        null,
        'ALL',
      ),
    ).toThrow(/does not support business line/);
  });

  it('returns no model when the legacy projection has no rows', () => {
    expect(composeCatalogPdfRenderSnapshot([], null, 'ALL')).toEqual({
      model: null,
      stylePreviewSeed: null,
    });
  });
});
