import { describe, expect, it } from 'vitest';
import {
  CATALOG_RENDER_MODEL_VNEXT_SCHEMA,
  createCatalogRenderModelVNext,
  type CatalogRenderModelVNextProps,
  type CatalogRenderProductSnapshot,
} from '../src';

function entry(
  overrides: Partial<CatalogRenderProductSnapshot> = {},
): CatalogRenderProductSnapshot {
  return {
    catalogEntryId: 'entry-1',
    catalogVersionId: 'version-1',
    productId: 'product-1',
    sku: 'SKU-1',
    productCatalogCode: 'CAT-1',
    slug: 'product-1',
    productName: 'Producto 1',
    businessLine: 'BEAUTY_CARE',
    brand: {
      brandId: 'brand-1',
      name: 'Marca 1',
      visual: {
        source: 'CANONICAL_BRAND_ASSET',
        assetId: 'brand-asset-1',
        publicUrl: 'https://example.test/brand.svg',
        kind: 'LOGO',
        approvalMode: 'MANUAL_VERIFIED',
      },
    },
    category: 'Categoría',
    subcategory: null,
    description: 'Descripción',
    salePriceSnapshot: 25000,
    selectedPdfAsset: {
      assetId: 'asset-1',
      publicUrl: 'https://example.test/product.jpg',
      altText: 'Producto 1',
      sourceId: 'source-1',
      resolutionSource: 'CHANNEL_SELECTION',
    },
    sortOrder: 1,
    ...overrides,
  };
}

function props(
  entries: readonly CatalogRenderProductSnapshot[] = [entry()],
): CatalogRenderModelVNextProps {
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

describe('GAP-022 Catalog Render Model VNext', () => {
  it('creates a renderer-ready immutable contract with an explicit schema version', () => {
    const model = createCatalogRenderModelVNext(props());
    expect(model.schemaVersion).toBe(CATALOG_RENDER_MODEL_VNEXT_SCHEMA);
    expect(model.entries).toHaveLength(1);
    expect(Object.isFrozen(model.entries)).toBe(true);
    expect(Object.isFrozen(model.entries[0])).toBe(true);
  });

  it('sorts entries deterministically by sortOrder and catalogEntryId', () => {
    const model = createCatalogRenderModelVNext(
      props([
        entry({ catalogEntryId: 'entry-b', sortOrder: 2 }),
        entry({ catalogEntryId: 'entry-c', sortOrder: 1 }),
        entry({ catalogEntryId: 'entry-a', sortOrder: 1 }),
      ]),
    );

    expect(model.entries.map((item) => item.catalogEntryId)).toEqual([
      'entry-a',
      'entry-c',
      'entry-b',
    ]);
  });

  it('rejects entries from another catalog version', () => {
    expect(() =>
      createCatalogRenderModelVNext(
        props([entry({ catalogVersionId: 'other-version' })]),
      ),
    ).toThrow(/same catalogVersionId/);
  });

  it('rejects duplicate catalog entry ids', () => {
    expect(() =>
      createCatalogRenderModelVNext(
        props([
          entry({ productId: 'product-1' }),
          entry({ productId: 'product-2' }),
        ]),
      ),
    ).toThrow(/duplicate catalogEntryId/);
  });

  it('requires selected Product Asset identity for CHANNEL_SELECTION', () => {
    expect(() =>
      createCatalogRenderModelVNext(
        props([
          entry({
            selectedPdfAsset: {
              assetId: null,
              publicUrl: 'https://example.test/product.jpg',
              altText: null,
              sourceId: null,
              resolutionSource: 'CHANNEL_SELECTION',
            },
          }),
        ]),
      ),
    ).toThrow(/selected Product Asset id/);
  });

  it('allows the current render projection only as explicit legacy compatibility', () => {
    const model = createCatalogRenderModelVNext(
      props([
        entry({
          selectedPdfAsset: {
            assetId: null,
            publicUrl: 'https://example.test/legacy.jpg',
            altText: null,
            sourceId: null,
            resolutionSource: 'LEGACY_RENDER_PROJECTION',
          },
          brand: {
            brandId: null,
            name: 'Legacy Brand',
            visual: {
              source: 'LEGACY_COMPATIBILITY',
              assetId: null,
              publicUrl: 'https://example.test/legacy-logo.png',
              kind: null,
              approvalMode: null,
            },
          },
        }),
      ]),
    );

    expect(model.entries[0]?.selectedPdfAsset.resolutionSource).toBe(
      'LEGACY_RENDER_PROJECTION',
    );
    expect(model.entries[0]?.brand.visual.source).toBe(
      'LEGACY_COMPATIBILITY',
    );
  });

  it('does not let TEXT_ONLY brand identity masquerade as an asset', () => {
    expect(() =>
      createCatalogRenderModelVNext(
        props([
          entry({
            brand: {
              brandId: 'brand-1',
              name: 'Marca 1',
              visual: {
                source: 'TEXT_ONLY',
                assetId: 'fake-asset',
                publicUrl: null,
                kind: null,
                approvalMode: null,
              },
            },
          }),
        ]),
      ),
    ).toThrow(/TEXT_ONLY/);
  });

  it('enforces the requested business-line scope', () => {
    const scoped = props([entry({ businessLine: 'STYLE' })]);
    expect(() =>
      createCatalogRenderModelVNext({ ...scoped, scope: 'BEAUTY_CARE' }),
    ).toThrow(/render scope/);
  });

  it('rejects negative commercial snapshots and non-integer ordering', () => {
    expect(() =>
      createCatalogRenderModelVNext(
        props([entry({ salePriceSnapshot: -1 })]),
      ),
    ).toThrow(/salePriceSnapshot/);

    expect(() =>
      createCatalogRenderModelVNext(props([entry({ sortOrder: 1.5 })])),
    ).toThrow(/sortOrder/);
  });
});
