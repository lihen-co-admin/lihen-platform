import { describe, expect, it, vi } from 'vitest';
import { SupabaseProductImageRepository } from '../src';

describe('Supabase controlled product image reads', () => {
  it('is blocked by default without calling RPC', async () => {
    const rpc = vi.fn();
    const repository = new SupabaseProductImageRepository({ rpc } as never);
    await expect(repository.findByProductId('00000000-0000-0000-0000-000000000001')).rejects.toMatchObject({ code: 'PRODUCT_IMAGES_UNAVAILABLE' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('maps canonical Media V2 image metadata when the controlled RPC returns it', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{
        id: '22222222-2222-4222-8222-222222222222',
        product_id: '11111111-1111-4111-8111-111111111111',
        public_url: 'https://example.com/card.webp',
        alt_text: 'Producto prueba',
        is_main: true,
        sort_order: 0,
        source_type: 'CATALOG_EVIDENCE_CROP',
        status: 'ACTIVE',
        source_id: '33333333-3333-4333-8333-333333333333',
        asset_role: 'DERIVATIVE',
        derivative_profile: 'WEB_CARD',
      }],
      error: null,
    });
    const repository = new SupabaseProductImageRepository({ rpc } as never, { readEnabled: true });

    const [image] = await repository.findByProductId('11111111-1111-4111-8111-111111111111');

    expect(image).toMatchObject({
      sourceType: 'CATALOG_EVIDENCE_CROP',
      sourceId: '33333333-3333-4333-8333-333333333333',
      assetRole: 'DERIVATIVE',
      derivativeProfile: 'WEB_CARD',
    });
  });

  it('uses only get_product_images when enabled', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    const repository = new SupabaseProductImageRepository({ rpc } as never, { readEnabled: true });
    await expect(repository.findByProductId('00000000-0000-0000-0000-000000000001')).resolves.toEqual([]);
    expect(rpc).toHaveBeenCalledWith('get_product_images', { p_product_id: '00000000-0000-0000-0000-000000000001' });
  });
});
