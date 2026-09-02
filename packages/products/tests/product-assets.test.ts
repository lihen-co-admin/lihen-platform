import { describe, expect, it } from 'vitest';
import { ProductAssetSet, ProductImage } from '../src';

const image = (
  overrides: Partial<ConstructorParameters<typeof ProductImage>[0]> = {},
) =>
  new ProductImage({
    id: 'asset-1',
    productId: 'product-1',
    publicUrl: 'https://example.com/asset-1.webp',
    isMain: false,
    sortOrder: 0,
    sourceType: 'MANUAL',
    ...overrides,
  });

describe('WAVE 4 / GAP-012 Product Assets 1:N', () => {
  it('allows a product to have zero, one or multiple assets', () => {
    expect(new ProductAssetSet({ productId: 'product-1' }).size()).toBe(0);
    expect(
      new ProductAssetSet({ productId: 'product-1', assets: [image()] }).size(),
    ).toBe(1);
    expect(
      new ProductAssetSet({
        productId: 'product-1',
        assets: [image(), image({ id: 'asset-2', sortOrder: 1 })],
      }).size(),
    ).toBe(2);
  });

  it('requires every asset to belong to the same Product Master', () => {
    expect(
      () =>
        new ProductAssetSet({
          productId: 'product-1',
          assets: [image({ productId: 'product-2' })],
        }),
    ).toThrow('All product assets must belong to the same productId.');
  });

  it('rejects duplicate asset IDs inside one product collection', () => {
    expect(
      () =>
        new ProductAssetSet({
          productId: 'product-1',
          assets: [image(), image({ sortOrder: 1 })],
        }),
    ).toThrow('Product asset IDs must be unique within the set.');
  });

  it('returns active assets in deterministic sortOrder + id order', () => {
    const set = new ProductAssetSet({
      productId: 'product-1',
      assets: [
        image({ id: 'asset-b', sortOrder: 1 }),
        image({ id: 'asset-c', sortOrder: 0 }),
        image({ id: 'asset-a', sortOrder: 1 }),
        image({ id: 'asset-z', sortOrder: 0, status: 'ARCHIVED' }),
      ],
    });

    expect(set.active().map((asset) => asset.id)).toEqual([
      'asset-c',
      'asset-a',
      'asset-b',
    ]);
    expect(set.archived().map((asset) => asset.id)).toEqual(['asset-z']);
  });

  it('allows at most one ACTIVE generic main asset', () => {
    expect(
      () =>
        new ProductAssetSet({
          productId: 'product-1',
          assets: [
            image({ id: 'asset-1', isMain: true }),
            image({ id: 'asset-2', isMain: true, sortOrder: 1 }),
          ],
        }),
    ).toThrow(
      'Product asset set can contain at most one ACTIVE generic main asset.',
    );
  });

  it('does not treat archived main history as an active main conflict', () => {
    const set = new ProductAssetSet({
      productId: 'product-1',
      assets: [
        image({ id: 'asset-old', isMain: true, status: 'ARCHIVED' }),
        image({ id: 'asset-current', isMain: true, sortOrder: 1 }),
      ],
    });

    expect(set.genericMain()?.id).toBe('asset-current');
  });

  it('keeps generic main separate from channel selection semantics', () => {
    const set = new ProductAssetSet({
      productId: 'product-1',
      assets: [image({ isMain: true })],
    });

    expect(set.genericMain()?.isMain).toBe(true);
    expect('pdfSelected' in set).toBe(false);
    expect('webSelected' in set).toBe(false);
  });
});
