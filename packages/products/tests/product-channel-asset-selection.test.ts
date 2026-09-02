import { describe, expect, it } from 'vitest';
import {
  buildProductChannelAssetSelections,
  ProductChannelAssetSelection,
  ProductImage,
} from '../src';

const asset = (
  id: string,
  overrides: Partial<ConstructorParameters<typeof ProductImage>[0]> = {},
) =>
  new ProductImage({
    id,
    productId: 'product-1',
    publicUrl: `https://example.com/${id}.webp`,
    isMain: false,
    sortOrder: 0,
    sourceType: 'OFFICIAL_WEB',
    ...overrides,
  });

describe('WAVE 4 / GAP-014 Channel Asset Selection', () => {
  it('requires exactly one CATALOG_PDF asset', () => {
    expect(
      () =>
        new ProductChannelAssetSelection({
          productId: 'product-1',
          channel: 'CATALOG_PDF',
          assetIds: [],
        }),
    ).toThrow('CATALOG_PDF requires exactly one selected asset.');

    expect(
      () =>
        new ProductChannelAssetSelection({
          productId: 'product-1',
          channel: 'CATALOG_PDF',
          assetIds: ['asset-1', 'asset-2'],
        }),
    ).toThrow('CATALOG_PDF requires exactly one selected asset.');
  });

  it('allows Web detail to select zero or many assets', () => {
    expect(
      new ProductChannelAssetSelection({
        productId: 'product-1',
        channel: 'WEB_DETAIL',
        assetIds: [],
      }).assetIds,
    ).toEqual([]);

    expect(
      new ProductChannelAssetSelection({
        productId: 'product-1',
        channel: 'WEB_DETAIL',
        assetIds: ['asset-1', 'asset-2'],
      }).assetIds,
    ).toEqual(['asset-1', 'asset-2']);
  });

  it('keeps WEB_CARD singular without conflating it with generic isMain', () => {
    expect(
      new ProductChannelAssetSelection({
        productId: 'product-1',
        channel: 'WEB_CARD',
        assetIds: ['asset-2'],
      }).assetIds,
    ).toEqual(['asset-2']);

    expect(
      () =>
        new ProductChannelAssetSelection({
          productId: 'product-1',
          channel: 'WEB_CARD',
          assetIds: ['asset-1', 'asset-2'],
        }),
    ).toThrow('WEB_CARD supports at most one selected asset.');
  });

  it('rejects duplicate asset IDs inside a channel selection', () => {
    expect(
      () =>
        new ProductChannelAssetSelection({
          productId: 'product-1',
          channel: 'WEB_DETAIL',
          assetIds: ['asset-1', 'asset-1'],
        }),
    ).toThrow('cannot contain duplicate assetIds');
  });

  it('requires selected assets to exist, be ACTIVE and belong to the product', () => {
    const pdf = new ProductChannelAssetSelection({
      productId: 'product-1',
      channel: 'CATALOG_PDF',
      assetIds: ['asset-1'],
    });

    expect(() =>
      buildProductChannelAssetSelections('product-1', [], [pdf]),
    ).toThrow('does not exist');

    expect(() =>
      buildProductChannelAssetSelections(
        'product-1',
        [asset('asset-1', { status: 'ARCHIVED' })],
        [pdf],
      ),
    ).toThrow('must be ACTIVE');

    expect(() =>
      buildProductChannelAssetSelections(
        'product-1',
        [asset('asset-1', { productId: 'product-2' })],
        [pdf],
      ),
    ).toThrow('same productId');
  });

  it('requires one PDF channel selection and unique channel records', () => {
    const assets = [asset('asset-1'), asset('asset-2')];

    const pdf = new ProductChannelAssetSelection({
      productId: 'product-1',
      channel: 'CATALOG_PDF',
      assetIds: ['asset-1'],
    });
    const web = new ProductChannelAssetSelection({
      productId: 'product-1',
      channel: 'WEB_DETAIL',
      assetIds: ['asset-1', 'asset-2'],
    });

    expect(
      buildProductChannelAssetSelections('product-1', assets, [pdf, web]),
    ).toHaveLength(2);

    expect(() =>
      buildProductChannelAssetSelections('product-1', assets, [web]),
    ).toThrow('A CATALOG_PDF selection is required.');

    expect(() =>
      buildProductChannelAssetSelections('product-1', assets, [pdf, pdf]),
    ).toThrow('Duplicate channel selection: CATALOG_PDF.');
  });

  it('does not require selected channel asset to be generic main', () => {
    const assets = [asset('asset-1', { isMain: false })];
    const pdf = new ProductChannelAssetSelection({
      productId: 'product-1',
      channel: 'CATALOG_PDF',
      assetIds: ['asset-1'],
    });

    expect(
      buildProductChannelAssetSelections('product-1', assets, [pdf])[0]?.assetIds,
    ).toEqual(['asset-1']);
  });
});
