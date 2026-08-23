import { describe, expect, it } from 'vitest';

import { evaluateCatalogPublication } from '../src';

const baseCandidate = {
  productId: 'product-1',
  status: 'ACTIVE',
  salePrice: 25_000,
  mainImageUrl: 'https://example.com/product.webp',
  includedInVersion: true,
  visibleOnWebsite: true,
} as const;

describe('catalog publication policy', () => {
  it('allows a valid canonical product in the PDF channel without using cost data', () => {
    expect(evaluateCatalogPublication(baseCandidate, 'PDF')).toEqual({
      channel: 'PDF',
      publishable: true,
      reasons: [],
    });
  });

  it('keeps PDF version inclusion separate from website visibility', () => {
    const candidate = { ...baseCandidate, visibleOnWebsite: false };

    expect(evaluateCatalogPublication(candidate, 'PDF').publishable).toBe(true);
    expect(evaluateCatalogPublication(candidate, 'WEB')).toEqual({
      channel: 'WEB',
      publishable: false,
      reasons: ['WEBSITE_VISIBILITY_DISABLED'],
    });
  });

  it('blocks publication when the commercial card lacks a main image', () => {
    expect(
      evaluateCatalogPublication({ ...baseCandidate, mainImageUrl: null }, 'PDF'),
    ).toEqual({
      channel: 'PDF',
      publishable: false,
      reasons: ['MISSING_MAIN_IMAGE'],
    });
  });

  it('blocks inactive products without changing their canonical status', () => {
    expect(evaluateCatalogPublication({ ...baseCandidate, status: 'INACTIVE' }, 'WEB')).toEqual({
      channel: 'WEB',
      publishable: false,
      reasons: ['PRODUCT_NOT_ACTIVE'],
    });
  });
});
