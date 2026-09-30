import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProductListItemDTO } from '@lihen/products';
import { readEditorialGrounding } from '../src/composition/editorial-grounding';

const ports = vi.hoisted(() => ({
  product: vi.fn(),
  inventory: vi.fn(),
  images: vi.fn(),
  videos: vi.fn(),
}));
vi.mock('../src/composition/products', () => ({
  productsComposition: {
    canReadImages: true,
    getProductById: { execute: ports.product },
    getProductImages: { execute: ports.images },
  },
}));
vi.mock('../src/composition/inventory', () => ({
  inventoryComposition: { getInventory: { execute: ports.inventory } },
}));
vi.mock('../src/composition/editorial-video-assets', () => ({
  readEditorialVideoAssets: ports.videos,
}));

const selected = {
  id: 'p-a',
  sku: 'BC-067',
  name: 'Agua de rosas',
  brandId: 'brand-a',
  brandName: 'Marca A',
  categoryName: 'Cuidado',
} as ProductListItemDTO;
beforeEach(() => {
  vi.resetAllMocks();
  ports.product.mockResolvedValue(selected);
  ports.inventory.mockResolvedValue([
    { productId: 'p-b', stockAvailable: 100 },
    { productId: 'p-a', stockAvailable: 0 },
  ]);
  ports.images.mockResolvedValue([
    { id: 'image-a', productId: 'p-a' },
    { id: 'image-b', productId: 'p-b' },
  ]);
  ports.videos.mockResolvedValue([
    { id: 'video-a', productId: 'p-a' },
    { id: 'video-b', productId: 'p-b' },
  ]);
});

describe('governed internal editorial reads', () => {
  it('queries exact durable ID and binds only its stock and authorized media, never as copy claims', async () => {
    const result = await readEditorialGrounding(selected);
    expect(ports.product).toHaveBeenCalledWith({ type: 'GET_PRODUCT_BY_ID', productId: 'p-a' });
    expect(ports.images).toHaveBeenCalledWith({ productId: 'p-a' });
    expect(ports.videos).toHaveBeenCalledWith('p-a');
    const operational = result.evidence.internalFacts.filter((fact) =>
      ['inventory', 'images', 'videos'].includes(fact.field),
    );
    expect(operational.map((fact) => fact.value)).toEqual(['Stock: 0', 'image-a', 'video-a']);
    expect(operational.every((fact) => !fact.usableInCopy)).toBe(true);
    expect(result.evidence.officialBrandFacts).toEqual([]);
    expect(result.evidence.secondaryFacts).toEqual([]);
    expect(result.evidence.externalResearch).toBe('NOT_CONFIGURED');
    expect(
      result.evidence.sources.every(
        (source) => source.trust === 'VERIFIED_INTERNAL' && !source.url,
      ),
    ).toBe(true);
  });

  it('rejects the same product name under another brand before media reads', async () => {
    ports.product.mockResolvedValue({ ...selected, brandId: 'brand-b', brandName: 'Marca B' });
    await expect(readEditorialGrounding(selected)).rejects.toThrow('IDENTITY_MISMATCH');
    expect(ports.images).not.toHaveBeenCalled();
    expect(ports.videos).not.toHaveBeenCalled();
  });

  it('does not turn unavailable inventory or media into zero stock or invented evidence', async () => {
    ports.inventory.mockRejectedValue(new Error('unavailable'));
    ports.images.mockRejectedValue(new Error('unavailable'));
    ports.videos.mockRejectedValue(new Error('unavailable'));
    const result = await readEditorialGrounding(selected);
    expect(result.evidence.sources).toHaveLength(1);
    expect(result.evidence.internalFacts.some((fact) => fact.value.startsWith('Stock:'))).toBe(
      false,
    );
    for (const field of ['inventory', 'images', 'videos'])
      expect(result.evidence.unsupportedClaims).toContainEqual({
        field,
        status: 'INSUFFICIENT_EVIDENCE',
      });
  });

  it('stops if the selected product no longer exists', async () => {
    ports.product.mockResolvedValue(null);
    await expect(readEditorialGrounding(selected)).rejects.toThrow('PRODUCT_NOT_FOUND');
    expect(ports.inventory).not.toHaveBeenCalled();
  });
});
