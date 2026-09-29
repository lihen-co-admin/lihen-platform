import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { readEditorialVideoAssets } from '../src/composition/editorial-video-assets';
import {
  createEditorialDraft,
  resolveProductAssociationsFromMedia,
} from '../src/composition/editorial-workspace';
import { EditorialComposer } from '../src/components/EditorialComposer';

function item() {
  return createEditorialDraft(
    {
      copy: 'TikTok copy',
      callToAction: '',
      hashtags: '',
      creativeAssetIds: ['video'],
      channels: ['TIKTOK'],
      productId: 'product',
      campaignName: '',
      date: '',
    },
    new Date(),
    () => 'id',
  )[0]!;
}
describe('durable editorial videos', () => {
  it('reads only ACTIVE videos of the requested product through authorized RPC', async () => {
    const row = {
      id: 'video',
      product_id: 'product',
      public_url: 'https://example.invalid/video.mp4',
      mime_type: 'video/mp4',
      status: 'ACTIVE',
    };
    const rpc = vi.fn(async () => ({
      data: [
        row,
        { ...row, status: 'ARCHIVED' },
        { ...row, product_id: 'other' },
        { ...row, mime_type: 'image/png' },
      ],
      error: null,
    }));
    expect(await readEditorialVideoAssets('product', { rpc })).toEqual([
      { id: 'video', productId: 'product', publicUrl: row.public_url, mimeType: 'video/mp4' },
    ]);
    expect(rpc).toHaveBeenCalledWith('get_marketing_editorial_video_assets', {
      p_product_id: 'product',
    });
  });
  it('fails closed when authorized video RPC fails', async () => {
    await expect(
      readEditorialVideoAssets('product', { rpc: async () => ({ data: null, error: 'denied' }) }),
    ).rejects.toThrow('Videos autorizados');
  });
  it('rehydrates first video product after durable reload without using images', async () => {
    const images = vi.fn(async () => [{ id: 'video' }]);
    const videos = vi.fn(async (id: string) => (id === 'product' ? [{ id: 'video' }] : []));
    const restored = await resolveProductAssociationsFromMedia(
      [{ ...item(), productId: '' }],
      [{ id: 'other' }, { id: 'product' }],
      images,
      videos,
    );
    expect(restored[0]?.productId).toBe('product');
    expect(restored[0]?.publication.creativeAssetIds).toEqual(['video']);
    expect(images).not.toHaveBeenCalled();
  });
  it('never substitutes an image association when the video is unavailable', async () => {
    const restored = await resolveProductAssociationsFromMedia(
      [item()],
      [{ id: 'product' }],
      async () => [{ id: 'video' }],
      async () => [],
    );
    expect(restored[0]?.productId).toBe('');
  });
  it('renders TikTok video selection without uploads or image controls', () => {
    const html = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(EditorialComposer, {
          item: item(),
          products: [],
          busy: false,
          onSave: () => {},
          onClose: () => {},
        }),
      ),
    );
    expect(html).toContain('Video autorizado');
    expect(html).toContain('Selecciona un video');
    expect(html).not.toContain('Usar imagen');
    expect(html).not.toContain('type="file"');
  });
});
