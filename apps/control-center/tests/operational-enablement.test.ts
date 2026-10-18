import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import { verifyMetaAccounts } from '../../../supabase/functions/marketing-social-runtime/meta-account-verification';
import {
  assertOperationalChannelEnabled,
  assessOperationalSnapshot,
} from '../../../supabase/functions/marketing-social-runtime/operational-policy';
import { readSocialProviderReadiness } from '../../../supabase/functions/marketing-social-runtime/provider-readiness';
import { manualImageCapacity } from '../src/lib/product-image-webp';
import { VerifiedProductImagePreview } from '../src/components/VerifiedProductImagePreview';
import { channelCapability } from '../src/domain/editorial-planning';
import type { VerifiedProductImage } from '@lihen/intelligence-core';

const config: Record<string, string> = {
  SUPABASE_URL: 'https://vnmkupzptujtywnnabkp.supabase.co',
  MARKETING_SOCIAL_ENVIRONMENT: 'DEV',
  META_GRAPH_API_VERSION: 'v25.0',
  META_FACEBOOK_PAGE_ID: '123',
  META_FACEBOOK_ACCESS_TOKEN: 'SECRET_FACEBOOK',
  META_INSTAGRAM_ACCOUNT_ID: '456',
  META_INSTAGRAM_ACCESS_TOKEN: 'SECRET_INSTAGRAM',
};
const env = (name: string) => config[name];
describe('existing operations enabled without claiming external execution', () => {
  it.each(['456', '999'])(
    'verifies the exact configured Page/Instagram linkage %s',
    async (linkedId) => {
      const result = await verifyMetaAccounts(
        env,
        async (input) =>
          new Response(
            JSON.stringify(
              String(input).includes('/123?')
                ? { id: '123', instagram_business_account: { id: linkedId } }
                : String(input).includes('/456?')
                  ? { id: '456' }
                  : { data: [] },
            ),
          ),
      );
      const facebook = result.accounts.find((account) => account.channel === 'FACEBOOK');
      expect(facebook?.instagramPageLinkVerified).toBe(linkedId === '456');
      expect(facebook?.blockers.includes('INSTAGRAM_PAGE_LINK_NOT_VERIFIED')).toBe(
        linkedId !== '456',
      );
      expect(result.executionAllowed).toBe(false);
    },
  );
  it('bounds provider responses before parsing', async () => {
    const transport = vi.fn<typeof fetch>(async () => new Response('x'.repeat(70000)));
    const result = await verifyMetaAccounts(env, transport);
    expect(result.accounts.every((x) => !x.accountVerified && !x.permissionsVerified)).toBe(true);
  });
  it('verifies account reads and granted scopes using GET only, without returning secrets or execution rights', async () => {
    const transport = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      return new Response(
        JSON.stringify(
          url.includes('/me/permissions')
            ? {
                data: [
                  'pages_read_engagement',
                  'pages_manage_posts',
                  'instagram_basic',
                  'instagram_content_publish',
                ].map((permission) => ({ permission, status: 'granted' })),
              }
            : { id: url.includes('/123?') ? '123' : '456' },
        ),
      );
    });
    const result = await verifyMetaAccounts(env, transport);
    expect(result.accounts.every((x) => x.accountVerified && x.permissionsVerified)).toBe(true);
    expect(result.providerCalls).toBe(4);
    expect(result.executionAllowed).toBe(false);
    expect(result.authorizationFlow).toBe('FACEBOOK_LOGIN');
    expect(JSON.stringify(result)).not.toContain('SECRET');
    for (const [url, options] of transport.mock.calls) {
      expect(String(url)).toMatch(/^https:\/\/graph\.facebook\.com\/v25\.0\//);
      expect(String(url)).not.toContain('SECRET');
      expect(options?.method).toBe('GET');
      expect(options?.redirect).toBe('error');
      expect(options?.body).toBeUndefined();
    }
  });
  it.each(['prod', 'environment', 'version'])(
    'rejects %s before contacting Meta',
    async (reason) => {
      const altered = {
        ...config,
        ...(reason === 'prod'
          ? { SUPABASE_URL: 'https://gqitoossdbiohqegjvlh.supabase.co' }
          : reason === 'environment'
            ? { MARKETING_SOCIAL_ENVIRONMENT: 'PROD' }
            : { META_GRAPH_API_VERSION: 'v25.0/../../other' }),
      };
      const transport = vi.fn<typeof fetch>();
      await expect(verifyMetaAccounts((name) => altered[name], transport)).rejects.toThrow();
      expect(transport).not.toHaveBeenCalled();
    },
  );
  it('does not infer granted permissions from readable accounts', async () => {
    const transport = vi.fn<typeof fetch>(async (input) =>
      String(input).includes('/me/permissions')
        ? new Response('{}', { status: 403 })
        : new Response(JSON.stringify({ id: String(input).includes('/123?') ? '123' : '456' })),
    );
    const result = await verifyMetaAccounts(env, transport);
    expect(result.accounts.every((x) => x.accountVerified && !x.permissionsVerified)).toBe(true);
    expect(result.executionAllowed).toBe(false);
  });
  it('does not expose Graph errors, tokens or ambiguous results', async () => {
    const transport = vi.fn<typeof fetch>(async () => {
      throw Error('SECRET_FACEBOOK transport failure');
    });
    const result = await verifyMetaAccounts(env, transport);
    expect(result.accounts.every((x) => !x.accountVerified && !x.permissionsVerified)).toBe(true);
    expect(JSON.stringify(result)).not.toContain('SECRET');
  });
  it('does not contact Meta without configured account identity', async () => {
    const transport = vi.fn<typeof fetch>();
    const result = await verifyMetaAccounts(
      (name) =>
        name.includes('PAGE_ID') || name.includes('ACCOUNT_ID')
          ? 'https://evil.example'
          : env(name),
      transport,
    );
    expect(transport).not.toHaveBeenCalled();
    expect(result.providerCalls).toBe(0);
  });
  it('keeps TikTok and WhatsApp on HOLD even when provider variables are present', () => {
    for (const channel of ['TIKTOK', 'WHATSAPP']) {
      expect(() => assertOperationalChannelEnabled(channel)).toThrow('ON_HOLD');
      expect(channelCapability(channel).status).toContain('HOLD');
    }
    const report = readSocialProviderReadiness(() => 'true');
    expect(report.providers.find((x) => x.channel === 'TIKTOK')?.blockers).toContain(
      'TIKTOK_ON_HOLD',
    );
    const snapshot = {
      publication: {
        id: 'p',
        channel: 'TIKTOK',
        status: 'APPROVED',
        schedule_id: 's',
        channel_variant_id: 'v',
        creative_asset_ids: ['video'],
        copy: 'copy',
        cta: null,
        hashtags: [],
      },
      schedule: {
        id: 's',
        channel_variant_id: 'v',
        status: 'APPROVED',
        scheduled_for: '2026-01-01',
      },
      attempts: [],
    };
    expect(assessOperationalSnapshot(snapshot, Date.now(), []).nextAction).toBeNull();
  });
  it('caps new manual batches at five while preserving existing gallery capacity and retry journals', () => {
    expect(manualImageCapacity(0, 0)).toBe(5);
    expect(manualImageCapacity(8, 0)).toBe(2);
    expect(manualImageCapacity(0, 5)).toBe(0);
    expect(manualImageCapacity(0, 8)).toBe(0);
    expect(manualImageCapacity(10, 0)).toBe(0);
  });
  it('renders a real preview only for current exact, authoritative and rights-verified candidates', () => {
    const image: VerifiedProductImage = {
      imageUrl: 'https://official.example/a.png',
      sourceUrl: 'https://official.example/product',
      sourceDomain: 'official.example',
      checkedAt: new Date().toISOString(),
      identity: { productName: 'Exact product' },
      identityMatch: 'EXACT_MATCH',
      authority: 'OFFICIAL',
      authorityExpiresAt: '2099-01-01',
      evidence: [],
      widthPx: 1000,
      heightPx: 1000,
      rightsStatus: 'RIGHTS_VERIFIED',
      rightsExpiresAt: '2099-01-01',
      stage: 'RIGHTS_VERIFIED',
      reasons: [],
    };
    expect(renderToStaticMarkup(createElement(VerifiedProductImagePreview, { image }))).toContain(
      '<img',
    );
    for (const changed of [
      { rightsExpiresAt: '2000-01-01' },
      { identityMatch: 'INSUFFICIENT_EVIDENCE' as const },
      { imageUrl: 'http://localhost/a' },
      { authorityExpiresAt: '2000-01-01' },
    ])
      expect(
        renderToStaticMarkup(
          createElement(VerifiedProductImagePreview, { image: { ...image, ...changed } }),
        ),
      ).not.toContain('<img');
  });
});
