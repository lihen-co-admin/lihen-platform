import { describe, expect, it } from 'vitest';
import { FakeIdGenerator } from '@lihen/core';
import { Money } from '@lihen/shared';
import {
  AddProductImageHandler,
  InMemoryProductImageRepository,
  InMemoryProductRepository,
  LegacyMainImageBackfillMapper,
  Product,
  ProductImage,
  SetMainProductImageHandler,
  createAddProductImageCommand,
  createSetMainProductImageCommand,
} from '../src';

function product(): Product {
  return new Product({ businessLine:'BEAUTY_CARE',
    id: 'p-1',
    sku: 'BC-001',
    name: 'Producto prueba',
    status: 'ACTIVE',
    salePrice: new Money(20_000, 'COP'),
  });
}

describe('FASE 1.7 product images', () => {
  it('makes the first image main automatically', async () => {
    const products = new InMemoryProductRepository([product()]);
    const images = new InMemoryProductImageRepository();
    const handler = new AddProductImageHandler(products, images, new FakeIdGenerator('img-1'));

    const result = await handler.execute(
      createAddProductImageCommand({ productId: 'p-1', publicUrl: 'https://example.com/a.jpg' }),
    );

    expect(result.isMain).toBe(true);
    expect((await images.findByProductId('p-1')).filter((image) => image.isMain)).toHaveLength(1);
  });

  it('keeps exactly one main image when a new main image is added', async () => {
    const first = new ProductImage({
      id: 'img-1', productId: 'p-1', publicUrl: 'https://example.com/a.jpg', isMain: true,
      sortOrder: 0, sourceType: 'MANUAL',
    });
    const images = new InMemoryProductImageRepository([first]);
    const products = new InMemoryProductRepository([product()]);
    const handler = new AddProductImageHandler(products, images, new FakeIdGenerator('img-2'));

    await handler.execute(createAddProductImageCommand({
      productId: 'p-1', publicUrl: 'https://example.com/b.jpg', makeMain: true,
    }));

    const all = await images.findByProductId('p-1');
    expect(all.filter((image) => image.isMain)).toHaveLength(1);
    expect(all.find((image) => image.id === 'img-2')?.isMain).toBe(true);
    expect(all.find((image) => image.id === 'img-1')?.isMain).toBe(false);
  });

  it('changes main image without deleting image history', async () => {
    const images = new InMemoryProductImageRepository([
      new ProductImage({ id: 'img-1', productId: 'p-1', publicUrl: 'https://example.com/a.jpg', isMain: true, sortOrder: 0, sourceType: 'MANUAL' }),
      new ProductImage({ id: 'img-2', productId: 'p-1', publicUrl: 'https://example.com/b.jpg', isMain: false, sortOrder: 1, sourceType: 'MANUAL' }),
    ]);
    const handler = new SetMainProductImageHandler(new InMemoryProductRepository([product()]), images);

    const result = await handler.execute(createSetMainProductImageCommand('p-1', 'img-2'));

    expect(result).toHaveLength(2);
    expect(result.filter((image) => image.isMain)).toHaveLength(1);
    expect(result.find((image) => image.id === 'img-2')?.isMain).toBe(true);
  });

  it('rejects an initial repository state with two main images', () => {
    expect(() => new InMemoryProductImageRepository([
      new ProductImage({ id: 'img-1', productId: 'p-1', publicUrl: 'https://example.com/a.jpg', isMain: true, sortOrder: 0, sourceType: 'MANUAL' }),
      new ProductImage({ id: 'img-2', productId: 'p-1', publicUrl: 'https://example.com/b.jpg', isMain: true, sortOrder: 1, sourceType: 'MANUAL' }),
    ])).toThrow(/more than one main image/i);
  });

  it('preserves Media V2 provenance and rendition metadata when changing main state', () => {
    const image = new ProductImage({
      id: 'img-media-v2',
      productId: 'p-1',
      publicUrl: 'https://example.com/card.webp',
      isMain: false,
      sortOrder: 0,
      sourceType: 'CATALOG_EVIDENCE_CROP',
      sourceId: 'source-1',
      assetRole: 'DERIVATIVE',
      derivativeProfile: 'WEB_CARD',
    });

    const main = image.withMain(true);

    expect(main.isMain).toBe(true);
    expect(main.sourceType).toBe('CATALOG_EVIDENCE_CROP');
    expect(main.sourceId).toBe('source-1');
    expect(main.assetRole).toBe('DERIVATIVE');
    expect(main.derivativeProfile).toBe('WEB_CARD');
  });

  it('maps legacy main_image_url into a canonical main ProductImage without writing anything', () => {
    const image = LegacyMainImageBackfillMapper.toProductImage({
      imageId: 'legacy-img-1',
      productId: 'p-1',
      mainImageUrl: ' https://legacy.example.com/main.jpg ',
      altText: 'Producto prueba',
    });

    expect(image?.publicUrl).toBe('https://legacy.example.com/main.jpg');
    expect(image?.isMain).toBe(true);
    expect(image?.sourceType).toBe('LEGACY_MAIN_IMAGE_URL');
    expect(image?.sortOrder).toBe(0);
  });
});
