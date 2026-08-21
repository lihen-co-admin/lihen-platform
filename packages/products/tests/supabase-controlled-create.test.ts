import { describe, expect, it, vi } from 'vitest';
import { Money } from '@lihen/shared';
import { Product } from '../src/domain/product';
import { ProductWriteBlockedError } from '../src/domain/errors/product-errors';
import { SupabaseProductRepository } from '../src/infrastructure/supabase-product-repository';

function product() {
  return new Product({ businessLine:'BEAUTY_CARE',
    id: '00000000-0000-4000-8000-000000000010',
    sku: 'BC-100',
    catalogCode: 'LIHEN-BC-100',
    name: 'Producto controlado',
    status: 'ACTIVE',
    salePrice: new Money(19000, 'COP'),
  });
}

describe('Supabase controlled CreateProduct gate', () => {
  it('remains blocked by default and does not call RPC', async () => {
    const rpc = vi.fn();
    const repository = new SupabaseProductRepository({ rpc } as never);

    await expect(
      repository.create(product(), { actorId: 'actor', operationKey: 'op-1' }),
    ).rejects.toBeInstanceOf(ProductWriteBlockedError);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('uses only the controlled RPC when explicitly enabled', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          id: '00000000-0000-4000-8000-000000000010',
          sku: 'BC-100',
          catalog_code: 'LIHEN-BC-100',
          slug: 'producto-controlado',
          name: 'Producto controlado',
          business_line: 'BEAUTY_CARE',
          brand_id: null,
          category_id: null,
          status: 'ACTIVE',
          sale_price: 19000,
        },
      ],
      error: null,
    });
    const repository = new SupabaseProductRepository({ rpc } as never, {
      controlledCreateEnabled: true,
    });

    const created = await repository.create(product(), {
      actorId: 'actor',
      operationKey: 'op-2',
    });

    expect(created.id).toBe('00000000-0000-4000-8000-000000000010');
    expect(rpc).toHaveBeenCalledWith('create_product_controlled', expect.objectContaining({
      p_operation_key: 'op-2',
      p_name: 'Producto controlado',
      p_sale_price: 19000,
    }));
  });
});
