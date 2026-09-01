import { describe, expect, it } from 'vitest';
import {
  ProductVariant,
  productVariantFingerprint,
  sameProductVariantDefinition,
} from '../src/domain/product-variant';

describe('WAVE 4 / GAP-011 Product Variant domain', () => {
  it('models a Beauty Care commercial presentation under one product', () => {
    const variant = new ProductVariant({
      id: 'variant-1',
      productId: 'product-1',
      variantCode: '50ML',
      attributes: {
        presentation: ' Frasco ',
        quantity: 50,
        unit: ' ml ',
        tone: ' Rosa ',
      },
    });

    expect(variant.productId).toBe('product-1');
    expect(variant.variantCode).toBe('50ML');
    expect(variant.attributes).toEqual({
      tone: 'Rosa',
      presentation: 'Frasco',
      quantity: 50,
      unit: 'ml',
    });
  });

  it('models STYLE differentiators without creating another Product Master', () => {
    const variant = new ProductVariant({
      id: 'variant-style-1',
      productId: 'product-style-1',
      attributes: {
        sizeRange: ' S - L ',
        color: ' Negro ',
        material: ' Suplex ',
        pieceCount: 2,
        styleAttributes: {
          fit: 'deportivo',
          compression: true,
        },
      },
    });

    expect(variant.productId).toBe('product-style-1');
    expect(variant.attributes.color).toBe('Negro');
    expect(variant.attributes.pieceCount).toBe(2);
  });

  it('requires a stable parent Product Master identity', () => {
    expect(
      () =>
        new ProductVariant({
          id: 'variant-1',
          productId: '   ',
          attributes: { color: 'Negro' },
        }),
    ).toThrow('Product variant productId is required.');
  });

  it('requires a real differentiator or variant code', () => {
    expect(
      () =>
        new ProductVariant({
          id: 'variant-1',
          productId: 'product-1',
          attributes: {},
        }),
    ).toThrow(
      'Product variant requires a variantCode or at least one differentiating attribute.',
    );
  });

  it('rejects invalid commercial quantities and counts', () => {
    expect(
      () =>
        new ProductVariant({
          id: 'variant-1',
          productId: 'product-1',
          attributes: { quantity: 0 },
        }),
    ).toThrow('Product variant quantity must be greater than zero.');

    expect(
      () =>
        new ProductVariant({
          id: 'variant-2',
          productId: 'product-1',
          attributes: { packCount: 1.5 },
        }),
    ).toThrow('Product variant packCount must be an integer.');
  });

  it('builds a deterministic review fingerprint independent of attribute order', () => {
    const first = new ProductVariant({
      id: 'a',
      productId: 'product-1',
      attributes: {
        color: 'Negro',
        size: 'M',
        styleAttributes: { fit: 'Slim', imported: true },
      },
    });

    const second = new ProductVariant({
      id: 'b',
      productId: 'product-1',
      attributes: {
        styleAttributes: { imported: true, fit: 'Slim' },
        size: 'M',
        color: 'Negro',
      },
    });

    expect(productVariantFingerprint(first)).toBe(
      productVariantFingerprint(second),
    );
    expect(sameProductVariantDefinition(first, second)).toBe(true);
  });

  it('never considers variants of different products equivalent', () => {
    const first = new ProductVariant({
      id: 'a',
      productId: 'product-1',
      attributes: { color: 'Negro' },
    });

    const second = new ProductVariant({
      id: 'b',
      productId: 'product-2',
      attributes: { color: 'Negro' },
    });

    expect(sameProductVariantDefinition(first, second)).toBe(false);
  });

  it('does not embed price, stock, image or supplier ownership in the variant contract', () => {
    const variant = new ProductVariant({
      id: 'variant-1',
      productId: 'product-1',
      attributes: { tone: '01' },
    });

    expect('salePrice' in variant).toBe(false);
    expect('stock' in variant).toBe(false);
    expect('imageUrl' in variant).toBe(false);
    expect('supplierId' in variant).toBe(false);
  });
});
