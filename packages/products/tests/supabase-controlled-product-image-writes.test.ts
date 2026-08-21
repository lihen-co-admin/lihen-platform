import { describe, expect, it, vi } from 'vitest';
import { ProductImage, SupabaseProductImageRepository } from '../src';

const image = new ProductImage({
  id: '00000000-0000-0000-0000-000000000101',
  productId: '00000000-0000-0000-0000-000000000001',
  publicUrl: 'https://example.com/image.jpg',
  altText: 'Imagen producto',
  isMain: true,
  sortOrder: 0,
  sourceType: 'MANUAL',
});

describe('FASE 1.16 controlled product image writes', () => {
  it('keeps AddProductImage blocked by default without calling RPC', async () => {
    const rpc = vi.fn();
    const repository = new SupabaseProductImageRepository({ rpc } as never);

    await expect(repository.add(image, 'op-add-1')).rejects.toMatchObject({
      code: 'PRODUCT_IMAGE_WRITE_BLOCKED',
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('uses only add_product_image_controlled when metadata writes are enabled', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{
        id: image.id,
        product_id: image.productId,
        public_url: image.publicUrl,
        storage_bucket: null,
        storage_path: null,
        alt_text: image.altText,
        is_main: true,
        sort_order: 0,
        source_type: 'MANUAL',
        status: 'ACTIVE',
        created_at: '2026-08-21T14:00:00Z',
        updated_at: '2026-08-21T14:00:00Z',
      }],
      error: null,
    });
    const repository = new SupabaseProductImageRepository(
      { rpc } as never,
      { controlledWriteEnabled: true },
    );

    await expect(repository.add(image, 'op-add-1')).resolves.toMatchObject({
      id: image.id,
      productId: image.productId,
      isMain: true,
    });

    expect(rpc).toHaveBeenCalledWith('add_product_image_controlled', {
      p_operation_key: 'op-add-1',
      p_image_id: image.id,
      p_product_id: image.productId,
      p_public_url: image.publicUrl,
      p_alt_text: image.altText,
      p_make_main: true,
    });
  });

  it('keeps SetMainProductImage blocked by default without calling RPC', async () => {
    const rpc = vi.fn();
    const repository = new SupabaseProductImageRepository({ rpc } as never);

    await expect(
      repository.setMain(image.productId, image.id, 'op-main-1'),
    ).rejects.toMatchObject({ code: 'PRODUCT_IMAGE_WRITE_BLOCKED' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('uses only set_main_product_image_controlled when metadata writes are enabled', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{
        id: image.id,
        product_id: image.productId,
        public_url: image.publicUrl,
        storage_bucket: null,
        storage_path: null,
        alt_text: image.altText,
        is_main: true,
        sort_order: 0,
        source_type: 'MANUAL',
        status: 'ACTIVE',
        created_at: '2026-08-21T14:00:00Z',
        updated_at: '2026-08-21T14:00:00Z',
      }],
      error: null,
    });
    const repository = new SupabaseProductImageRepository(
      { rpc } as never,
      { controlledWriteEnabled: true },
    );

    await expect(
      repository.setMain(image.productId, image.id, 'op-main-1'),
    ).resolves.toHaveLength(1);

    expect(rpc).toHaveBeenCalledWith('set_main_product_image_controlled', {
      p_operation_key: 'op-main-1',
      p_product_id: image.productId,
      p_image_id: image.id,
    });
  });
});
