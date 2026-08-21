import { describe, expect, it } from 'vitest';
import { LegacyProductMapper } from '../src/infrastructure/legacy-product-mapper';

describe('LegacyProductMapper', () => {
  it('maps the current ADMIN product read shape into the canonical Product domain', () => {
    const product = LegacyProductMapper.toDomain({
      id: 'product-1',
      sku: ' BC-080 ',
      catalog_code: ' LIHEN-0080 ',
      slug: 'lumi-gloss',
      name: ' Lumi Gloss ',
      business_line: 'BEAUTY_CARE',
      status: 'activo',
      sale_price: '25000',
    });

    expect(product.id).toBe('product-1');
    expect(product.sku).toBe('BC-080');
    expect(product.catalogCode).toBe('LIHEN-0080');
    expect(product.name).toBe('Lumi Gloss');
    expect(product.status).toBe('ACTIVE');
    expect(product.salePrice.amount).toBe(25_000);
    expect(product.salePrice.currency).toBe('COP');
  });

  it('rejects unsupported legacy statuses instead of silently inventing a mapping', () => {
    expect(() =>
      LegacyProductMapper.toDomain({
        id: 'product-2',
        sku: null,
        catalog_code: null,
        slug: 'producto',
        name: 'Producto',
        business_line: 'BEAUTY_CARE',
        status: 'estado-desconocido',
        sale_price: 10_000,
      }),
    ).toThrow('Unsupported legacy product status');
  });

  it('rejects negative sale prices at the legacy boundary', () => {
    expect(() =>
      LegacyProductMapper.toDomain({
        id: 'product-3',
        sku: null,
        catalog_code: null,
        slug: 'producto',
        name: 'Producto',
        business_line: 'BEAUTY_CARE',
        status: 'ACTIVE',
        sale_price: -1,
      }),
    ).toThrow('Invalid legacy product sale_price');
  });
});


it('preserves canonical taxonomy ids when Supabase read rows include them', () => {
  const product = LegacyProductMapper.toDomain({
    id: '00000000-0000-4000-8000-000000000001',
    sku: 'BC-1',
    catalog_code: 'LIHEN-1',
    slug: 'taxonomy-safe-product',
    name: 'Taxonomy-safe product',
    business_line: 'BEAUTY_CARE',
    status: 'ACTIVE',
    sale_price: 10000,
    brand_id: '00000000-0000-4000-8000-000000000101',
    category_id: '00000000-0000-4000-8000-000000000201',
  });

  expect(product.brandId).toBe('00000000-0000-4000-8000-000000000101');
  expect(product.categoryId).toBe('00000000-0000-4000-8000-000000000201');
});
