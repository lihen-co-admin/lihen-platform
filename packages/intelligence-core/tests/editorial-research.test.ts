import { describe, expect, it, vi } from 'vitest';
import {
  assessEditorialSearchResult,
  buildEditorialSearchQuery,
  editorialIdentityKey,
  researchEditorialProduct,
  verifyEditorialSourceIdentity,
} from '../src/capabilities/editorial-research';
import type { SearchPort, SearchResultItem } from '../src/provider-ports';
import { authority, context, freeOnly, identity, searchResult } from './editorial-research.fixture';

function provider(result = searchResult()) {
  const search = vi.fn().mockResolvedValue({ status: 'SUCCESS', data: [result], messages: [] });
  const port: SearchPort = {
    descriptor: {
      toolId: 'fixture-search',
      kind: 'SEARCH',
      name: 'Fixture',
      version: '1',
      description: 'No network fixture',
      readOnly: true,
    },
    search,
  };
  return { search, port };
}
describe('EDITORIAL-RESEARCH-01 governed SearchPort boundary', () => {
  it('queries public discriminators while retaining internal identity in the request', async () => {
    const { search, port } = provider();
    const expected = { ...identity, knownAttributes: { presentation: '100 ml' } };
    const query = buildEditorialSearchQuery(expected)!;
    for (const text of ['Agua de rosas', 'Marca A', 'Cuidado', '100 ml'])
      expect(query).toContain(text);
    expect(query).not.toContain('durable-product');
    expect(query).not.toContain(identity.sku!);
    expect(buildEditorialSearchQuery({ ...expected, sku: undefined })).toBe(query);
    await researchEditorialProduct(expected, context, { search: port, freeOnly });
    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedProductIdentity: expected,
        costPolicy: 'FREE_ONLY',
        queries: [{ query, maxResults: 8 }],
      }),
    );
  });
  it.each(['productName', 'brand', 'brandId', 'productId'])(
    'missing %s prevents generic-name research',
    async (field) => {
      const { search, port } = provider();
      const expected = { ...identity, [field]: '' };
      expect(buildEditorialSearchQuery(expected)).toBeNull();
      expect(
        (await researchEditorialProduct(expected, context, { search: port, freeOnly })).status,
      ).toBe('INSUFFICIENT_EVIDENCE');
      expect(search).not.toHaveBeenCalled();
    },
  );
  it('requires document-backed exact identity; missing category is partial, no evidence is insufficient', () => {
    const result = searchResult();
    expect(verifyEditorialSourceIdentity(identity, result)).toBe('VERIFIED');
    const partial = {
      ...result,
      productEvidence: {
        ...result.productEvidence!,
        identity: {
          productName: result.productEvidence!.identity.productName!,
          brand: result.productEvidence!.identity.brand!,
        },
      },
    };
    expect(verifyEditorialSourceIdentity(identity, partial)).toBe('PARTIALLY_VERIFIED');
    expect(assessEditorialSearchResult(identity, partial, [authority]).claims).toEqual([]);
    expect(
      verifyEditorialSourceIdentity(identity, { title: 'Agua de rosas', uri: result.uri }),
    ).toBe('INSUFFICIENT_EVIDENCE');
  });
  it.each(['brand', 'productName', 'category'])(
    '%s mismatch rejects all claims even on an official domain',
    (field) => {
      const result = searchResult();
      const mismatch: SearchResultItem = {
        ...result,
        productEvidence: {
          ...result.productEvidence!,
          identity: {
            ...result.productEvidence!.identity,
            [field]: { value: 'Marca B', evidenceRef: 'identity' },
          },
        },
      };
      const assessed = assessEditorialSearchResult(identity, mismatch, [authority]);
      expect(assessed.identityMatch).toBe('IDENTITY_MISMATCH');
      expect(assessed.claims).toEqual([]);
    },
  );
  it('Agua de rosas Marca A versus Agua de rosas Marca B MUST be IDENTITY_MISMATCH', () => {
    const result = searchResult();
    const data = result.productEvidence!;
    const assessed = assessEditorialSearchResult(
      identity,
      {
        ...result,
        productEvidence: {
          ...data,
          identity: { ...data.identity, brand: { value: 'Marca B', evidenceRef: 'identity' } },
          extracts: data.extracts.map((entry) => ({
            ...entry,
            text: entry.text.replace('Marca A', 'Marca B'),
          })),
        },
      },
      [authority],
    );
    expect(assessed.identityMatch).toBe('IDENTITY_MISMATCH');
    expect(assessed.claims).toHaveLength(0);
  });
  it.each([undefined, { value: 'PUBLIC-500ML', evidenceRef: 'public-sku' }])(
    'missing or different public SKU does not block verified official claims: %j',
    async (sku) => {
      const expected = { ...identity, category: undefined };
      const original = searchResult();
      const result = {
        ...original,
        productEvidence: {
          ...original.productEvidence!,
          identity: { ...original.productEvidence!.identity, sku, category: undefined },
          extracts: [
            { id: 'identity', text: 'Agua de rosas · Marca A' },
            { id: 'public-sku', text: 'PUBLIC-500ML' },
            ...original.productEvidence!.extracts.filter((extract) => extract.id !== 'identity'),
          ],
        },
      };
      expect(verifyEditorialSourceIdentity(expected, result)).toBe('VERIFIED');
      expect(
        assessEditorialSearchResult(expected, result, [authority]).claims.length,
      ).toBeGreaterThan(0);
      const { port } = provider(result);
      expect(
        await researchEditorialProduct(expected, context, {
          search: port,
          freeOnly,
          authorities: [authority],
        }),
      ).toMatchObject({ status: 'COMPLETED', evidenceStatus: 'SUPPORTED' });
    },
  );
  it('missing expected attributes reject claims and conflicting attributes mismatch', () => {
    const expected = { ...identity, knownAttributes: { presentation: '100 ml' } };
    const result = searchResult();
    expect(assessEditorialSearchResult(expected, result, [authority]).claims).toEqual([]);
    expect(
      verifyEditorialSourceIdentity(expected, {
        ...result,
        productEvidence: {
          ...result.productEvidence!,
          identity: {
            ...result.productEvidence!.identity,
            knownAttributes: { presentation: { value: '500 ml', evidenceRef: 'identity' } },
          },
        },
      }),
    ).toBe('IDENTITY_MISMATCH');
  });
  it('known attributes participate in verification and invalidation keys', () => {
    const expected = { ...identity, knownAttributes: { presentation: '100 ml' } };
    expect(verifyEditorialSourceIdentity(expected, searchResult())).toBe('PARTIALLY_VERIFIED');
    expect(editorialIdentityKey(expected)).not.toBe(editorialIdentityKey(identity));
    expect(editorialIdentityKey({ ...identity, sku: 'changed' })).not.toBe(
      editorialIdentityKey(identity),
    );
    expect(editorialIdentityKey({ ...identity, brand: 'Marca B' })).not.toBe(
      editorialIdentityKey(identity),
    );
  });
  it('an official label in metadata or a familiar URL does not verify authority', () => {
    const result = {
      ...searchResult(),
      sourceName: 'Official brand',
      metadata: { official: true, authority: 'OFFICIAL_BRAND' },
    };
    const assessed = assessEditorialSearchResult(identity, result);
    expect(assessed.authority).toBe('UNVERIFIED');
    expect(assessed.claims).toEqual([]);
  });
  it.each([
    { ...authority, domain: 'unknown.example' },
    { ...authority, brandId: 'brand-b' },
    { ...authority, verification: { ...authority.verification, evidenceRef: '' } },
    { ...authority, verification: { ...authority.verification, expiresAt: '2026-09-02' } },
  ])('unknown, wrong-brand or unverified/expired registry record fails closed', (record) => {
    expect(assessEditorialSearchResult(identity, searchResult(), [record]).authority).toBe(
      'UNVERIFIED',
    );
  });
  it('official facts preserve URL/domain/time/reason/claim-extract references and confidence', () => {
    const result = assessEditorialSearchResult(identity, searchResult(), [authority]);
    expect(result).toMatchObject({
      authority: 'OFFICIAL_BRAND',
      identityMatch: 'VERIFIED',
      domain: 'brand-a.example',
      url: 'https://brand-a.example/product',
      authorityEvidenceRef: authority.verification.evidenceRef,
      retrievedAt: '2026-09-29T00:00:00Z',
    });
    expect(result.claims[0]).toMatchObject({
      classification: 'VERIFIED_OFFICIAL_BRAND',
      evidenceRefs: ['ingredient'],
      sources: [result.id],
      usableInCopy: true,
    });
    expect(result.claims[0]!.confidence.score).toBeGreaterThan(0);
  });
  it.each([
    ['AUTHORIZED_SUPPLIER', 'AUTHORIZED_DISTRIBUTOR'],
    ['SECONDARY_REFERENCE', 'TRUSTED_SECONDARY'],
  ] as const)(
    '%s remains secondary and cannot become official product copy',
    (role, classification) => {
      const result = assessEditorialSearchResult(identity, searchResult(), [
        { ...authority, role },
      ]);
      expect(result.authority).toBe(classification);
      expect(result.claims[0]).toMatchObject({
        classification: 'SUPPORTED_SECONDARY',
        usableInCopy: false,
      });
    },
  );
  it.each([
    'ingredients',
    'benefits',
    'results',
    'usage',
    'certifications',
    'dermatologicalProperties',
    'clinicalClaims',
    'origin',
    'composition',
    'presentation',
    'discounts',
    'availability',
    'GENERAL_EDITORIAL_CONTEXT',
  ])('rejects %s without a matching extract', (field) => {
    const result = searchResult();
    const assessed = assessEditorialSearchResult(
      identity,
      {
        ...result,
        productEvidence: {
          ...result.productEvidence!,
          claims: [{ field, value: 'Generic model knowledge', evidenceRefs: ['ingredient'] }],
        },
      },
      [authority],
    );
    expect(assessed.claims).toEqual([]);
    expect(assessed.rejectedClaims).toEqual([{ field, reason: 'INSUFFICIENT_EVIDENCE' }]);
  });
  it('never launders a snippet, paraphrase or missing reference into evidence', () => {
    const result = searchResult();
    for (const evidenceRefs of [[], ['missing']]) {
      expect(
        assessEditorialSearchResult(
          identity,
          {
            ...result,
            productEvidence: {
              ...result.productEvidence!,
              claims: [{ field: 'benefits', value: 'Discovery only', evidenceRefs }],
            },
          },
          [authority],
        ).claims,
      ).toEqual([]);
    }
  });
  it('missing SearchPort returns an explicit status with zero synthetic sources', async () => {
    expect(await researchEditorialProduct(identity, context)).toMatchObject({
      status: 'SEARCH_PROVIDER_NOT_CONFIGURED',
      evidenceStatus: 'INSUFFICIENT_EVIDENCE',
      sources: [],
    });
  });
  it('FREE_ONLY and read-only policy are checked before calling any adapter', async () => {
    const { search, port } = provider();
    expect((await researchEditorialProduct(identity, context, { search: port })).status).toBe(
      'POLICY_BLOCKED',
    );
    expect(search).not.toHaveBeenCalled();
    const writable = { ...port, descriptor: { ...port.descriptor, readOnly: false } };
    expect(
      (await researchEditorialProduct(identity, context, { search: writable, freeOnly })).status,
    ).toBe('POLICY_BLOCKED');
    expect(search).not.toHaveBeenCalled();
  });
  it('provider failure never adds evidence or fabricates results', async () => {
    const { search, port } = provider();
    search.mockRejectedValue(new Error('failure'));
    expect(
      await researchEditorialProduct(identity, context, { search: port, freeOnly }),
    ).toMatchObject({ status: 'PROVIDER_FAILED', sources: [] });
  });
  it('rejects unsafe URLs, spoofed domains and duplicated extract IDs', () => {
    const result = searchResult();
    expect(() =>
      assessEditorialSearchResult(identity, { ...result, uri: 'javascript:alert(1)' }, [authority]),
    ).toThrow();
    expect(() =>
      assessEditorialSearchResult(
        identity,
        { ...result, uri: 'https://brand-a.example.attacker.example/product' },
        [authority],
      ),
    ).toThrow();
    expect(() =>
      assessEditorialSearchResult(
        identity,
        {
          ...result,
          productEvidence: {
            ...result.productEvidence!,
            extracts: [
              { id: 'x', text: 'one' },
              { id: 'x', text: 'two' },
            ],
          },
        },
        [authority],
      ),
    ).toThrow();
  });
});
