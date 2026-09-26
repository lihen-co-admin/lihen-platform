import { describe, expect, it, vi } from 'vitest';
import { MetaSocialPublishingAdapter } from '../src';

const config = {
  accessToken: 'server-secret',
  facebookPageId: 'page-1',
  instagramAccountId: 'ig-1',
  graphApiVersion: 'v24.0',
  enabled: true,
} as const;

const base = {
  attemptId: 'attempt-1',
  preparedPublicationId: 'publication-1',
  copy: 'Hola LIHEN',
  callToAction: 'Conoce más',
  hashtags: ['LIHEN'],
  creativeAssetIds: ['asset-1'],
} as const;

describe('MetaSocialPublishingAdapter', () => {
  it('fails closed while external publication is disabled', async () => {
    const request = vi.fn();
    const adapter = new MetaSocialPublishingAdapter(
      { ...config, enabled: false },
      async () => ({ publicUrl: 'https://example.test/image.jpg', mediaType: 'IMAGE' }),
      request as unknown as typeof fetch,
    );

    await expect(adapter.publish({ ...base, channel: 'FACEBOOK' })).resolves.toEqual({
      outcome: 'FAILED',
      failureCode: 'META_PUBLICATION_DISABLED',
    });
    expect(request).not.toHaveBeenCalled();
  });

  it('publishes a Facebook image through the page photos endpoint', async () => {
    const request = vi.fn(async () => new Response(JSON.stringify({ id: 'fb-post-1' })));
    const adapter = new MetaSocialPublishingAdapter(
      config,
      async () => ({ publicUrl: 'https://example.test/image.jpg', mediaType: 'IMAGE' }),
      request as unknown as typeof fetch,
    );

    await expect(adapter.publish({ ...base, channel: 'FACEBOOK' })).resolves.toEqual({
      outcome: 'SUCCEEDED',
      externalPublicationRef: 'fb-post-1',
    });
    expect(String(request.mock.calls[0]?.[0])).toContain('/page-1/photos');
  });

  it('creates then publishes an Instagram feed container', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'container-1' })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'ig-media-1' })));
    const adapter = new MetaSocialPublishingAdapter(
      config,
      async () => ({ publicUrl: 'https://example.test/image.jpg', mediaType: 'IMAGE' }),
      request as unknown as typeof fetch,
    );

    await expect(adapter.publish({ ...base, channel: 'INSTAGRAM_FEED' })).resolves.toEqual({
      outcome: 'SUCCEEDED',
      externalPublicationRef: 'ig-media-1',
    });
    expect(String(request.mock.calls[0]?.[0])).toContain('/ig-1/media');
    expect(String(request.mock.calls[1]?.[0])).toContain('/ig-1/media_publish');
  });
});
