import { describe, expect, it } from 'vitest';
import { parsePublicHubPayload, type PublicHubBlock } from '../src/components/public-hub-api';
import { renderPublicHubBlock } from '../src/components/public-hub-page';

const productBlock: PublicHubBlock = {
  block_id: 'product-1',
  block_type: 'PRODUCT',
  sort_order: 20,
  title: 'Labial',
  subtitle: 'LIHEN',
  body: null,
  cta_label: 'Ver producto',
  target_url: '#producto/labial',
  image_url: 'https://cdn.example.com/labial.webp',
  product_id: 'canonical-product-1',
  product_slug: 'labial',
  product_name: 'Labial',
  product_brand: 'LIHEN',
  product_sale_price: 19000,
  product_availability: 'AVAILABLE',
  collection_key: null,
};

describe('Public Hub storefront contract', () => {
  it('drops malformed projection rows and preserves deterministic order', () => {
    const result = parsePublicHubPayload([
      productBlock,
      { ...productBlock, block_id: 'heading-1', block_type: 'HEADING', sort_order: 10, product_id: null },
      { block_id: 'bad', block_type: 'UNKNOWN', sort_order: 1 },
    ]);

    expect(result.map((block) => block.block_id)).toEqual(['heading-1', 'product-1']);
  });

  it('renders canonical product data without duplicating it in storefront state', () => {
    const html = renderPublicHubBlock(productBlock);
    expect(html).toContain('Labial');
    expect(html).toContain('19.000');
    expect(html).toContain('#producto/labial');
    expect(html).toContain('Disponible');
  });

  it('escapes public text coming from the projection', () => {
    const html = renderPublicHubBlock({
      ...productBlock,
      block_type: 'TEXT',
      title: '<script>alert(1)</script>',
      body: '<img src=x onerror=alert(1)>',
      target_url: null,
      image_url: null,
      product_id: null,
      product_slug: null,
      product_name: null,
      product_brand: null,
      product_sale_price: null,
      product_availability: null,
    });

    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;');
  });
});
