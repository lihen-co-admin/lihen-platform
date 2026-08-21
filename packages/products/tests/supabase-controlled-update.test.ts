import { describe, expect, it, vi } from 'vitest';
import { Money } from '@lihen/shared';
import { Product } from '../src/domain/product';
import { ProductWriteBlockedError } from '../src/domain/errors/product-errors';
import { SupabaseProductRepository } from '../src/infrastructure/supabase-product-repository';

function product() {
  return new Product({ businessLine:'BEAUTY_CARE',
    id: '00000000-0000-4000-8000-000000000011',
    sku: 'BC-111',
    catalogCode: 'LIHEN-BC-111',
    name: 'Producto actualizado controlado',
    brandId: '00000000-0000-4000-8000-000000000101',
    categoryId: '00000000-0000-4000-8000-000000000201',
    status: 'INACTIVE',
    salePrice: new Money(21000, 'COP'),
  });
}

describe('Supabase controlled UpdateProduct gate', () => {
  it('remains blocked by default and does not call RPC', async () => {
    const rpc = vi.fn();
    const repository = new SupabaseProductRepository({ rpc } as never);

    await expect(
      repository.update(product(), { actorId: 'actor', operationKey: 'update-op-1' }),
    ).rejects.toBeInstanceOf(ProductWriteBlockedError);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('uses only the controlled update RPC when explicitly enabled', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          id: '00000000-0000-4000-8000-000000000011',
          sku: 'BC-111',
          catalog_code: 'LIHEN-BC-111',
          slug: 'producto-actualizado-controlado',
          name: 'Producto actualizado controlado',
          business_line: 'BEAUTY_CARE',
          brand_id: '00000000-0000-4000-8000-000000000101',
          category_id: '00000000-0000-4000-8000-000000000201',
          status: 'INACTIVE',
          sale_price: 21000,
        },
      ],
      error: null,
    });
    const repository = new SupabaseProductRepository({ rpc } as never, {
      controlledUpdateEnabled: true,
    });

    const updated = await repository.update(product(), {
      actorId: 'actor',
      operationKey: 'update-op-2',
    });

    expect(updated.id).toBe('00000000-0000-4000-8000-000000000011');
    expect(updated.salePrice.amount).toBe(21000);
    expect(rpc).toHaveBeenCalledWith(
      'update_product_controlled',
      expect.objectContaining({
        p_operation_key: 'update-op-2',
        p_product_id: '00000000-0000-4000-8000-000000000011',
        p_name: 'Producto actualizado controlado',
        p_status: 'INACTIVE',
      }),
    );
  });
});
