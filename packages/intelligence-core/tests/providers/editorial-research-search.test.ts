import { describe, expect, it, vi } from 'vitest';

import { createEditorialResearchRuntimeDependencies } from '../../../../supabase/functions/intelligence-runtime/providers/editorial-research-search';

const authority = {
  domain: 'brand.example',
  brandId: 'brand-a',
  brand: 'Marca A',
  role: 'OFFICIAL_BRAND',
  verification: {
    evidenceRef: 'registry:test',
    reason: 'Synthetic authority',
    verifiedAt: '2026-09-01',
    expiresAt: '2027-09-01',
  },
} as const;
const valid = {
  enabled: true,
  groqApiKey: 'test-key',
  allowedDomains: ['brand.example'],
  authorities: [authority],
  freeOnlyEvidenceRef: 'architecture-reviewed:official-domain-discovery',
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
    const dependencies = createEditorialResearchRuntimeDependencies({ ...valid, authorities: [] });

    expect(dependencies).toEqual({});
  });

  it.each([undefined, '', 'legacy-key'])(
    'does not gate discovery on Groq credentials: %s',
    (groqApiKey) => {
      expect(
        createEditorialResearchRuntimeDependencies({ ...valid, groqApiKey }).search?.descriptor
          .toolId,
      ).toBe('official-domain-discovery');
    },
  );

  it.each([
    { ...authority, role: 'SECONDARY_REFERENCE' as const },
    { ...authority, role: 'AUTHORIZED_SUPPLIER' as const },
    { ...authority, domain: 'other.example' },
    { ...authority, verification: { ...authority.verification, evidenceRef: '' } },
  ])('requires a valid allowlisted official authority: %j', (record) => {
    expect(createEditorialResearchRuntimeDependencies({ ...valid, authorities: [record] })).toEqual(
      {},
    );
  });

  it('retrieves and extracts the actual discovered document through the evidence pipeline', async () => {
    const uri = 'https://brand.example/products/agua-de-rosas-bc-067';
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith('/robots.txt')) return new Response('', { status: 404 });
      if (url.endsWith('/sitemap.xml'))
        return new Response(`<urlset><url><loc>${uri}</loc></url></urlset>`);
      if (url === uri)
        return new Response('<h1>Agua de rosas</h1><p>Marca A BC-067</p>', {
          headers: { 'Content-Type': 'text/html' },
        });
      throw new Error('UNEXPECTED_NETWORK');
    });
    const dependencies = createEditorialResearchRuntimeDependencies({
      ...valid,
      groqApiKey: undefined,
      fetchImpl,
    });
    const result = await dependencies.search!.search({
      correlationId: 'test',
      requestedBy: 'tester',
      context: { contextId: 'product:test', type: 'PRODUCT', attributes: {} },
      queries: [{ query: 'Agua de rosas' }],
      costPolicy: 'FREE_ONLY',
      expectedProductIdentity: {
        productId: 'p-067',
        productName: 'Agua de rosas',
        sku: 'BC-067',
        brandId: 'brand-a',
        brand: 'Marca A',
      },
    });
    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      'https://brand.example/robots.txt',
      'https://brand.example/sitemap.xml',
      uri,
    ]);
    expect(result.data?.[0]?.productEvidence?.identity.sku?.value).toBe('BC-067');
    expect(result.data?.[0]?.productEvidence?.extracts.length).toBeGreaterThan(0);
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
