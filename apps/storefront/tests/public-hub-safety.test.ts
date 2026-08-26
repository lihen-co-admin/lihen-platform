import { describe, expect, it } from 'vitest';
import { parsePublicHubPayload, type PublicHubBlock } from '../src/components/public-hub-api';

const base: PublicHubBlock = {
  block_id: 'safe',
  block_type: 'LINK',
  sort_order: 10,
  title: 'Tienda',
  subtitle: null,
  body: null,
  cta_label: 'Abrir',
  target_url: 'https://lihen.co',
  image_url: null,
  product_id: null,
  product_slug: null,
  product_name: null,
  product_brand: null,
  product_sale_price: null,
  product_availability: null,
  collection_key: null,
};

describe('Public Hub public payload safety', () => {
  it('rejects unsafe navigation and image schemes even if a malformed row reaches the client', () => {
    const rows = parsePublicHubPayload([
      base,
      { ...base, block_id: 'unsafe-target', target_url: 'javascript:alert(1)' },
      { ...base, block_id: 'unsafe-image', block_type: 'BANNER', image_url: 'data:text/html;base64,abc' },
    ]);

    expect(rows.map((row) => row.block_id)).toEqual(['safe']);
  });

  it('accepts storefront hash routes and rejects non-numeric sale prices', () => {
    const rows = parsePublicHubPayload([
      { ...base, block_id: 'route', target_url: '#producto/labial' },
      { ...base, block_id: 'bad-price', product_sale_price: 'not-a-number' },
    ]);

    expect(rows.map((row) => row.block_id)).toEqual(['route']);
  });

  it('uses a deterministic block id tie-breaker when sort orders match', () => {
    const rows = parsePublicHubPayload([
      { ...base, block_id: 'b', sort_order: 10 },
      { ...base, block_id: 'a', sort_order: 10 },
    ]);

    expect(rows.map((row) => row.block_id)).toEqual(['a', 'b']);
  });
});
