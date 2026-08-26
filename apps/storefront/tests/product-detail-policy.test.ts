import { describe, expect, it } from 'vitest';
import {
  PRODUCT_INFORMATION_FAQ_ANSWER,
  PRODUCT_INFORMATION_VERIFICATION_COPY,
  productDetailGallery,
  productDetailPendingItems,
} from '../src/components/product-detail-policy';
import type { StorefrontProduct } from '../src/components/storefront-product';
import type { StorefrontMedia } from '../src/components/storefront-media';

function media(url: string, profile: StorefrontMedia['profile'] = 'WEB_CARD'): StorefrontMedia {
  return { url, width: 800, height: 800, profile };
}

function product(overrides: Partial<StorefrontProduct> = {}): StorefrontProduct {
  return {
    product_id: 'product-1',
    sku: 'BC-001',
    slug: 'product-1',
    product_name: 'Producto',
    business_line: 'BEAUTY_CARE',
    brand: 'LIHEN',
    category: 'Cuidado',
    subcategory: null,
    description: null,
    sale_price: 10000,
    main_image_url: 'https://example.test/main.webp',
    image_urls: [],
    card_media: media('https://example.test/card.webp'),
    detail_media: null,
    gallery_media: [],
    availability: 'AVAILABLE',
    ...overrides,
  };
}

describe('QA-C product detail policy', () => {
  it('deduplicates Beauty Care gallery and caps it at five images', () => {
    const gallery = [
      media('https://example.test/1.webp', 'WEB_DETAIL'),
      media('https://example.test/1.webp', 'WEB_DETAIL'),
      media('https://example.test/2.webp'),
      media('https://example.test/3.webp'),
      media('https://example.test/4.webp'),
      media('https://example.test/5.webp'),
      media('https://example.test/6.webp'),
    ];
    expect(productDetailGallery(product({ gallery_media: gallery })).map((item) => item.url)).toEqual([
      'https://example.test/1.webp',
      'https://example.test/2.webp',
      'https://example.test/3.webp',
      'https://example.test/4.webp',
      'https://example.test/5.webp',
    ]);
  });

  it('allows up to ten images for Style without inventing missing gallery media', () => {
    const gallery = Array.from({ length: 12 }, (_, index) => media(`https://example.test/${index}.webp`));
    expect(productDetailGallery(product({ business_line: 'STYLE', gallery_media: gallery }))).toHaveLength(10);
  });

  it('uses verified detail media before the card fallback when no gallery exists', () => {
    const detail = media('https://example.test/detail.webp', 'WEB_DETAIL');
    expect(productDetailGallery(product({ detail_media: detail }))).toEqual([detail]);
  });

  it('keeps pending public fields specific to each business line', () => {
    expect(productDetailPendingItems('BEAUTY_CARE')).toContain('Beneficios y atributos comerciales.');
    expect(productDetailPendingItems('STYLE')).toContain('Talla, ajuste y medidas.');
  });

  it('does not expose internal QA or Intelligence jargon in public verification copy', () => {
    for (const text of [PRODUCT_INFORMATION_VERIFICATION_COPY, PRODUCT_INFORMATION_FAQ_ANSWER]) {
      expect(text).not.toMatch(/QA-C|Intelligence|evidence_count|RPC/i);
    }
  });
});
