import { describe, expect, it } from 'vitest';
import { Money } from '@lihen/shared';
import { Product, ProductSalePriceChange, ProductWriteBlockedError, SupabaseProductRepository } from '../src';

const fakeClient = {} as never;

function product() {
  return new Product({ businessLine:'BEAUTY_CARE',
    id: 'blocked-product',
    name: 'Blocked product',
    status: 'ACTIVE',
    salePrice: new Money(1000, 'COP'),
  });
}

describe('SupabaseProductRepository write gate', () => {
  it('blocks create until DEV schema + RLS precheck is approved', async () => {
    const repository = new SupabaseProductRepository(fakeClient);
    await expect(repository.create(product())).rejects.toBeInstanceOf(ProductWriteBlockedError);
  });

  it('blocks update until DEV schema + RLS precheck is approved', async () => {
    const repository = new SupabaseProductRepository(fakeClient);
    await expect(repository.update(product())).rejects.toBeInstanceOf(ProductWriteBlockedError);
  });
  it('blocks historical price change until DEV schema + RLS precheck is approved', async () => {
    const repository = new SupabaseProductRepository(fakeClient);
    const current = product();
    const history = new ProductSalePriceChange({
      id: 'history-blocked',
      productId: current.id,
      previousPrice: current.salePrice,
      newPrice: new Money(2000, 'COP'),
      reason: 'Blocked until DEV gate',
      actorId: 'tester',
      changedAt: new Date('2026-08-20T22:00:00Z'),
    });

    await expect(
      repository.changeSalePrice(
        new Product({ businessLine:'BEAUTY_CARE',
          id: current.id,
          name: current.name,
          status: current.status,
          salePrice: history.newPrice,
        }),
        history,
      ),
    ).rejects.toBeInstanceOf(ProductWriteBlockedError);
  });

});

it('blocks product image writes in Supabase until DEV Storage gate is approved', async () => {
  const { SupabaseProductImageRepository, ProductImage } = await import('../src');
  const repository = new SupabaseProductImageRepository(fakeClient);
  const image = new ProductImage({
    id: 'img-1', productId: 'p-1', publicUrl: 'https://example.com/a.jpg', isMain: true,
    sortOrder: 0, sourceType: 'MANUAL',
  });

  await expect(repository.add(image)).rejects.toMatchObject({ code: 'PRODUCT_IMAGE_WRITE_BLOCKED' });
  await expect(repository.setMain('p-1', 'img-1')).rejects.toMatchObject({ code: 'PRODUCT_IMAGE_WRITE_BLOCKED' });
});
