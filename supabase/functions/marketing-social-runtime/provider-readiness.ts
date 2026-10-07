/** Configuration-only diagnostics. Never create a transport or call a provider. */
export function readSocialProviderReadiness(env: (name: string) => string | undefined) {
  const present = (name: string) => Boolean(env(name)?.trim());
  const metaEnabled = env('META_PUBLICATION_ENABLED')?.trim().toLowerCase() === 'true';
  const meta = (channel: string, settings: string[]) => {
    const blockers = settings.filter(name => !present(name)).map(name => `${name}_NOT_CONFIGURED`);
    if (!metaEnabled) blockers.unshift('META_PUBLICATION_DISABLED');
    return { channel, status: blockers.length ? 'BLOCKED' as const : 'REVIEW' as const, blockers, restrictions: ['PROVIDER_NOT_CONTACTED', 'FINAL_EXECUTION_BLOCKED'] };
  };
  const tiktokBlockers: string[] = [];
  if (env('TIKTOK_PUBLICATION_ENABLED') !== 'true') tiktokBlockers.push('TIKTOK_PUBLICATION_DISABLED');
  if (!present('TIKTOK_ACCESS_TOKEN')) tiktokBlockers.push('TIKTOK_ACCESS_TOKEN_NOT_CONFIGURED');
  if (!(env('TIKTOK_AUTHORIZED_SCOPES') ?? '').split(',').map(value => value.trim()).includes('video.publish')) tiktokBlockers.push('TIKTOK_VIDEO_PUBLISH_SCOPE_REQUIRED');
  if ((env('TIKTOK_CONTEXT_SIGNING_KEY') ?? '').length < 32) tiktokBlockers.push('TIKTOK_CONTEXT_SIGNING_KEY_REQUIRED');
  try {
    const prefix = new URL(env('TIKTOK_VERIFIED_URL_PREFIX')?.trim() ?? '');
    if (prefix.protocol !== 'https:' || prefix.username || prefix.password || prefix.search || prefix.hash) throw new Error('invalid');
  } catch { tiktokBlockers.push('TIKTOK_VERIFIED_URL_PREFIX_REQUIRED'); }
  return {
    schemaVersion: 1 as const,
    providerCalls: 0 as const,
    executionAllowed: false as const,
    providers: [
      meta('FACEBOOK', ['META_GRAPH_API_VERSION','META_FACEBOOK_ACCESS_TOKEN','META_FACEBOOK_PAGE_ID']),
      ...['INSTAGRAM_FEED','INSTAGRAM_STORY','INSTAGRAM_REEL'].map(channel => meta(channel, ['META_GRAPH_API_VERSION','META_INSTAGRAM_ACCESS_TOKEN','META_INSTAGRAM_ACCOUNT_ID'])),
      { channel:'TIKTOK', status:tiktokBlockers.length ? 'BLOCKED' as const : 'REVIEW' as const, blockers:tiktokBlockers, restrictions: ['PROVIDER_NOT_CONTACTED','FINAL_EXECUTION_BLOCKED','CREATOR_CONSENT_AND_MEDIA_NOT_VERIFIED', ...(env('TIKTOK_CLIENT_AUDITED') === 'true' ? [] : ['SELF_ONLY_UNAUDITED_CLIENT'])] },
    ],
  };
}
