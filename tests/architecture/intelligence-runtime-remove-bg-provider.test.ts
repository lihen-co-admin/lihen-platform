import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createRemoveBgTransformationProvider,
} from '../../supabase/functions/intelligence-runtime/providers/remove-bg-image-transformation';

function stubDenoEnv(values: Record<string, string | undefined>) {
  vi.stubGlobal('Deno', {
    env: {
      get(name: string) {
        return values[name];
      },
    },
  });
}

describe('Intelligence Runtime remove.bg provider adapter', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('fails closed when the provider credential is not configured', async () => {
    stubDenoEnv({});

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const provider = createRemoveBgTransformationProvider();

    await expect(
      provider.removeBackground({
        bytes: new Uint8Array([1, 2, 3]),
        mimeType: 'image/png',
      }),
    ).rejects.toThrow('REMOVE_BG_API_KEY_NOT_CONFIGURED');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an empty source before contacting the provider', async () => {
    stubDenoEnv({
      REMOVE_BG_API_KEY: 'test-only-secret',
    });

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const provider = createRemoveBgTransformationProvider();

    await expect(
      provider.removeBackground({
        bytes: new Uint8Array(),
        mimeType: 'image/png',
      }),
    ).rejects.toThrow('REMOVE_BG_SOURCE_EMPTY');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects unsupported source MIME types before contacting the provider', async () => {
    stubDenoEnv({
      REMOVE_BG_API_KEY: 'test-only-secret',
    });

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const provider = createRemoveBgTransformationProvider();

    await expect(
      provider.removeBackground({
        bytes: new Uint8Array([1]),
        mimeType: 'image/gif',
      }),
    ).rejects.toThrow(
      'REMOVE_BG_SOURCE_MIME_NOT_ALLOWED:image/gif',
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('calls remove.bg with the server-side key and returns transformed bytes', async () => {
    stubDenoEnv({
      REMOVE_BG_API_KEY: 'test-only-secret',
    });

    const resultBytes = new Uint8Array([9, 8, 7]);

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(resultBytes, {
        status: 200,
        headers: {
          'content-type': 'image/webp; charset=binary',
        },
      }),
    );

    vi.stubGlobal('fetch', fetchMock);

    const provider = createRemoveBgTransformationProvider();

    const result = await provider.removeBackground({
      bytes: new Uint8Array([1, 2, 3]),
      mimeType: 'image/png',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ];

    expect(url).toBe(
      'https://api.remove.bg/v1.0/removebg',
    );
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({
      'X-Api-Key': 'test-only-secret',
    });
    expect(init.body).toBeInstanceOf(FormData);

    expect(result.mimeType).toBe('image/webp');
    expect(Array.from(result.bytes)).toEqual([9, 8, 7]);
  });

  it('surfaces provider HTTP failure without converting it into success', async () => {
    stubDenoEnv({
      REMOVE_BG_API_KEY: 'test-only-secret',
    });

    const fetchMock = vi.fn().mockResolvedValue(
      new Response('quota exceeded', {
        status: 429,
      }),
    );

    vi.stubGlobal('fetch', fetchMock);

    const provider = createRemoveBgTransformationProvider();

    await expect(
      provider.removeBackground({
        bytes: new Uint8Array([1]),
        mimeType: 'image/jpeg',
      }),
    ).rejects.toThrow(
      'REMOVE_BG_PROVIDER_FAILED:429:quota exceeded',
    );
  });

  it('fails closed when the provider returns an empty successful body', async () => {
    stubDenoEnv({
      REMOVE_BG_API_KEY: 'test-only-secret',
    });

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new Uint8Array(), {
        status: 200,
        headers: {
          'content-type': 'image/png',
        },
      }),
    );

    vi.stubGlobal('fetch', fetchMock);

    const provider = createRemoveBgTransformationProvider();

    await expect(
      provider.removeBackground({
        bytes: new Uint8Array([1]),
        mimeType: 'image/webp',
      }),
    ).rejects.toThrow(
      'REMOVE_BG_PROVIDER_EMPTY_RESULT',
    );
  });
});
