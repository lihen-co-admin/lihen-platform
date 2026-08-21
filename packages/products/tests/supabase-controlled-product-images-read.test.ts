import { describe, expect, it, vi } from 'vitest';
import { SupabaseProductImageRepository } from '../src';

describe('Supabase controlled product image reads', () => {
  it('is blocked by default without calling RPC', async () => {
    const rpc = vi.fn();
    const repository = new SupabaseProductImageRepository({ rpc } as never);
    await expect(repository.findByProductId('00000000-0000-0000-0000-000000000001')).rejects.toMatchObject({ code: 'PRODUCT_IMAGES_UNAVAILABLE' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('uses only get_product_images when enabled', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    const repository = new SupabaseProductImageRepository({ rpc } as never, { readEnabled: true });
    await expect(repository.findByProductId('00000000-0000-0000-0000-000000000001')).resolves.toEqual([]);
    expect(rpc).toHaveBeenCalledWith('get_product_images', { p_product_id: '00000000-0000-0000-0000-000000000001' });
  });
});
