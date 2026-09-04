import { describe, expect, it } from 'vitest';
import type { CatalogRenderProductSnapshot } from '@lihen/catalog';
import {
  resolveStyleEditorialAsset,
  STYLE_EDITORIAL_POLICY,
} from '../src/composition/catalog-style-editorial-policy';

function entry(
  businessLine: CatalogRenderProductSnapshot['businessLine'] = 'STYLE',
): CatalogRenderProductSnapshot {
  return {
    catalogEntryId: 'entry-1',
    catalogVersionId: 'version-1',
    productId: 'product-1',
    sku: 'S01',
    productCatalogCode: 'STYLE-001',
    slug: 'style-product',
    productName: 'Producto STYLE',
    businessLine,
    brand: {
      brandId: null,
      name: 'LIHEN STYLE',
      visual: {
        source: 'TEXT_ONLY',
        assetId: null,
        publicUrl: null,
        kind: null,
        approvalMode: null,
      },
    },
    category: 'Conjuntos',
    subcategory: 'Deportivo',
    description: null,
    salePriceSnapshot: 65000,
    selectedPdfAsset: {
      assetId: 'asset-1',
      publicUrl: 'https://cdn.example/style-001.png',
      altText: 'Producto STYLE',
      sourceId: 'selection-1',
      resolutionSource: 'CHANNEL_SELECTION',
    },
    sortOrder: 10,
  };
}

describe('GAP-026 STYLE editorial policy', () => {
  it('derives an editorial presentation asset without acquiring canonical authority', () => {
    const resolved = resolveStyleEditorialAsset(entry());

    expect(resolved).toEqual({
      role: 'EDITORIAL_PRESENTATION',
      canonicalAuthority: false,
      mutationAllowed: false,
      sourceAssetId: 'asset-1',
      sourcePublicUrl: 'https://cdn.example/style-001.png',
      sourceAltText: 'Producto STYLE',
      sourceId: 'selection-1',
      sourceResolution: 'CHANNEL_SELECTION',
    });
  });

  it('keeps editorial preparation separate from Product Asset mutation or replacement', () => {
    expect(STYLE_EDITORIAL_POLICY).toMatchObject({
      renderContract: 'CATALOG_RENDER_MODEL_VNEXT',
      editorialAssetRole: 'PRESENTATION_ONLY',
      editorialAssetIsCanonical: false,
      productAssetMutationAllowed: false,
      selectedPdfAssetReplacementAllowed: false,
    });
  });

  it('rejects non-STYLE entries', () => {
    expect(() => resolveStyleEditorialAsset(entry('BEAUTY_CARE'))).toThrow(
      'STYLE editorial policy only accepts STYLE render entries.',
    );
  });
});
