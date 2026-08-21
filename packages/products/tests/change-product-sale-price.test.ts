import { describe, expect, it } from 'vitest';
import { FakeClock, FakeIdGenerator } from '@lihen/core';
import { Money } from '@lihen/shared';
import {
  ChangeProductSalePriceHandler,
  InMemoryProductRepository,
  Product,
  ProductNotFoundError,
  ProductSalePriceUnchangedError,
  createChangeProductSalePriceCommand,
} from '../src';

function product() {
  return new Product({ businessLine:'BEAUTY_CARE',
    id: 'product-1',
    sku: 'BC-100',
    catalogCode: 'LIHEN-0100',
    name: 'Producto con historial',
    status: 'ACTIVE',
    salePrice: new Money(35_000, 'COP'),
  });
}

function command(newPrice = 42_000, reason = 'Ajuste comercial aprobado') {
  return createChangeProductSalePriceCommand({
    commandId: 'price-change-1',
    operationKey: 'price-change-op-1',
    actorId: 'user-123',
    requestedAt: new Date('2026-08-20T22:00:00Z'),
    productId: 'product-1',
    newPrice,
    reason,
  });
}

describe('ChangeProductSalePriceHandler', () => {
  it('changes the current price and appends actor, reason and timestamp to history', async () => {
    const repository = new InMemoryProductRepository([product()]);
    const handler = new ChangeProductSalePriceHandler(
      repository,
      repository,
      new FakeClock(new Date('2026-08-21T03:15:00Z')),
      new FakeIdGenerator('history-1'),
    );

    const result = await handler.execute(command());
    const current = await repository.findById('product-1');
    const history = await repository.findSalePriceHistoryByProductId('product-1');

    expect(current?.salePrice.amount).toBe(42_000);
    expect(result.previousPrice.amount).toBe(35_000);
    expect(result.newPrice.amount).toBe(42_000);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      id: 'history-1',
      productId: 'product-1',
      reason: 'Ajuste comercial aprobado',
      actorId: 'user-123',
    });
    expect(history[0]?.changedAt.toISOString()).toBe('2026-08-21T03:15:00.000Z');
    expect(history[0]?.previousPrice.amount).toBe(35_000);
    expect(history[0]?.newPrice.amount).toBe(42_000);
  });

  it('preserves every previous price change instead of overwriting history', async () => {
    const repository = new InMemoryProductRepository([product()]);

    await new ChangeProductSalePriceHandler(
      repository,
      repository,
      new FakeClock(new Date('2026-08-21T03:00:00Z')),
      new FakeIdGenerator('history-1'),
    ).execute(command(40_000, 'Primer ajuste'));

    await new ChangeProductSalePriceHandler(
      repository,
      repository,
      new FakeClock(new Date('2026-08-21T04:00:00Z')),
      new FakeIdGenerator('history-2'),
    ).execute(command(45_000, 'Segundo ajuste'));

    const history = await repository.findSalePriceHistoryByProductId('product-1');

    expect(history).toHaveLength(2);
    expect(history.map((entry) => entry.id)).toEqual(['history-2', 'history-1']);
    expect(history[0]?.previousPrice.amount).toBe(40_000);
    expect(history[0]?.newPrice.amount).toBe(45_000);
    expect(history[1]?.previousPrice.amount).toBe(35_000);
    expect(history[1]?.newPrice.amount).toBe(40_000);
  });

  it('rejects a change when the product does not exist', async () => {
    const repository = new InMemoryProductRepository();
    const handler = new ChangeProductSalePriceHandler(
      repository,
      repository,
      new FakeClock(new Date('2026-08-21T03:00:00Z')),
      new FakeIdGenerator('history-1'),
    );

    await expect(handler.execute(command())).rejects.toBeInstanceOf(ProductNotFoundError);
  });

  it('rejects writing the same current price and leaves history untouched', async () => {
    const repository = new InMemoryProductRepository([product()]);
    const handler = new ChangeProductSalePriceHandler(
      repository,
      repository,
      new FakeClock(new Date('2026-08-21T03:00:00Z')),
      new FakeIdGenerator('history-1'),
    );

    await expect(handler.execute(command(35_000))).rejects.toBeInstanceOf(
      ProductSalePriceUnchangedError,
    );
    await expect(repository.findSalePriceHistoryByProductId('product-1')).resolves.toHaveLength(0);
  });

  it('validates that a meaningful reason is provided before entering the handler', () => {
    expect(() => command(42_000, ' ')).toThrow();
  });
});
