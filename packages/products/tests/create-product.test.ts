import { describe, expect, it } from 'vitest';
import { FakeIdGenerator } from '@lihen/core';
import { Money } from '@lihen/shared';
import {
  CreateProductHandler,
  DuplicateCatalogCodeError,
  DuplicateProductSkuError,
  InMemoryProductRepository,
  Product,
  createCreateProductCommand,
} from '../src';

function command(overrides: Partial<Parameters<typeof createCreateProductCommand>[0]> = {}) {
  return createCreateProductCommand({businessLine:'BEAUTY_CARE',
    commandId: 'command-1',
    actorId: 'tester',
    requestedAt: new Date('2026-08-20T20:00:00Z'),
    name: 'Nuevo producto',
    sku: 'BC-100',
    catalogCode: 'LIHEN-0100',
    salePrice: 35000,
    ...overrides,
  });
}

describe('CreateProductHandler', () => {
  it('creates a product through the repository port', async () => {
    const repository = new InMemoryProductRepository();
    const handler = new CreateProductHandler(repository, new FakeIdGenerator('product-new'));

    const result = await handler.execute(command());

    expect(result).toEqual({
      id: 'product-new',
      sku: 'BC-100',
      catalogCode: 'LIHEN-0100',
      slug: 'nuevo-producto',
      name: 'Nuevo producto',
      businessLine: 'BEAUTY_CARE',
      status: 'ACTIVE',
      salePrice: { amount: 35000, currency: 'COP' },
    });
    expect(await repository.findById('product-new')).not.toBeNull();
  });

  it('rejects duplicate SKU before persistence', async () => {
    const repository = new InMemoryProductRepository([
      new Product({ businessLine:'BEAUTY_CARE',
        id: 'existing',
        sku: 'BC-100',
        name: 'Existente',
        status: 'ACTIVE',
        salePrice: new Money(10000, 'COP'),
      }),
    ]);
    const handler = new CreateProductHandler(repository, new FakeIdGenerator('unused'));

    await expect(handler.execute(command())).rejects.toBeInstanceOf(DuplicateProductSkuError);
  });

  it('rejects duplicate catalog code before persistence', async () => {
    const repository = new InMemoryProductRepository([
      new Product({ businessLine:'BEAUTY_CARE',
        id: 'existing',
        catalogCode: 'LIHEN-0100',
        name: 'Existente',
        status: 'ACTIVE',
        salePrice: new Money(10000, 'COP'),
      }),
    ]);
    const handler = new CreateProductHandler(repository, new FakeIdGenerator('unused'));

    await expect(handler.execute(command({ sku: 'BC-101' }))).rejects.toBeInstanceOf(
      DuplicateCatalogCodeError,
    );
  });

  it('normalizes optional fields through the command factory', async () => {
    const repository = new InMemoryProductRepository();
    const handler = new CreateProductHandler(repository, new FakeIdGenerator('product-normalized'));

    const result = await handler.execute(
      command({ sku: '  BC-200  ', catalogCode: '  CAT-200  ', name: '  Producto limpio  ' }),
    );

    expect(result.sku).toBe('BC-200');
    expect(result.catalogCode).toBe('CAT-200');
    expect(result.name).toBe('Producto limpio');
  });
});
