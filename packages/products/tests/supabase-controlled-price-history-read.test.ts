import { describe, expect, it, vi } from 'vitest';
import {
  ProductPriceHistoryUnavailableError,
  SupabaseProductRepository,
} from '../src';

describe('Supabase controlled product price-history read', () => {
  it('remains blocked by default and never calls the RPC', async () => {
    const rpc = vi.fn();
    const repository = new SupabaseProductRepository({ rpc } as never);

    await expect(repository.findSalePriceHistoryByProductId('product-1')).rejects.toBeInstanceOf(
      ProductPriceHistoryUnavailableError,
    );
    expect(rpc).not.toHaveBeenCalled();
  });

  it('reads only through get_product_sale_price_history when enabled', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'history-1',
          product_id: 'product-1',
          previous_price: 10000,
          new_price: 12000,
          currency: 'COP',
          reason: 'Ajuste de precio',
          actor_id: 'actor-1',
          changed_at: '2026-08-21T12:00:00.000Z',
        },
      ],
      error: null,
    });
    const repository = new SupabaseProductRepository(
      { rpc } as never,
      { priceHistoryReadEnabled: true },
    );

    const history = await repository.findSalePriceHistoryByProductId('product-1');

    expect(rpc).toHaveBeenCalledWith('get_product_sale_price_history', {
      p_product_id: 'product-1',
    });
    expect(history).toHaveLength(1);
    expect(history[0]?.previousPrice.amount).toBe(10000);
    expect(history[0]?.newPrice.amount).toBe(12000);
  });
});
