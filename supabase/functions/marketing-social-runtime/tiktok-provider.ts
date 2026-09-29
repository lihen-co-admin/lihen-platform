import type { VideoMeasurement } from './video-measurement.ts';
import { createTikTokHttpTransport } from './tiktok-http.ts';
export { readTikTokCreator, signTikTokCreator } from './tiktok-http.ts';
// Internal normalized contracts. Official wire fields are fixed in the HTTP adapter.
export interface TikTokCreator {
  accountId: string;
  nickname?: string;
  revision: string;
  expiresAt: string;
  privacyOptions: string[];
  consentText: string;
  // Must only be true when the verified adapter supports ALL required controls.
  controlsSupported: boolean;
  maxVideoDurationSec: number;
  interactions: readonly { key: string; label: string; allowed: boolean }[];
}
export interface TikTokChoices {
  creatorRevision: string;
  privacy: string;
  consent: true;
  disclosure?: { ownBrand: boolean; brandedContent: boolean; musicUsageAccepted: true };
  interactions: Readonly<Record<string, boolean>>;
}
export interface TikTokConfig {
  enabled: boolean;
  accessToken: string;
  verifiedUrlPrefix: string;
  audited: boolean;
  authorizedScopes?: readonly string[];
  contextSigningKey?: string;
  mediaOrigin?: string;
}
export interface TikTokVideo {
  publicUrl: string;
  mediaType: 'IMAGE' | 'VIDEO';
}
export type TikTokStatus =
  | { state: 'COMPLETE'; publicationRef: string }
  | { state: 'FAILED'; code: string }
  | { state: 'PROCESSING' | 'UNKNOWN' };
export interface TikTokTransport {
  // Verified server-side authorization metadata for the configured token.
  authorizedScopes: readonly string[];
  // A trusted previously verified creator snapshot, never fabricated by UI.
  creator: TikTokCreator | null;
  contractVerified: boolean;
  // Server implementation capability, never request/config metadata.
  physicalVerificationAvailable: boolean;
  queryCreator(signal: AbortSignal): Promise<TikTokCreator>;
  // Implementor must verify video.publish and URL download/no-redirect rules.
  verifyVideo(video: TikTokVideo, signal: AbortSignal, maxDurationSec?: number): Promise<boolean>;
  measurement?: VideoMeasurement;
  initialize(
    input: { videoUrl: string; caption: string; choices: TikTokChoices },
    signal: AbortSignal,
  ): Promise<{ publishId: string }>;
  // COMPLETE may ONLY normalize verified PUBLISH_COMPLETE with final evidence.
  status(publishId: string, signal: AbortSignal): Promise<TikTokStatus>;
}
export interface TikTokEvidence {
  measurement?: VideoMeasurement;
  disclosure?: TikTokChoices['disclosure'];
  kind: 'CONSENT' | 'ACCEPTED' | 'PROCESSING' | 'UNKNOWN' | 'COMPLETE' | 'FAILED';
  publishId?: string;
  accountId?: string;
  creatorRevision?: string;
  privacy?: string;
  consent?: true;
  consentText?: string;
  publicationRef?: string;
  code?: string;
  interactions?: Readonly<Record<string, boolean>>;
}
export const TIKTOK_CONTRACT_REQUIRED = 'TIKTOK_PROVIDER_CONTRACT_UNVERIFIED';
export function configuredTikTokTransport(
  config: TikTokConfig,
  creator: TikTokCreator | null = null,
  request: typeof fetch = fetch,
): TikTokTransport | null {
  if (
    !config.enabled ||
    !config.accessToken ||
    !config.authorizedScopes?.includes('video.publish') ||
    !config.contextSigningKey ||
    config.contextSigningKey.length < 32
  )
    return null;
  return createTikTokHttpTransport(config, creator, request);
}
export function tikTokConfig(env: (name: string) => string | undefined): TikTokConfig {
  return {
    enabled: env('TIKTOK_PUBLICATION_ENABLED') === 'true',
    accessToken: env('TIKTOK_ACCESS_TOKEN')?.trim() ?? '',
    verifiedUrlPrefix: env('TIKTOK_VERIFIED_URL_PREFIX')?.trim() ?? '',
    audited: env('TIKTOK_CLIENT_AUDITED') === 'true',
    authorizedScopes: (env('TIKTOK_AUTHORIZED_SCOPES') ?? '')
      .split(',')
      .map((scope) => scope.trim())
      .filter(Boolean),
    contextSigningKey: env('TIKTOK_CONTEXT_SIGNING_KEY') ?? '',
    mediaOrigin: env('SUPABASE_URL') ?? '',
  };
}
export function allowedTikTokPrivacy(config: TikTokConfig, creator: TikTokCreator): string[] {
  return creator.privacyOptions.filter((value) => config.audited || value === 'SELF_ONLY');
}
export function validTikTokChoices(value: unknown): value is TikTokChoices {
  if (!value || typeof value !== 'object') return false;
  const choice = value as Partial<TikTokChoices>;
  return (
    ['consent,creatorRevision,interactions,privacy', 'consent,creatorRevision,disclosure,interactions,privacy'].includes(Object.keys(value).sort().join(',')) &&
    typeof choice.creatorRevision === 'string' &&
    typeof choice.privacy === 'string' &&
    choice.consent === true &&
    Boolean(choice.interactions) &&
    typeof choice.interactions === 'object' &&
    !Array.isArray(choice.interactions) &&
    Object.values(choice.interactions!).every((setting) => typeof setting === 'boolean')
  );
}
export function assessTikTok(
  config: TikTokConfig,
  transport: TikTokTransport | null,
  video: TikTokVideo | null,
  choices: unknown,
  now = Date.now(),
): string[] {
  const blockers: string[] = [];
  if (!config.enabled) blockers.push('TIKTOK_PUBLICATION_DISABLED');
  if (!config.accessToken) blockers.push('TIKTOK_NOT_CONFIGURED');
  if (!transport?.contractVerified) blockers.push(TIKTOK_CONTRACT_REQUIRED);
  if (!transport?.authorizedScopes?.includes('video.publish'))
    blockers.push('TIKTOK_VIDEO_PUBLISH_SCOPE_REQUIRED');
  try {
    const prefix = new URL(config.verifiedUrlPrefix);
    const url = new URL(video?.publicUrl ?? '');
    if (
      prefix.protocol !== 'https:' ||
      url.protocol !== 'https:' ||
      prefix.username ||
      prefix.password ||
      prefix.search ||
      prefix.hash ||
      !prefix.pathname.endsWith('/') ||
      url.origin !== prefix.origin ||
      !url.pathname.startsWith(prefix.pathname) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      video?.mediaType !== 'VIDEO'
    )
      throw new Error('Invalid media');
  } catch {
    blockers.push('TIKTOK_VIDEO_URL_NOT_VERIFIED');
  }
  const creator = transport?.creator;
  if (transport?.physicalVerificationAvailable !== true)
    blockers.push('TIKTOK_VIDEO_DURATION_VERIFICATION_UNAVAILABLE');
  if (
    creator &&
    (!Number.isFinite(creator.maxVideoDurationSec) || creator.maxVideoDurationSec <= 0)
  )
    blockers.push('TIKTOK_VIDEO_DURATION_INVALID');
  if (
    !creator?.accountId ||
    !creator.revision ||
    !creator.consentText ||
    !creator.controlsSupported ||
    !Array.isArray(creator.interactions) ||
    !Number.isFinite(Date.parse(creator.expiresAt)) ||
    Date.parse(creator.expiresAt) <= now
  )
    blockers.push('TIKTOK_CREATOR_INFO_REQUIRED');
  if (
    !creator ||
    !validTikTokChoices(choices) ||
    choices.creatorRevision !== creator.revision ||
    !allowedTikTokPrivacy(config, creator).includes(choices.privacy) ||
    Object.keys(choices.interactions).length !== creator.interactions.length ||
    creator.interactions.some(
      (item) =>
        typeof choices.interactions[item.key] !== 'boolean' ||
        (!item.allowed && choices.interactions[item.key] !== false),
    )
  )
    blockers.push('TIKTOK_EXPLICIT_CHOICES_REQUIRED');
  return blockers;
}
export type TikTokOutcome =
  | { outcome: 'SUCCEEDED'; externalPublicationRef: string }
  | { outcome: 'FAILED'; failureCode: string }
  | { outcome: 'UNCERTAIN' };

// Called only AFTER governed START. Bounded calls, no automatic retries.
export async function executeTikTok(
  config: TikTokConfig,
  transport: TikTokTransport,
  video: TikTokVideo,
  choices: TikTokChoices,
  caption: string,
  persist: (evidence: TikTokEvidence) => Promise<void>,
  timeoutMs = 10000,
): Promise<TikTokOutcome> {
  let publishId: string | undefined;
  const bounded = async <T>(work: (signal: AbortSignal) => Promise<T>): Promise<T> => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        work(controller.signal),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new Error('Timeout'));
          }, timeoutMs);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  };
  try {
    if (assessTikTok(config, transport, video, choices).length) return { outcome: 'UNCERTAIN' };
    const creator = await bounded((signal) => transport.queryCreator(signal));
    // Revalidate all user-visible choices against fresh creator_info before init.
    if (
      !transport.creator ||
      creator.accountId !== transport.creator.accountId ||
      creator.revision !== transport.creator.revision ||
      creator.consentText !== transport.creator.consentText ||
      JSON.stringify(creator.privacyOptions) !== JSON.stringify(transport.creator.privacyOptions) ||
      JSON.stringify(creator.interactions) !== JSON.stringify(transport.creator.interactions) ||
      creator.maxVideoDurationSec !== transport.creator.maxVideoDurationSec ||
      assessTikTok(config, { ...transport, creator }, video, choices).length
    )
      return { outcome: 'UNCERTAIN' };
    if ((await bounded((signal) => transport.verifyVideo(video, signal, creator.maxVideoDurationSec))) !== true)
      return { outcome: 'UNCERTAIN' };
    await persist({
      kind: 'CONSENT',
      ...(transport.measurement ? { measurement: transport.measurement } : {}),
      ...(choices.disclosure ? { disclosure: choices.disclosure } : {}),
      accountId: creator.accountId,
      creatorRevision: creator.revision,
      privacy: choices.privacy,
      consent: true,
      consentText: creator.consentText,
      interactions: choices.interactions,
    });
    const accepted = await bounded((signal) =>
      transport.initialize({ videoUrl: video.publicUrl, caption, choices }, signal),
    );
    if (typeof accepted?.publishId !== 'string' || !accepted.publishId.trim())
      throw new Error('Missing publish id');
    publishId = accepted.publishId;
    await persist({ kind: 'ACCEPTED', publishId });
    const status = await bounded((signal) => transport.status(publishId!, signal));
    if (
      status?.state === 'COMPLETE' &&
      typeof status.publicationRef === 'string' &&
      status.publicationRef.trim()
    ) {
      await persist({ kind: 'COMPLETE', publishId, publicationRef: status.publicationRef });
      return { outcome: 'SUCCEEDED', externalPublicationRef: status.publicationRef };
    }
    if (status?.state === 'FAILED' && typeof status.code === 'string' && status.code.trim()) {
      await persist({ kind: 'FAILED', publishId, code: status.code });
      return { outcome: 'FAILED', failureCode: status.code };
    }
    await persist({ kind: status?.state === 'PROCESSING' ? 'PROCESSING' : 'UNKNOWN', publishId });
  } catch {
    // A failed evidence write never licenses another initialization.
    try {
      await persist({ kind: 'UNKNOWN', ...(publishId ? { publishId } : {}) });
    } catch {
      /* IN_PROGRESS remains the durable stop. */
    }
  }
  return { outcome: 'UNCERTAIN' };
}
