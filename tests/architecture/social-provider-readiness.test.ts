import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { readSocialProviderReadiness } from '../../supabase/functions/marketing-social-runtime/provider-readiness';
afterEach(() => vi.unstubAllGlobals());
describe('provider readiness without provider calls', () => {
  it('reports missing configuration and never calls fetch', () => {
    const fetch = vi.fn(() => { throw new Error('Provider call prohibited'); }); vi.stubGlobal('fetch',fetch);
    const result = readSocialProviderReadiness(() => undefined);
    expect(result.providers).toHaveLength(5);
    expect(result.providers.every(row => row.status === 'BLOCKED')).toBe(true);
    expect(result.providers.at(-1)?.blockers).toContain('TIKTOK_VIDEO_PUBLISH_SCOPE_REQUIRED');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('never echoes configuration values or declares execution ready', () => {
    const env:Record<string,string> = {META_PUBLICATION_ENABLED:'true',META_GRAPH_API_VERSION:'v99.0',META_FACEBOOK_ACCESS_TOKEN:'SECRET_TOKEN',META_FACEBOOK_PAGE_ID:'SECRET_ID',META_INSTAGRAM_ACCESS_TOKEN:'SECRET_TOKEN',META_INSTAGRAM_ACCOUNT_ID:'SECRET_ID',TIKTOK_PUBLICATION_ENABLED:'true',TIKTOK_ACCESS_TOKEN:'SECRET_TOKEN',TIKTOK_VERIFIED_URL_PREFIX:'https://secret.example/media/',TIKTOK_AUTHORIZED_SCOPES:'video.publish',TIKTOK_CONTEXT_SIGNING_KEY:'SECRET_SIGNING_KEY_12345678901234567890'};
    const result=readSocialProviderReadiness(name => env[name]);
    expect(result.providers.every(row => row.status === 'REVIEW')).toBe(true);
    expect(result.executionAllowed).toBe(false);
    expect(JSON.stringify(result)).not.toMatch(/SECRET|secret.example|v99/);
    expect(result.providers.at(-1)?.restrictions).toContain('SELF_ONLY_UNAUDITED_CLIENT');
  });
  it('rejects unsafe prefix and insufficient signing configuration', () => {
    const result=readSocialProviderReadiness(name => name==='TIKTOK_VERIFIED_URL_PREFIX' ? 'http://example.com/' : 'x');
    expect(result.providers.at(-1)?.blockers).toContain('TIKTOK_VERIFIED_URL_PREFIX_REQUIRED');
    expect(result.providers.at(-1)?.blockers).toContain('TIKTOK_CONTEXT_SIGNING_KEY_REQUIRED');
  });
  it('routes only after active OWNER/ADMIN authorization and returns before execution code', () => {
    const source=readFileSync('supabase/functions/marketing-social-runtime/index.ts','utf8');
    const branch=source.indexOf("if (action === 'READ_PROVIDER_READINESS')");
    expect(branch).toBeGreaterThan(source.indexOf('LIHEN_MARKETING_SOCIAL_FORBIDDEN'));
    const route=source.slice(branch,source.indexOf('\n    }',branch)+6);
    expect(route).toContain('externalPublication: false');
    expect(route).not.toMatch(/fetch\(|\.rpc\(|executeTikTok|readTikTokCreator/);
  });
});
