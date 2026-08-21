import { describe, expect, it } from 'vitest';
import {
  PRODUCT_IMAGE_ORIGINALS_BUCKET,
  PRODUCT_IMAGE_ORIGINAL_MAX_BYTES,
  PRODUCT_IMAGE_WEB_BUCKET,
  buildOriginalProductImagePath,
  buildWebProductImagePath,
} from '../src';

const productId = '11111111-1111-4111-8111-111111111111';
const imageId = '22222222-2222-4222-8222-222222222222';
const sha256 = 'a'.repeat(64);

describe('product image storage policy', () => {
  it('builds immutable canonical original and web paths', () => {
    const base = { productId, imageId, sha256, byteSize: 1024 } as const;
    expect(PRODUCT_IMAGE_ORIGINALS_BUCKET).toBe('lihen-product-originals');
    expect(PRODUCT_IMAGE_WEB_BUCKET).toBe('lihen-product-web');
    expect(buildOriginalProductImagePath({ ...base, mimeType: 'image/jpeg' }))
      .toBe(`products/${productId}/${imageId}/original/${sha256}.jpg`);
    expect(buildWebProductImagePath({ ...base, mimeType: 'image/webp' }))
      .toBe(`products/${productId}/${imageId}/web/${sha256}.webp`);
  });

  it('rejects oversized originals', () => {
    expect(() => buildOriginalProductImagePath({
      productId, imageId, sha256, mimeType: 'image/jpeg', byteSize: PRODUCT_IMAGE_ORIGINAL_MAX_BYTES + 1,
    })).toThrow(/exceeds/);
  });
});
