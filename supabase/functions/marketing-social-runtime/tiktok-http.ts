import { governedVideoUrl, measureGovernedVideo, type VideoMeasurement } from './video-measurement.ts';
import type { TikTokConfig, TikTokCreator, TikTokTransport } from './tiktok-provider.ts';

// Fixed official contract; no environment-provided JSON paths.
// https://developers.tiktok.com/doc/content-posting-api-reference-query-creator-info
// https://developers.tiktok.com/docs/en/content-posting-api-reference-direct-post
const interactions = [
  { key: 'comment', label: 'Comentarios', capability: 'comment_disabled', post: 'disable_comment' },
  { key: 'duet', label: 'Duetos', capability: 'duet_disabled', post: 'disable_duet' },
  { key: 'stitch', label: 'Pegar', capability: 'stitch_disabled', post: 'disable_stitch' },
] as const;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);
function at(value: unknown, path: readonly string[]): unknown {
  for (const key of path) {
    if (!isRecord(value) || !Object.hasOwn(value, key)) return undefined;
    value = value[key];
  }
  return value;
}
export async function tikTokDigest(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify(value)),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
export function createTikTokHttpTransport(
  config: TikTokConfig,
  creator: TikTokCreator | null = null,
  request: typeof fetch = fetch,
): TikTokTransport {
  const scopes = config.authorizedScopes ?? [];
  let verified: { url: string; measurement: VideoMeasurement } | null = null;
  const post = async (
    endpoint: 'creator_info/query' | 'video/init' | 'status/fetch',
    body: Record<string, unknown>,
    signal: AbortSignal,
  ): Promise<unknown> => {
    if (!config.enabled || !config.accessToken || !scopes.includes('video.publish'))
      throw new Error('TIKTOK_HTTP_DISABLED');
    const response = await request(`https://open.tiktokapis.com/v2/post/publish/${endpoint}/`, {
      method: 'POST',
      redirect: 'error',
      signal,
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify(body),
    });
    if (!response.ok || response.redirected) throw new Error('TIKTOK_HTTP_REJECTED_OR_UNKNOWN');
    const result: unknown = await response.json();
    if (at(result, ['error', 'code']) !== 'ok')
      throw new Error('TIKTOK_PROVIDER_REJECTED_OR_UNKNOWN');
    return result;
  };
  return {
    creator,
    authorizedScopes: scopes,
    contractVerified: true,
    physicalVerificationAvailable: true,
    async queryCreator(signal) {
      const result = await post('creator_info/query', {}, signal);
      const identity = at(result, ['data', 'creator_username']);
      const privacy = at(result, ['data', 'privacy_level_options']);
      const maxDuration = at(result, ['data', 'max_video_post_duration_sec']);
      if (
        typeof identity !== 'string' ||
        !identity.trim() ||
        !Array.isArray(privacy) ||
        !privacy.length ||
        privacy.some((option) => typeof option !== 'string' || !option.trim()) ||
        typeof maxDuration !== 'number' ||
        !Number.isFinite(maxDuration) ||
        maxDuration <= 0
      )
        throw new Error('TIKTOK_CREATOR_MALFORMED');
      const controls = interactions.map((item) => {
        const capability = at(result, ['data', item.capability]);
        if (typeof capability !== 'boolean') throw new Error('TIKTOK_CREATOR_CAPABILITY_MALFORMED');
        return { key: item.key, label: item.label, allowed: !capability };
      });
      const data = {
        accountId: identity,
        nickname: typeof at(result, ['data', 'creator_nickname']) === 'string' ? String(at(result, ['data', 'creator_nickname'])) : identity,
        privacyOptions: [...new Set(privacy as string[])],
        maxVideoDurationSec: maxDuration,
        interactions: controls,
        consentText: 'Autorizo enviar este video y texto a TikTok con las opciones seleccionadas.',
        controlsSupported: true,
      };
      return {
        ...data,
        revision: await tikTokDigest(data),
        expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
      };
    },
    async verifyVideo(video, signal, maxDurationSec) {
      verified = null;
      try {
        if (video.mediaType !== 'VIDEO' || !maxDurationSec || !Number.isFinite(maxDurationSec)) return false;
        const measured = await measureGovernedVideo(video.publicUrl, config.mediaOrigin ?? '', config.verifiedUrlPrefix, signal, request);
        if (measured.durationSeconds > maxDurationSec) throw new Error('TIKTOK_VIDEO_DURATION_EXCEEDED');
        this.measurement = measured;
        verified = { url: video.publicUrl, measurement: measured };
        return true;
      } catch { return false; }
    },
    async initialize(input, signal) {
      const proof = verified;
      verified = null; // A physical proof licenses at most one initialization in this invocation.
      if (!proof || proof.url !== input.videoUrl) throw new Error('TIKTOK_VIDEO_DURATION_VERIFICATION_UNAVAILABLE');
      const url = governedVideoUrl(input.videoUrl, config.mediaOrigin ?? '', config.verifiedUrlPrefix);
      const head = await request(url, { method: 'HEAD', redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]), headers: { 'If-Match': proof.measurement.etag } });
      if (head.status !== 200 || head.redirected || head.headers.get('etag') !== proof.measurement.etag || Number(head.headers.get('content-length')) !== proof.measurement.bytes) throw new Error('TIKTOK_VIDEO_CHANGED');
      const disclosure = input.choices.disclosure;
      if (!disclosure || disclosure.musicUsageAccepted !== true || typeof disclosure.ownBrand !== 'boolean' || typeof disclosure.brandedContent !== 'boolean' || (disclosure.brandedContent && input.choices.privacy === 'SELF_ONLY') || (!config.audited && input.choices.privacy !== 'SELF_ONLY')) throw new Error('TIKTOK_DISCLOSURE_REQUIRED');
      const body: Record<string, unknown> = {
        source_info: { source: 'PULL_FROM_URL', video_url: input.videoUrl },
      };
      const postInfo: Record<string, unknown> = {
        title: input.caption,
        privacy_level: input.choices.privacy,
        brand_organic_toggle: disclosure.ownBrand,
        brand_content_toggle: disclosure.brandedContent,
      };
      body.post_info = postInfo;
      for (const interaction of interactions) {
        const choice = input.choices.interactions?.[interaction.key];
        if (typeof choice !== 'boolean') throw new Error('TIKTOK_INTERACTION_CHOICE_REQUIRED');
        postInfo[interaction.post] = !choice;
      }
      const result = await post('video/init', body, signal);
      const publishId = at(result, ['data', 'publish_id']);
      if (typeof publishId !== 'string' || !publishId.trim())
        throw new Error('TIKTOK_INITIALIZATION_MALFORMED');
      return { publishId };
    },
    async status(publishId, signal) {
      const result = await post('status/fetch', { publish_id: publishId }, signal);
      const state = at(result, ['data', 'status']);
      // This is an operation reference corroborated by terminal status, NOT a post URL/id.
      if (state === 'PUBLISH_COMPLETE')
        return { state: 'COMPLETE', publicationRef: `tiktok:publish:${publishId}` };
      if (state === 'FAILED') return { state: 'FAILED', code: 'TIKTOK_DIRECT_POST_FAILED' };
      if (state === 'PROCESSING_DOWNLOAD' || state === 'PROCESSING_UPLOAD')
        return { state: 'PROCESSING' };
      return { state: 'UNKNOWN' };
    },
  };
}

async function contextKey(config: TikTokConfig) {
  if (!config.contextSigningKey || config.contextSigningKey.length < 32)
    throw new Error('TIKTOK_CONTEXT_KEY_REQUIRED');
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(config.contextSigningKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}
export async function signTikTokCreator(
  config: TikTokConfig,
  binding: unknown,
  creator: TikTokCreator,
): Promise<string> {
  const body = JSON.stringify({
    binding: await tikTokDigest({
      binding,
      token: config.accessToken,
      wire: 'official-v1',
      scopes: config.authorizedScopes,
      audited: config.audited,
    }),
    creator,
  });
  const bytes = new TextEncoder().encode(body);
  const signature = await crypto.subtle.sign('HMAC', await contextKey(config), bytes);
  return `${btoa(String.fromCharCode(...bytes))}.${btoa(String.fromCharCode(...new Uint8Array(signature)))}`;
}
export async function readTikTokCreator(
  config: TikTokConfig,
  binding: unknown,
  token: unknown,
): Promise<TikTokCreator | null> {
  try {
    if (typeof token !== 'string' || token.length > 32768) return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const body = Uint8Array.from(atob(parts[0]!), (char) => char.charCodeAt(0));
    const signature = Uint8Array.from(atob(parts[1]!), (char) => char.charCodeAt(0));
    if (!(await crypto.subtle.verify('HMAC', await contextKey(config), signature, body)))
      return null;
    const parsed = JSON.parse(new TextDecoder().decode(body)) as {
      binding: string;
      creator: TikTokCreator;
    };
    if (
      parsed.binding !==
        (await tikTokDigest({
          binding,
          token: config.accessToken,
          wire: 'official-v1',
          scopes: config.authorizedScopes,
          audited: config.audited,
        })) ||
      !Number.isFinite(Date.parse(parsed.creator.expiresAt)) ||
      Date.parse(parsed.creator.expiresAt) <= Date.now()
    )
      return null;
    return parsed.creator;
  } catch {
    return null;
  }
}
