import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ProductDetailDTO, ProductImageDTO } from '@lihen/products';
import { VerifiedProductImagesPanel } from '../src/components/VerifiedProductImagesPanel';
import {
  createVerifiedImageResearch,
  evaluateExistingProductImage,
  productImageSearchIdentity,
} from '../src/composition/visual-intelligence';

const product: ProductDetailDTO = {
  id: '27d3e080-4b71-0dc9-6fa8-19ade77a4ad2',
  sku: 'BC-20869',
  catalogCode: 'BCV5-0870',
  name: '´ MORADA (',
  slug: 'morada',
  businessLine: 'BEAUTY_CARE',
  status: 'ACTIVE',
  salePrice: { amount: 1, currency: 'COP' },
};
const image: ProductImageDTO = {
  id: 'crop',
  productId: product.id,
  publicUrl: 'https://example.invalid/crop',
  isMain: true,
  sortOrder: 0,
  sourceType: 'CATALOG_EVIDENCE_CROP',
};
describe('verified images read-only UI boundary', () => {
  it('preserves the current crop and reports identity independently of quality', () => {
    const before = JSON.stringify(image);
    expect(evaluateExistingProductImage(image)).toMatchObject({
      identityMatch: 'INSUFFICIENT_EVIDENCE',
      quality: 'UNKNOWN_DIMENSIONS',
    });
    expect(JSON.stringify(image)).toBe(before);
    expect(evaluateExistingProductImage(image, { widthPx: 2000, heightPx: 2000 })).toMatchObject({
      identityMatch: 'INSUFFICIENT_EVIDENCE',
      quality: 'FALLBACK',
    });
    expect(
      evaluateExistingProductImage(
        { ...image, sourceType: 'OFFICIAL_WEB' },
        { widthPx: 2000, heightPx: 2000 },
      ),
    ).toMatchObject({ identityMatch: 'INSUFFICIENT_EVIDENCE', quality: 'READY' });
    expect(productImageSearchIdentity(product)).toEqual({
      productId: product.id,
      productName: product.name,
      sku: 'BC-20869',
      brand: undefined,
      brandId: undefined,
    });
  });
  it.each([true, false])(
    'renders safe empty state for authorized=%s without any writes or imports',
    (authorized) => {
      const html = renderToStaticMarkup(
        createElement(VerifiedProductImagesPanel, {
          product,
          images: [image],
          galleryReadable: true,
          stagedCount: 2,
          authorized,
          userId: 'owner',
        }),
      );
      expect(html).toContain('LIHEN Intelligence — Imágenes verificadas');
      expect(html).toContain('INSUFFICIENT_EVIDENCE');
      expect(html).toContain('SEARCH_PROVIDER_NOT_CONFIGURED');
      expect(html).toContain('UNKNOWN_DIMENSIONS');
      expect(html).toContain('fotografías propias');
      expect(html).toContain('subida manual: 3');
      expect(html).toContain('disabled=""');
      expect(html).not.toContain('<img');
      expect(html).not.toContain('READY_FOR_CONTROLLED_SAVE');
      expect(html).toContain('Guardado externo bloqueado');
      expect(html).toContain('Guardado externo deshabilitado');
      expect(html).not.toContain('Descargar y preparar WebP');
    },
  );
  it('does not invent gallery capacity when persistent read is blocked', () => {
    const html = renderToStaticMarkup(
      createElement(VerifiedProductImagesPanel, {
        product,
        images: [],
        galleryReadable: false,
        stagedCount: 0,
        authorized: true,
        userId: 'owner',
      }),
    );
    expect(html).toContain('subida manual: No verificable');
  });
  it('has no configured image provider by default and cannot start the mutating Lens intake', async () => {
    const composition = createVerifiedImageResearch();
    expect(composition.configured).toBe(false);
    expect(Object.keys(composition).sort()).toEqual(['configured', 'dependencies', 'research']);
    const report = await composition.research(
      productImageSearchIdentity(product),
      {
        correlationId: 'test',
        requestedBy: 'owner',
        context: { contextId: 'test', type: 'PRODUCT', entityId: product.id, attributes: {} },
      },
      composition.dependencies,
    );
    expect(report.candidates).toEqual([]);
  });
});
