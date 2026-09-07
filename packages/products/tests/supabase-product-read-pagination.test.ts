import { describe, expect, it, vi } from 'vitest';
import { SupabaseProductRepository } from '../src/infrastructure/supabase-product-repository';

function row(index: number) {
  return {
    id: `00000000-0000-0000-0000-${String(index).padStart(12, '0')}`,
    sku: `SKU-${index}`,
    catalog_code: `CAT-${index}`,
    slug: `product-${index}`,
    name: `Product ${String(index).padStart(4, '0')}`,
    business_line: 'BEAUTY_CARE',
    status: 'ACTIVE',
    sale_price: 1000,
    brand_id: null,
    category_id: null,
  };
}

describe('SupabaseProductRepository paged product reads', () => {
  it('reads beyond the first 1000 rows without truncating the collection', async () => {
    const firstPage = Array.from({ length: 1000 }, (_, index) => row(index + 1));
    const secondPage = Array.from({ length: 28 }, (_, index) => row(index + 1001));

    const query = {
      order: vi.fn(),
      range: vi.fn(async (from: number, to: number) => ({
        data: from === 0 && to === 999
          ? firstPage
          : from === 1000 && to === 1999
            ? secondPage
            : [],
        error: null,
      })),
    };

    query.order.mockReturnValue(query);

    const select = vi.fn(() => query);
    const from = vi.fn(() => ({ select }));

    const repository = new SupabaseProductRepository({ from } as never);
    const products = await repository.findAll();

    expect(products).toHaveLength(1028);
    expect(query.range).toHaveBeenCalledTimes(2);
    expect(query.range).toHaveBeenNthCalledWith(1, 0, 999);
    expect(query.range).toHaveBeenNthCalledWith(2, 1000, 1999);

    expect(query.order).toHaveBeenCalledWith('name', { ascending: true });
    expect(query.order).toHaveBeenCalledWith('id', { ascending: true });
  });
});
