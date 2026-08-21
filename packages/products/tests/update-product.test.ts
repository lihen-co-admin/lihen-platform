import { describe, expect, it } from 'vitest';
import { Money } from '@lihen/shared';
import {
  DuplicateCatalogCodeError,
  DuplicateProductSkuError,
  InMemoryProductRepository,
  Product,
  ProductNotFoundError,
  UpdateProductHandler,
  createUpdateProductCommand,
} from '../src';

function existing(id = 'product-1', sku = 'BC-100', catalogCode = 'LIHEN-0100') {
  return new Product({ businessLine:'BEAUTY_CARE',
    id,
    sku,
    catalogCode,
    name: 'Producto original',
    status: 'ACTIVE',
    salePrice: new Money(35000, 'COP'),
  });
}

function command(overrides: Partial<Parameters<typeof createUpdateProductCommand>[0]> = {}) {
  return createUpdateProductCommand({businessLine:'BEAUTY_CARE',
    commandId: 'update-1',
    actorId: 'tester',
    requestedAt: new Date('2026-08-20T21:00:00Z'),
    productId: 'product-1',
    sku: 'BC-101',
    catalogCode: 'LIHEN-0101',
    name: 'Producto actualizado',
    status: 'INACTIVE',
    ...overrides,
  });
}

describe('UpdateProductHandler', () => {
  it('updates name, identifiers and status while preserving the sale price', async () => {
    const repository = new InMemoryProductRepository([existing()]);
    const handler = new UpdateProductHandler(repository);

    const result = await handler.execute(command());

    expect(result).toEqual({
      id: 'product-1',
      sku: 'BC-101',
      catalogCode: 'LIHEN-0101',
      slug: 'producto-original',
      name: 'Producto actualizado',
      businessLine: 'BEAUTY_CARE',
      status: 'INACTIVE',
      salePrice: { amount: 35000, currency: 'COP' },
    });
    expect((await repository.findById('product-1'))?.name).toBe('Producto actualizado');
  });

  it('allows keeping the same SKU and catalog code on the same product', async () => {
    const repository = new InMemoryProductRepository([existing()]);
    const handler = new UpdateProductHandler(repository);

    await expect(
      handler.execute(command({ sku: 'BC-100', catalogCode: 'LIHEN-0100' })),
    ).resolves.toMatchObject({ id: 'product-1', sku: 'BC-100', catalogCode: 'LIHEN-0100' });
  });

  it('rejects a SKU already used by another product', async () => {
    const repository = new InMemoryProductRepository([
      existing(),
      existing('product-2', 'BC-200', 'LIHEN-0200'),
    ]);
    const handler = new UpdateProductHandler(repository);

    await expect(handler.execute(command({ sku: 'BC-200' }))).rejects.toBeInstanceOf(
      DuplicateProductSkuError,
    );
  });

  it('rejects a catalog code already used by another product', async () => {
    const repository = new InMemoryProductRepository([
      existing(),
      existing('product-2', 'BC-200', 'LIHEN-0200'),
    ]);
    const handler = new UpdateProductHandler(repository);

    await expect(handler.execute(command({ catalogCode: 'LIHEN-0200' }))).rejects.toBeInstanceOf(
      DuplicateCatalogCodeError,
    );
  });

  it('fails when the product does not exist', async () => {
    const repository = new InMemoryProductRepository();
    const handler = new UpdateProductHandler(repository);

    await expect(handler.execute(command())).rejects.toBeInstanceOf(ProductNotFoundError);
  });

  it('can clear optional SKU and catalog code without writing undefined properties', async () => {
    const repository = new InMemoryProductRepository([existing()]);
    const handler = new UpdateProductHandler(repository);

    const result = await handler.execute(
      createUpdateProductCommand({businessLine:'BEAUTY_CARE',
        commandId: 'update-clear',
        actorId: 'tester',
        requestedAt: new Date('2026-08-20T21:00:00Z'),
        productId: 'product-1',
        name: 'Sin códigos',
        status: 'ACTIVE',
      }),
    );

    expect(result.sku).toBeUndefined();
    expect(result.catalogCode).toBeUndefined();
  });
});
