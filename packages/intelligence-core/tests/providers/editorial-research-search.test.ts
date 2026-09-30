import { describe, expect, it, vi } from 'vitest';

import { createEditorialResearchRuntimeDependencies } from '../../../../supabase/functions/intelligence-runtime/providers/editorial-research-search';

const valid = {
  enabled: true,
  groqApiKey: 'test-key',
  allowedDomains: ['brand.example'],
  freeOnlyEvidenceRef: 'operator-reviewed:groq-free-only',
  freeOnlyVerifiedAt: '2026-09-29T20:00:00.000Z',
} as const;

describe('Editorial research runtime dependencies', () => {
  it('is OFF by default', () => {
    expect(
      createEditorialResearchRuntimeDependencies({
        ...valid,
        enabled: undefined,
      }),
    ).toEqual({});
  });

  it('remains OFF when explicitly disabled', () => {
    expect(
      createEditorialResearchRuntimeDependencies({
        ...valid,
        enabled: false,
      }),
    ).toEqual({});
  });

  it('does not activate from a Groq API key alone', () => {
    expect(
      createEditorialResearchRuntimeDependencies({
        enabled: true,
        groqApiKey: 'test-key',
      }),
    ).toEqual({});
  });

  it('requires an explicit fetch-domain allowlist', () => {
    expect(
      createEditorialResearchRuntimeDependencies({
        ...valid,
        allowedDomains: [],
      }),
    ).toEqual({});
  });

  it('requires operator-reviewed FREE_ONLY evidence', () => {
    expect(
      createEditorialResearchRuntimeDependencies({
        ...valid,
        freeOnlyEvidenceRef: '',
      }),
    ).toEqual({});

    expect(
      createEditorialResearchRuntimeDependencies({
        ...valid,
        freeOnlyVerifiedAt: 'not-a-date',
      }),
    ).toEqual({});
  });

  it('constructs a read-only SEARCH dependency only with all gates satisfied', () => {
    const dependencies = createEditorialResearchRuntimeDependencies(valid);

    expect(dependencies.search?.descriptor.kind).toBe('SEARCH');
    expect(dependencies.search?.descriptor.readOnly).toBe(true);
    expect(dependencies.freeOnly).toEqual({
      evidenceRef: valid.freeOnlyEvidenceRef,
      verifiedAt: valid.freeOnlyVerifiedAt,
    });
  });

  it('propagates only explicitly configured authority records', () => {
    const authority = {
      domain: 'brand.example',
      brandId: 'brand-a',
      brand: 'Marca A',
      role: 'OFFICIAL_BRAND',
      verification: {
        evidenceRef: 'registry:domain-ownership:test',
        reason: 'Synthetic test-only authority record',
        verifiedAt: '2026-09-01T00:00:00.000Z',
        expiresAt: '2026-10-01T00:00:00.000Z',
      },
    } as const;

    const dependencies = createEditorialResearchRuntimeDependencies({
      ...valid,
      authorities: [authority],
    });

    expect(dependencies.authorities).toEqual([authority]);
  });

  it('never derives authority from the fetch-domain allowlist', () => {
    const dependencies = createEditorialResearchRuntimeDependencies(valid);

    expect(dependencies.search?.descriptor.kind).toBe('SEARCH');
    expect(dependencies.authorities).toEqual([]);
  });

  it('construction performs zero network calls', () => {
    const fetchImpl = vi.fn();

    createEditorialResearchRuntimeDependencies({
      ...valid,
      fetchImpl: fetchImpl as typeof fetch,
    });

    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
