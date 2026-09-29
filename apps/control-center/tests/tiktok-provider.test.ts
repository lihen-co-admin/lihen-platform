import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  assessTikTok,
  configuredTikTokTransport,
  executeTikTok,
  tikTokConfig,
  type TikTokTransport,
  type TikTokEvidence,
} from '../../../supabase/functions/marketing-social-runtime/tiktok-provider';

const config = {
  enabled: true,
  accessToken: 'fake',
  verifiedUrlPrefix: 'https://media.invalid/video/',
  audited: false,
};
const video = { publicUrl: 'https://media.invalid/video/a.mp4', mediaType: 'VIDEO' as const };
const choices = {
  creatorRevision: 'v1',
  privacy: 'SELF_ONLY',
  consent: true as const,
  interactions: {},
};
function transport(): TikTokTransport {
  const creator = {
    accountId: 'test',
    revision: 'v1',
    expiresAt: '2099-01-01',
    privacyOptions: ['SELF_ONLY', 'TEST_PUBLIC'],
    consentText: 'Test consent',
    controlsSupported: true,
    maxVideoDurationSec: 120,
    interactions: [],
  };
  return {
    creator,
    contractVerified: true,
    physicalVerificationAvailable: true,
    authorizedScopes: ['video.publish'],
    queryCreator: vi.fn(async () => creator),
    verifyVideo: vi.fn(async () => true),
    initialize: vi.fn(async () => ({ publishId: 'accepted' })),
    status: vi.fn(async () => ({ state: 'PROCESSING' })),
  };
}
afterEach(() => vi.useRealTimers());
describe('TikTok contract boundary', () => {
  it('requires complete wire and authorization configuration, not just an enabled flag', () => {
    expect(configuredTikTokTransport(config)).toBeNull();
    expect(assessTikTok(config, null, video, choices)).toContain(
      'TIKTOK_PROVIDER_CONTRACT_UNVERIFIED',
    );
    expect(tikTokConfig(() => undefined).enabled).toBe(false);
    expect(tikTokConfig(() => 'TRUE').enabled).toBe(false);
  });
  it('requires verified video.publish authorization before any provider call', async () => {
    const t = transport();
    t.authorizedScopes = [];
    expect(assessTikTok(config, t, video, choices)).toContain(
      'TIKTOK_VIDEO_PUBLISH_SCOPE_REQUIRED',
    );
    await executeTikTok(config, t, video, choices, 'copy', async () => {});
    expect(t.queryCreator).not.toHaveBeenCalled();
    expect(t.initialize).not.toHaveBeenCalled();
  });
  it('treats a malformed acceptance as unknown and never checks success', async () => {
    const t = transport();
    vi.mocked(t.initialize).mockResolvedValue({ publishId: '' });
    const evidence: TikTokEvidence[] = [];
    expect(
      await executeTikTok(config, t, video, choices, 'copy', async (entry) => {
        evidence.push(entry);
      }),
    ).toEqual({ outcome: 'UNCERTAIN' });
    expect(t.status).not.toHaveBeenCalled();
    expect(evidence).toContainEqual({ kind: 'UNKNOWN' });
  });
  it.each([
    'http://media.invalid/video/a.mp4',
    'https://media.invalid.evil/video/a.mp4',
    'https://media.invalid/video-other/a.mp4',
    'https://user@media.invalid/video/a.mp4',
    'https://media.invalid/video/a.mp4?redirect=x',
  ])('rejects URL %s', (publicUrl) => {
    expect(assessTikTok(config, transport(), { ...video, publicUrl }, choices)).toContain(
      'TIKTOK_VIDEO_URL_NOT_VERIFIED',
    );
  });
  it('requires explicit valid privacy/consent and audited public capability', () => {
    const t = transport();
    for (const value of [
      undefined,
      {},
      { ...choices, consent: false },
      { ...choices, privacy: 'TEST_PUBLIC' },
      { ...choices, creatorRevision: 'old' },
    ])
      expect(assessTikTok(config, t, video, value)).toContain('TIKTOK_EXPLICIT_CHOICES_REQUIRED');
    t.creator!.expiresAt = '2000-01-01';
    expect(assessTikTok(config, t, video, choices)).toContain('TIKTOK_CREATOR_INFO_REQUIRED');
  });
  it('queries creator before initialization and rejects changed creator info', async () => {
    const t = transport();
    vi.mocked(t.queryCreator).mockResolvedValue({ ...t.creator, privacyOptions: [] });
    expect(await executeTikTok(config, t, video, choices, 'copy', async () => {})).toEqual({
      outcome: 'UNCERTAIN',
    });
    expect(t.initialize).not.toHaveBeenCalled();
  });
  it('blocks initialization when download/no-redirect validation fails', async () => {
    const t = transport();
    vi.mocked(t.verifyVideo).mockResolvedValue(false);
    await executeTikTok(config, t, video, choices, 'copy', async () => {});
    expect(t.initialize).not.toHaveBeenCalled();
  });
  it('bounds status timeout, preserves publish id and never retries', async () => {
    vi.useFakeTimers();
    const t = transport();
    vi.mocked(t.status).mockImplementation(() => new Promise(() => {}));
    const evidence: TikTokEvidence[] = [];
    const running = executeTikTok(
      config,
      t,
      video,
      choices,
      'copy',
      async (entry) => {
        evidence.push(entry);
      },
      20,
    );
    await vi.advanceTimersByTimeAsync(21);
    expect(await running).toEqual({ outcome: 'UNCERTAIN' });
    expect(evidence).toContainEqual({ kind: 'UNKNOWN', publishId: 'accepted' });
    expect(t.initialize).toHaveBeenCalledTimes(1);
  });
  it('does not initialize if consent evidence cannot be persisted', async () => {
    const t = transport();
    await executeTikTok(config, t, video, choices, 'copy', async () => {
      throw new Error('db unavailable');
    });
    expect(t.initialize).not.toHaveBeenCalled();
  });
});
