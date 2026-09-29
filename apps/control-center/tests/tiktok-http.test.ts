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
  verifiedUrlPrefix: 'https://media.invalid/videos/',
  audited: false,
  authorizedScopes: ['video.publish'],
  contextSigningKey: 'test-only-signing-key-more-than-32-chars',
};
const video = { publicUrl: 'https://media.invalid/videos/a.mp4', mediaType: 'VIDEO' as const };
function fixture(status: unknown = 'PROCESSING_DOWNLOAD') {
  const request = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    if (init?.method === 'HEAD')
      return new Response(null, {
        headers: { 'content-length': '1000', 'content-type': 'video/mp4', etag: '"test-object"' },
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
    };
    await transport.initialize(
      { videoUrl: video.publicUrl, caption: 'Editable caption #tag', choices },
      new AbortController().signal,
    );
    await transport.status('provider-operation', new AbortController().signal);
    expect(await transport.verifyVideo(video, new AbortController().signal)).toBe(false);
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
    expect(head[1]?.headers).toBeUndefined();
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
      false,
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
    expect(assessTikTok(config, transport, untrusted, choices)).toContain(
      'TIKTOK_VIDEO_DURATION_VERIFICATION_UNAVAILABLE',
    );
    const initialize = vi.spyOn(transport, 'initialize');
    expect(
      await executeTikTok(config, transport, untrusted, choices, 'copy', async () => {}),
    ).toEqual({ outcome: 'UNCERTAIN' });
    expect(initialize).not.toHaveBeenCalled();
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
