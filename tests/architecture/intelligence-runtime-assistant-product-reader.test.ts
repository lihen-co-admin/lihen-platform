import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  readAssistantProductContext,
} from '../../supabase/functions/intelligence-runtime/assistant-product-context-reader';

interface FakeResult {
  readonly data: unknown;
  readonly error: { readonly message?: string } | null;
}

function fakeClient(
  results: Readonly<Record<string, FakeResult>>,
) {
  const calls: Array<{
    table: string;
    columns: string;
    field: string;
    value: string;
  }> = [];

  const client = {
    from(table: string) {
      return {
        select(columns: string) {
          return {
            eq(field: string, value: string) {
              calls.push({
                table,
                columns,
                field,
                value,
              });

              return {
                async maybeSingle() {
                  return results[table] ?? {
                    data: null,
                    error: null,
                  };
                },
              };
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;

  return {
    client,
    calls,
  };
}

describe('Intelligence Runtime Assistant Product reader', () => {
  it('fails closed when productId is empty', async () => {
    const { client, calls } = fakeClient({});

    await expect(
      readAssistantProductContext(client, '   '),
    ).rejects.toThrow(
      'LIHEN_ASSISTANT_PRODUCT_ID_REQUIRED',
    );

    expect(calls).toHaveLength(0);
  });

  it('returns null when Product Master has no matching row', async () => {
    const { client, calls } = fakeClient({
      products: {
        data: null,
        error: null,
      },
    });

    const result =
      await readAssistantProductContext(
        client,
        'product-1',
      );

    expect(result).toBeNull();
    expect(calls).toEqual([
      expect.objectContaining({
        table: 'products',
        field: 'id',
        value: 'product-1',
      }),
    ]);
  });

  it('projects Product Master and taxonomy into the existing Assistant detail shape', async () => {
    const { client, calls } = fakeClient({
      products: {
        data: {
          id: 'product-1',
          sku: 'BC-001',
          catalog_code: 'LIHEN-BC-001',
          slug: 'producto-lihen',
          name: 'Producto LIHEN',
          business_line: 'BEAUTY_CARE',
          status: 'ACTIVE',
          sale_price: '25000',
          brand_id: 'brand-1',
          category_id: 'category-1',
        },
        error: null,
      },
      brands: {
        data: {
          name: 'Marca LIHEN',
        },
        error: null,
      },
      categories: {
        data: {
          name: 'Beauty Care',
        },
        error: null,
      },
    });

    const result =
      await readAssistantProductContext(
        client,
        'product-1',
      );

    expect(result).toEqual({
      id: 'product-1',
      sku: 'BC-001',
      catalogCode: 'LIHEN-BC-001',
      slug: 'producto-lihen',
      name: 'Producto LIHEN',
      businessLine: 'BEAUTY_CARE',
      brandId: 'brand-1',
      brandName: 'Marca LIHEN',
      categoryId: 'category-1',
      categoryName: 'Beauty Care',
      status: 'ACTIVE',
      salePrice: {
        amount: 25000,
        currency: 'COP',
      },
    });

    expect(calls.map((call) => call.table)).toEqual([
      'products',
      'brands',
      'categories',
    ]);
  });

  it('keeps taxonomy labels optional when references are absent', async () => {
    const { client, calls } = fakeClient({
      products: {
        data: {
          id: 'product-2',
          sku: null,
          catalog_code: null,
          slug: 'producto-style',
          name: 'Producto Style',
          business_line: 'STYLE',
          status: 'ACTIVO',
          sale_price: 40000,
          brand_id: null,
          category_id: null,
        },
        error: null,
      },
    });

    const result =
      await readAssistantProductContext(
        client,
        'product-2',
      );

    expect(result).toEqual({
      id: 'product-2',
      slug: 'producto-style',
      name: 'Producto Style',
      businessLine: 'STYLE',
      status: 'ACTIVE',
      salePrice: {
        amount: 40000,
        currency: 'COP',
      },
    });

    expect(calls.map((call) => call.table)).toEqual([
      'products',
    ]);
  });

  it('fails closed on a Product Master read error', async () => {
    const { client } = fakeClient({
      products: {
        data: null,
        error: {
          message: 'permission denied',
        },
      },
    });

    await expect(
      readAssistantProductContext(
        client,
        'product-1',
      ),
    ).rejects.toThrow(
      'LIHEN_ASSISTANT_PRODUCT_READ_FAILED:permission denied',
    );
  });

  it('fails closed on invalid Product Master business data', async () => {
    const { client } = fakeClient({
      products: {
        data: {
          id: 'product-1',
          sku: null,
          catalog_code: null,
          slug: 'producto',
          name: 'Producto',
          business_line: 'UNKNOWN',
          status: 'ACTIVE',
          sale_price: 1000,
          brand_id: null,
          category_id: null,
        },
        error: null,
      },
    });

    await expect(
      readAssistantProductContext(
        client,
        'product-1',
      ),
    ).rejects.toThrow(
      'LIHEN_ASSISTANT_PRODUCT_INVALID:business_line:UNKNOWN',
    );
  });

  it('fails closed when taxonomy lookup fails', async () => {
    const { client } = fakeClient({
      products: {
        data: {
          id: 'product-1',
          sku: null,
          catalog_code: null,
          slug: 'producto',
          name: 'Producto',
          business_line: 'BEAUTY_CARE',
          status: 'ACTIVE',
          sale_price: 1000,
          brand_id: 'brand-1',
          category_id: null,
        },
        error: null,
      },
      brands: {
        data: null,
        error: {
          message: 'brand lookup failed',
        },
      },
    });

    await expect(
      readAssistantProductContext(
        client,
        'product-1',
      ),
    ).rejects.toThrow(
      'LIHEN_ASSISTANT_BRANDS_READ_FAILED:brand lookup failed',
    );
  });
});
