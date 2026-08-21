import { describe, expect, it } from 'vitest';
import { Money } from '@lihen/shared';
import { Product } from '../src/domain/product';
import { InMemoryProductRepository } from '../src/infrastructure/in-memory-product-repository';
import { GetProductsHandler } from '../src/application/queries/get-products.handler';
import { createGetProductsQuery } from '../src/application/queries/get-products.query';

describe('GetProducts', () => {
  it('returns product list DTOs from the repository without leaking domain objects', async () => {
    const repository = new InMemoryProductRepository([
      new Product({ businessLine:'BEAUTY_CARE',
        id: 'product-1',
        sku: 'BC-080',
        catalogCode: 'LIHEN-0080',
        slug: 'producto-de-prueba-lihen',
        name: 'Producto de prueba LIHEN',
        status: 'ACTIVE',
        salePrice: new Money(25_000, 'COP'),
      }),
    ]);
    const handler = new GetProductsHandler(repository);

    const result = await handler.execute(createGetProductsQuery());

    expect(result).toEqual([
      {
        id: 'product-1',
        sku: 'BC-080',
        catalogCode: 'LIHEN-0080',
        slug: 'producto-de-prueba-lihen',
        name: 'Producto de prueba LIHEN',
        businessLine: 'BEAUTY_CARE',
        brandId: null,
        brandName: null,
        categoryId: null,
        categoryName: null,
        status: 'ACTIVE',
        salePrice: { amount: 25_000, currency: 'COP' },
      },
    ]);
    expect(result[0]).not.toBeInstanceOf(Product);
  });

  it('returns an empty list when the repository has no products', async () => {
    const handler = new GetProductsHandler(new InMemoryProductRepository());

    await expect(handler.execute(createGetProductsQuery())).resolves.toEqual([]);
  });
});
