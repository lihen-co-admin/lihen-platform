import { describe, expect, it, vi } from 'vitest';
import {
  createTikTokHttpTransport,
  readTikTokCreator,
  signTikTokCreator,
} from '../../../supabase/functions/marketing-social-runtime/tiktok-http';
import {
  assessTikTok,
  configuredTikTokTransport,
  executeTikTok,
} from '../../../supabase/functions/marketing-social-runtime/tiktok-provider';

const config = {
  enabled: true,
  accessToken: 'test-token',
  verifiedUrlPrefix: 'https://media.invalid/storage/v1/object/public/lihen-editorial-video/',
  audited: false,
  authorizedScopes: ['video.publish'],
  contextSigningKey: 'test-only-signing-key-more-than-32-chars',
  mediaOrigin: 'https://media.invalid',
};
const video = {
  publicUrl:
    'https://media.invalid/storage/v1/object/public/lihen-editorial-video/products/00000000-0000-0000-0000-000000000001/reels/00000000-0000-0000-0000-000000000002.mp4',
  mediaType: 'VIDEO' as const,
};

const u32 = (value: number) => {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value);
  return bytes;
};
const join = (...parts: Uint8Array[]) => {
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
};
const ascii = (value: string) => new TextEncoder().encode(value);
const box = (type: string, ...parts: Uint8Array[]) => {
  const body = join(...parts);
  return join(u32(body.length + 8), ascii(type), body);
};
const movie = (seconds = 12) => {
  const header = join(new Uint8Array(12), u32(1000), u32(seconds * 1000));
  return join(
    box('ftyp', ascii('isom'), u32(0)),
    box(
      'moov',
      box('mvhd', header),
      box(
        'trak',
        box(
          'mdia',
          box('mdhd', header),
          box('hdlr', new Uint8Array(8), ascii('vide')),
          box(
            'minf',
            box(
              'stbl',
              box('stts', u32(0), u32(1), u32(seconds), u32(1000)),
              box('stsz', u32(0), u32(1), u32(seconds)),
            ),
          ),
        ),
      ),
    ),
    box('mdat', new Uint8Array(seconds)),
  );
};
const mediaResponse = (bytes = movie(), headers: Record<string, string> = {}) =>
  new Response(bytes, {
    headers: {
      'content-type': 'video/mp4',
      'content-length': String(bytes.length),
      etag: '"test-object"',
      ...headers,
    },
  });
function fixture(status: unknown = 'PROCESSING_DOWNLOAD') {
  const request = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    if (String(url) === video.publicUrl && init?.method === 'GET')
      return mediaResponse(movie(), { etag: '"test-object"' });
    if (String(url) === video.publicUrl && init?.method === 'HEAD')
      return new Response(null, {
        headers: {
          'content-length': String(movie().length),
          'content-type': 'video/mp4',
          etag: '"test-object"',
        },
      });
    const data = String(url).endsWith('creator_info/query/')
      ? {
          error: { code: 'ok' },
          data: {
            creator_username: 'fixture-creator',
            privacy_level_options: ['SELF_ONLY'],
            max_video_post_duration_sec: 60,
            comment_disabled: false,
            duet_disabled: true,
            stitch_disabled: false,
          },
        }
      : String(url).endsWith('video/init/')
        ? { data: { publish_id: 'provider-operation' }, error: { code: 'ok' } }
        : { error: { code: 'ok' }, data: { status } };
    return new Response(JSON.stringify(data));
  });
  return { request, transport: createTikTokHttpTransport(config, null, request) };
}
describe('TikTok HTTP transport — injected HTTP only', () => {
  it('uses verified endpoints/headers, PULL_FROM_URL, and configured explicit choices', async () => {
    const { request, transport } = fixture();
    const creator = await transport.queryCreator(new AbortController().signal);
    transport.creator = creator;
    const choices = {
      creatorRevision: creator.revision,
      privacy: 'SELF_ONLY',
      consent: true as const,
      interactions: { comment: false, duet: false, stitch: true },
      disclosure: {
        ownBrand: false,
        brandedContent: false,
        musicUsageAccepted: true as const,
      },
    };
    expect(
      await transport.verifyVideo(video, new AbortController().signal, creator.maxVideoDurationSec),
    ).toBe(true);
    await transport.initialize(
      { videoUrl: video.publicUrl, caption: 'Editable caption #tag', choices },
      new AbortController().signal,
    );
    await transport.status('provider-operation', new AbortController().signal);
    const calls = request.mock.calls;
    const initialized = calls.find(([url]) => String(url).endsWith('video/init/'))!;
    expect(JSON.parse(String(initialized[1]?.body))).toEqual({
      source_info: { source: 'PULL_FROM_URL', video_url: video.publicUrl },
      post_info: {
        title: 'Editable caption #tag',
        privacy_level: 'SELF_ONLY',
        disable_comment: true,
        disable_duet: true,
        disable_stitch: false,
        brand_organic_toggle: false,
        brand_content_toggle: false,
      },
    });
    for (const [url, init] of calls.filter(([, init]) => init?.method === 'POST')) {
      expect(String(url)).toMatch(
        /^https:\/\/open\.tiktokapis\.com\/v2\/post\/publish\/(creator_info\/query|video\/init|status\/fetch)\/$/,
      );
      expect(init?.headers).toEqual({
        Authorization: 'Bearer test-token',
        'Content-Type': 'application/json; charset=UTF-8',
      });
      expect(init?.redirect).toBe('error');
    }
    const head = calls.find(([, init]) => init?.method === 'HEAD')!;
    expect(head[1]?.redirect).toBe('error');
    expect(head[1]?.headers).toEqual({ 'If-Match': '"test-object"' });
    const statusCall = calls.find(([url]) => String(url).endsWith('status/fetch/'))!;
    expect(JSON.parse(String(statusCall[1]?.body))).toEqual({ publish_id: 'provider-operation' });
  });
  it.each([
    ['PUBLISH_COMPLETE', 'COMPLETE'],
    ['FAILED', 'FAILED'],
    ['PROCESSING_DOWNLOAD', 'PROCESSING'],
    ['PROCESSING_UPLOAD', 'PROCESSING'],
    ['UNRECOGNIZED', 'UNKNOWN'],
    [null, 'UNKNOWN'],
  ])('normalizes only verified status %s', async (status, expected) => {
    const { transport } = fixture(status);
    const result = await transport.status('operation-id', new AbortController().signal);
    expect(result.state).toBe(expected);
    if (status === 'PUBLISH_COMPLETE')
      expect(result).toEqual({ state: 'COMPLETE', publicationRef: 'tiktok:publish:operation-id' });
  });
  it('does not call HTTP when disabled or missing a Direct Post scope', async () => {
    const request = vi.fn();
    for (const unsafe of [
      { ...config, enabled: false },
      { ...config, authorizedScopes: ['video.upload'] },
    ]) {
      expect(configuredTikTokTransport(unsafe, null, request)).toBeNull();
      const transport = createTikTokHttpTransport(unsafe, null, request);
      await expect(transport.queryCreator(new AbortController().signal)).rejects.toThrow();
    }
    expect(request).not.toHaveBeenCalled();
  });
  it('constructs fixed official transport without dynamic wire configuration', () => {
    expect(configuredTikTokTransport(config, null, vi.fn())?.physicalVerificationAvailable).toBe(
      true,
    );
  });
  it('validates duration against current creator info and refuses fabricated interaction choices', async () => {
    const { transport } = fixture();
    transport.creator = await transport.queryCreator(new AbortController().signal);
    const choices = {
      creatorRevision: transport.creator.revision,
      privacy: 'SELF_ONLY',
      consent: true as const,
      interactions: { comment: false, duet: false, stitch: true },
    };
    const untrusted = { ...video, durationSeconds: 1, verifiedEtag: '"browser"' };
    expect(assessTikTok(config, transport, untrusted, choices)).not.toContain(
      'TIKTOK_VIDEO_DURATION_VERIFICATION_UNAVAILABLE',
    );
    const initialize = vi.spyOn(transport, 'initialize');
    expect(
      await executeTikTok(config, transport, untrusted, choices, 'copy', async () => {}),
    ).toEqual({ outcome: 'UNCERTAIN' });
    // Browser-supplied duration/ETag are ignored. The server performs its own
    // governed byte measurement before initialization.
    expect(initialize).toHaveBeenCalledTimes(1);
    transport.creator.interactions = [
      { key: 'interaction', label: 'Test interaction', allowed: false },
    ];
    expect(
      assessTikTok(config, transport, video, { ...choices, interactions: { interaction: true } }),
    ).toContain('TIKTOK_EXPLICIT_CHOICES_REQUIRED');
  });
  it.each([
    'redirect',
    'changed-object',
    'oversized',
    'wrong-mime',
    'weak-etag',
    'missing-etag',
    'valid-head',
  ])('rejects %s durable object at download preflight', async (problem) => {
    const { transport, request } = fixture();
    request.mockResolvedValue(
      new Response(null, {
        status: problem === 'redirect' ? 302 : 200,
        headers: {
          'content-type': problem === 'wrong-mime' ? 'image/png' : 'video/mp4',
          'content-length': problem === 'oversized' ? '104857601' : '1000',
          etag:
            problem === 'changed-object'
              ? '"changed"'
              : problem === 'weak-etag'
                ? 'W/"weak"'
                : problem === 'missing-etag'
                  ? ''
                  : '"test-object"',
        },
      }),
    );
    expect(await transport.verifyVideo(video, new AbortController().signal)).toBe(false);
  });
  it('fails closed on malformed JSON and provider errors without retries', async () => {
    const { transport, request } = fixture();
    request.mockResolvedValueOnce(new Response('not-json'));
    await expect(transport.queryCreator(new AbortController().signal)).rejects.toThrow();
    expect(request).toHaveBeenCalledTimes(1);
    request.mockResolvedValueOnce(new Response('{}', { status: 429 }));
    await expect(transport.status('id', new AbortController().signal)).rejects.toThrow();
    expect(request).toHaveBeenCalledTimes(2);
  });
  it('binds creator receipt to operator/publication/media/config and rejects tampering/expiry', async () => {
    const { transport } = fixture();
    const creator = await transport.queryCreator(new AbortController().signal);
    const binding = { actorId: 'actor', publicationId: 'publication', media: video };
    const token = await signTikTokCreator(config, binding, creator);
    expect(await readTikTokCreator(config, binding, token)).toEqual(creator);
    expect(await readTikTokCreator(config, { ...binding, actorId: 'other' }, token)).toBeNull();
    expect(
      await readTikTokCreator({ ...config, accessToken: 'rotated' }, binding, token),
    ).toBeNull();
    expect(await readTikTokCreator(config, binding, `${token}tampered`)).toBeNull();
    const expired = await signTikTokCreator(config, binding, {
      ...creator,
      expiresAt: '2000-01-01',
    });
    expect(await readTikTokCreator(config, binding, expired)).toBeNull();
  });
});
