import { describe, expect, it, vi } from 'vitest';
import { Money } from '@lihen/shared';
import { Product, ProductSalePriceChange, ProductWriteBlockedError } from '../src';
import { SupabaseProductRepository } from '../src/infrastructure/supabase-product-repository';

const product = new Product({ businessLine:'BEAUTY_CARE', id:'00000000-0000-4000-8000-000000000001', sku:'BC-001', name:'Demo', status:'ACTIVE', salePrice:new Money(31000,'COP') });
const history = new ProductSalePriceChange({ id:'11111111-1111-4111-8111-111111111111', productId:'00000000-0000-4000-8000-000000000001', previousPrice:new Money(28000,'COP'), newPrice:new Money(31000,'COP'), reason:'Ajuste proveedor', actorId:'22222222-2222-4222-8222-222222222222', changedAt:new Date('2026-08-21T00:00:00Z') });

describe('Supabase controlled price change gate', () => {
  it('is blocked by default and never calls RPC', async () => {
    const rpc = vi.fn();
    const repository = new SupabaseProductRepository({ rpc } as never);
    await expect(repository.changeSalePrice(product, history, { operationKey:'price-op-1' })).rejects.toBeInstanceOf(ProductWriteBlockedError);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('uses only the controlled price RPC when enabled', async () => {
    const rpc = vi.fn().mockResolvedValue({ data:[{ id:'00000000-0000-4000-8000-000000000001', sku:'BC-001', catalog_code:null, slug:'demo', name:'Demo', business_line:'BEAUTY_CARE', brand_id:null, category_id:null, status:'ACTIVE', sale_price:31000, history_id:history.id, previous_price:28000, currency:'COP', reason:'Ajuste proveedor', actor_id:history.actorId, changed_at:'2026-08-21T06:00:00Z' }], error:null });
    const repository = new SupabaseProductRepository({ rpc } as never, { controlledPriceChangeEnabled:true });
    const result = await repository.changeSalePrice(product, history, { operationKey:'price-op-1' });
    expect(rpc).toHaveBeenCalledWith('change_product_sale_price_controlled', expect.objectContaining({ p_operation_key:'price-op-1', p_product_id:'00000000-0000-4000-8000-000000000001', p_new_price:31000 }));
    expect(result.historyEntry.previousPrice.amount).toBe(28000);
    expect(result.product.salePrice.amount).toBe(31000);
  });
});
