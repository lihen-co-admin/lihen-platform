import { describe, expect, it } from 'vitest';
import { Money } from '@lihen/shared';
import { Product } from '../src/domain/product';
import { InMemoryProductRepository } from '../src/infrastructure/in-memory-product-repository';
import { GetProductByIdHandler } from '../src/application/queries/get-product-by-id.handler';
import { createGetProductByIdQuery } from '../src/application/queries/get-product-by-id.query';

describe('GetProductByIdHandler', () => {
  it('returns the requested product as a detail DTO', async () => {
    const product = new Product({ businessLine:'BEAUTY_CARE',
      id: 'product-1',
      sku: 'BC-080',
      catalogCode: 'LIHEN-0080',
      slug: 'producto-de-prueba',
      name: 'Producto de prueba',
      status: 'ACTIVE',
      salePrice: new Money(25_000, 'COP'),
    });
    const handler = new GetProductByIdHandler(new InMemoryProductRepository([product]));

    const result = await handler.execute(createGetProductByIdQuery('product-1'));

    expect(result).toEqual({
      id: 'product-1',
      sku: 'BC-080',
      catalogCode: 'LIHEN-0080',
      slug: 'producto-de-prueba',
      name: 'Producto de prueba',
      businessLine: 'BEAUTY_CARE',
      status: 'ACTIVE',
      salePrice: { amount: 25_000, currency: 'COP' },
    });
  });

  it('returns null when the product does not exist', async () => {
    const handler = new GetProductByIdHandler(new InMemoryProductRepository());

    await expect(handler.execute(createGetProductByIdQuery('missing'))).resolves.toBeNull();
  });

  it('rejects an empty product id before repository access', () => {
    expect(() => createGetProductByIdQuery('   ')).toThrow('Product id is required.');
  });
});
