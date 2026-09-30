import { afterEach, describe, expect, it, vi } from 'vitest';
import { evaluateEditorialResearchReadiness } from '../../../../supabase/functions/intelligence-runtime/providers/editorial-research-readiness';
import type { EditorialResearchSearchConfig } from '../../../../supabase/functions/intelligence-runtime/providers/editorial-research-search';

const valid = {
  enabled: true,
  groqApiKey: 'secret-provider-key',
  allowedDomains: ['private-brand.example'],
  authorities: [
    {
      domain: 'private-brand.example',
      brandId: 'private-brand-id',
      brand: 'Private brand',
      role: 'OFFICIAL_BRAND',
      verification: {
        evidenceRef: 'secret-authority-evidence',
        reason: 'Private review',
        verifiedAt: '2026-09-01',
        expiresAt: '2026-10-01',
      },
    },
  ],
  freeOnlyEvidenceRef: 'secret-free-only-evidence',
  freeOnlyVerifiedAt: '2026-09-29',
} satisfies EditorialResearchSearchConfig;

afterEach(() => vi.unstubAllGlobals());

describe('Editorial Research pure readiness', () => {
  it('is deterministic, does not mutate configuration and never calls fetch', () => {
    const fetchImpl = vi.fn(() => {
      throw new Error('NETWORK_FORBIDDEN');
    });
    vi.stubGlobal('fetch', fetchImpl);
    const config = Object.freeze({ ...valid, fetchImpl });
    const before = JSON.stringify(config);
    const result = evaluateEditorialResearchReadiness(config);
    expect(result).toEqual({
      featureEnabled: true,
      providerConfigured: true,
      allowlistConfigured: true,
      authorityRegistryConfigured: true,
      freeOnlyConfigured: true,
      dependenciesConfigured: true,
      readyForActivation: true,
      reasons: [],
    });
    expect(evaluateEditorialResearchReadiness(config)).toEqual(result);
    expect(JSON.stringify(config)).toBe(before);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('fails closed by default with stable, normalized reasons', () => {
    expect(evaluateEditorialResearchReadiness({})).toEqual({
      featureEnabled: false,
      providerConfigured: false,
      allowlistConfigured: false,
      authorityRegistryConfigured: false,
      freeOnlyConfigured: false,
      dependenciesConfigured: false,
      readyForActivation: false,
      reasons: [
        'FEATURE_DISABLED',
        'PROVIDER_NOT_CONFIGURED',
        'ALLOWLIST_NOT_CONFIGURED',
        'AUTHORITY_REGISTRY_NOT_CONFIGURED',
        'FREE_ONLY_NOT_CONFIGURED',
      ],
    });
  });

  it.each([
    [{ enabled: false }, 'FEATURE_DISABLED'],
    [{ enabled: undefined }, 'FEATURE_DISABLED'],
    [{ groqApiKey: ' ' }, 'PROVIDER_NOT_CONFIGURED'],
    [{ allowedDomains: [] }, 'ALLOWLIST_NOT_CONFIGURED'],
    [{ allowedDomains: ['https://private-brand.example'] }, 'ALLOWLIST_NOT_CONFIGURED'],
    [{ authorities: [] }, 'AUTHORITY_REGISTRY_NOT_CONFIGURED'],
    [
      { authorities: [...valid.authorities, ...valid.authorities] },
      'AUTHORITY_REGISTRY_NOT_CONFIGURED',
    ],
    [{ allowedDomains: ['other.example'] }, 'AUTHORITY_REGISTRY_NOT_CONFIGURED'],
    [{ freeOnlyEvidenceRef: '' }, 'FREE_ONLY_NOT_CONFIGURED'],
    [{ freeOnlyVerifiedAt: '' }, 'FREE_ONLY_NOT_CONFIGURED'],
    [{ freeOnlyVerifiedAt: 'invalid' }, 'FREE_ONLY_NOT_CONFIGURED'],
  ])('rejects incomplete configuration %j', (patch, reason) => {
    const result = evaluateEditorialResearchReadiness({ ...valid, ...patch });
    expect(result.readyForActivation).toBe(false);
    expect(result.reasons).toContain(reason);
  });

  it('returns only boolean checks and normalized reasons, never private input', () => {
    const result = evaluateEditorialResearchReadiness(valid);
    for (const [key, value] of Object.entries(result)) {
      if (key !== 'reasons') expect(typeof value).toBe('boolean');
    }
    const serialized = JSON.stringify(result);
    for (const secret of [
      valid.groqApiKey,
      valid.allowedDomains[0],
      valid.freeOnlyEvidenceRef,
      valid.authorities[0].verification.evidenceRef,
      valid.authorities[0].brandId,
    ]) {
      expect(serialized).not.toContain(secret);
    }
  });
});
