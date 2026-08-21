import { describe, expect, it } from 'vitest';
import { Money } from '@lihen/shared';
import { Product } from '../src/domain/product';
import { InMemoryProductRepository } from '../src/infrastructure/in-memory-product-repository';

const product = new Product({ businessLine:'BEAUTY_CARE',
  id: 'product-1',
  sku: 'BC-080',
  name: 'Producto de prueba',
  status: 'ACTIVE',
  salePrice: new Money(10_000),
});

describe('InMemoryProductRepository', () => {
  it('returns all configured products', async () => {
    const repository = new InMemoryProductRepository([product]);

    await expect(repository.findAll()).resolves.toEqual([product]);
  });

  it('finds a product by id', async () => {
    const repository = new InMemoryProductRepository([product]);

    await expect(repository.findById('product-1')).resolves.toBe(product);
    await expect(repository.findById('missing')).resolves.toBeNull();
  });
});
