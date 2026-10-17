import { describe, expect, it, vi } from 'vitest';
import {
  assessProductPhotograph,
  buildVerifiedImageQuery,
  researchVerifiedProductImages,
  reviewProductPhotograph,
  type ProductPhotographResult,
} from '../src/capabilities/verified-product-images';
import type { SearchPort, SearchProductIdentity } from '../src/provider-ports';
import { authority, context, freeOnly } from './editorial-research.fixture';

const checkedAt = '2026-09-29T12:00:00Z';
const attributes = {
  manufacturer: 'Fabricante A',
  officialReference: 'REF-001',
  tone: '01',
  color: 'Morado',
  size: 'Pequeño',
  content: '10 ml',
  presentation: 'Frasco',
  packaging: 'Caja V1',
  gtin: '1234567890128',
};
const identity: SearchProductIdentity = {
  productId: 'durable-product',
  productName: 'Tinta A',
  brandId: 'brand-a',
  brand: 'Marca A',
  sku: 'LIHEN-INTERNAL',
  knownAttributes: attributes,
};
function fixture(url = 'https://brand-a.example/photo.webp'): ProductPhotographResult {
  const binding = {
    imageUrl: url,
    productName: identity.productName,
    brand: identity.brand,
    attributes,
  };
  return {
    uri: 'https://brand-a.example/product',
    title: 'Official fixture — no network',
    productEvidence: {
      domain: 'brand-a.example',
      retrievedAt: '2026-09-29T00:00:00Z',
      claims: [],
      identity: {
        productName: { value: identity.productName, evidenceRef: 'binding' },
        brand: { value: identity.brand!, evidenceRef: 'binding' },
        knownAttributes: Object.fromEntries(
          Object.entries(attributes).map(([key, value]) => [
            key,
            { value, evidenceRef: 'binding' },
          ]),
        ),
      },
      extracts: [
        { id: 'binding', text: JSON.stringify(binding) },
        {
          id: 'rights',
          text: JSON.stringify({
            imageUrl: url,
            commercialReuse: true,
            scope: 'LIHEN_CATALOG',
            expiresAt: '2026-10-01T00:00:00Z',
          }),
        },
      ],
    },
    photographs: [
      {
        imageUrl: url,
        bindingEvidenceRef: 'binding',
        provenance: 'PHOTOGRAPH',
        widthPx: 1600,
        heightPx: 1600,
        rightsEvidenceRef: 'rights',
      },
    ],
  };
}
function assess(result = fixture(), expected = identity) {
  return assessProductPhotograph(
    expected,
    result,
    result.photographs![0]!,
    { authorities: [authority] },
    checkedAt,
  );
}
function provider(results = [fixture()]) {
  const search = vi.fn().mockResolvedValue({ status: 'SUCCESS', messages: [], data: results });
  const port: SearchPort = {
    descriptor: {
      toolId: 'fixture',
      name: 'Fixture',
      kind: 'SEARCH',
      version: '1',
      description: 'No network',
      readOnly: true,
    },
    search,
  };
  return {
    search,
    dependencies: {
      search: port,
      freeOnly,
      authorities: [authority],
      photographEvidenceSupported: true,
    },
  };
}
describe('exact product photograph identity and commercial rights', () => {
  it('cannot issue save-ready authorization from a forged browser stage or a human checkbox', () => {
    const browserReport = { ...assess(), stage: 'READY_FOR_CONTROLLED_SAVE' as const };
    expect(reviewProductPhotograph(browserReport, true, true, checkedAt)).toBe('HUMAN_APPROVED');
  });
  it('treats unknown placeholders as missing identity rather than searchable brand/reference data', () => {
    expect(buildVerifiedImageQuery({ ...identity, brand: 'Sin asignar' })).toBeNull();
    expect(
      buildVerifiedImageQuery({
        ...identity,
        knownAttributes: { ...attributes, manufacturer: 'UNKNOWN' },
      }),
    ).toBeNull();
    expect(
      buildVerifiedImageQuery({
        ...identity,
        knownAttributes: { ...attributes, officialReference: '?' },
      }),
    ).toBeNull();
  });
  it('rejects an excluded stock/Pinterest source even if mistakenly included in an authority registry', () => {
    const original = fixture('https://pinterest.example/photo.webp');
    const result = {
      ...original,
      uri: 'https://pinterest.example/product',
      productEvidence: { ...original.productEvidence!, domain: 'pinterest.example' },
    };
    const reviewed = assessProductPhotograph(
      identity,
      result,
      result.photographs![0]!,
      { authorities: [{ ...authority, domain: 'pinterest.example' }] },
      checkedAt,
    );
    expect(reviewed.identityMatch).toBe('INSUFFICIENT_EVIDENCE');
    expect(reviewed.reasons).toContain('EXCLUDED_IMAGE_SOURCE');
  });
  it('verifies exact official product/variant/resource, without human approval or writes', () => {
    const result = assess();
    expect(result.identityMatch).toBe('EXACT_MATCH');
    expect(result.stage).toBe('RIGHTS_VERIFIED');
    expect(result.authorityEvidenceRef).toBe(authority.verification.evidenceRef);
    expect(reviewProductPhotograph(result, true, false, checkedAt)).toBe('RIGHTS_VERIFIED');
    expect(reviewProductPhotograph(result, true, true, checkedAt)).toBe('HUMAN_APPROVED');
    expect(reviewProductPhotograph(result, false, true, checkedAt)).toBe('RIGHTS_VERIFIED');
  });
  it.each([
    'manufacturer',
    'officialReference',
    'tone',
    'color',
    'size',
    'content',
    'presentation',
    'packaging',
    'gtin',
  ])('rejects a photograph with incompatible %s even when page identity matches', (field) => {
    const result = fixture();
    const extracts = result.productEvidence!.extracts.map((e) =>
      e.id === 'binding'
        ? {
            ...e,
            text: JSON.stringify({
              imageUrl: result.photographs![0]!.imageUrl,
              productName: identity.productName,
              brand: identity.brand,
              attributes: { ...attributes, [field]: 'OTHER' },
            }),
          }
        : e,
    );
    const reviewed = assess({
      ...result,
      productEvidence: { ...result.productEvidence!, extracts },
    });
    expect(reviewed.identityMatch).toBe('IDENTITY_MISMATCH');
    expect(reviewProductPhotograph(reviewed, true, true, checkedAt)).toBe('CANDIDATE');
  });
  it('rejects another reference of the same brand and contradicting Product Master name', () => {
    expect(assess(fixture(), { ...identity, productName: 'Other reference' }).identityMatch).toBe(
      'IDENTITY_MISMATCH',
    );
  });
  it('does not equate high resolution, confidence, category or internal SKU with exact identity', () => {
    const source = fixture();
    expect(
      assess({
        ...source,
        productEvidence: undefined,
        metadata: { confidence: 1, category: 'Beauty' },
      }).identityMatch,
    ).toBe('INSUFFICIENT_EVIDENCE');
    expect(
      buildVerifiedImageQuery({ ...identity, knownAttributes: { sku: 'LIHEN-INTERNAL' } }),
    ).toBeNull();
    expect(buildVerifiedImageQuery(identity)).not.toContain('LIHEN-INTERNAL');
  });
  it('blocks BC-20869 before any provider call; never infers brand from its crop/category', async () => {
    const { search, dependencies } = provider();
    const expected = {
      productId: '27d3e080-4b71-0dc9-6fa8-19ade77a4ad2',
      sku: 'BC-20869',
      productName: '´ MORADA (',
      category: 'Cejas, pestañas y delineadores',
    };
    const result = await researchVerifiedProductImages(
      expected,
      { ...context, context: { ...context.context, entityId: expected.productId } },
      dependencies,
      checkedAt,
    );
    expect(result.status).toBe('INSUFFICIENT_EVIDENCE');
    expect(result.candidates).toEqual([]);
    expect(search).not.toHaveBeenCalled();
  });
  it('rejects unregistered domains, secondary sources and expired authority', () => {
    const source = fixture('https://pinterest.example/image.webp');
    expect(assess(source).identityMatch).toBe('INSUFFICIENT_EVIDENCE');
    for (const record of [
      { ...authority, role: 'SECONDARY_REFERENCE' as const },
      {
        ...authority,
        verification: { ...authority.verification, expiresAt: '2026-09-20T00:00:00Z' },
      },
    ]) {
      expect(
        assessProductPhotograph(
          identity,
          fixture(),
          fixture().photographs![0]!,
          { authorities: [record] },
          checkedAt,
        ).identityMatch,
      ).toBe('INSUFFICIENT_EVIDENCE');
    }
  });
  it.each(['GENERATED', 'UNKNOWN'] as const)('rejects %s provenance', (provenance) => {
    const source = fixture();
    expect(
      assess({ ...source, photographs: [{ ...source.photographs![0]!, provenance }] })
        .identityMatch,
    ).toBe('INSUFFICIENT_EVIDENCE');
  });
  it('requires a binding to the particular photograph, not merely an official product page', () => {
    const source = fixture();
    expect(
      assess({
        ...source,
        photographs: [
          { ...source.photographs![0]!, imageUrl: 'https://brand-a.example/other.webp' },
        ],
      }).identityMatch,
    ).toBe('INSUFFICIENT_EVIDENCE');
  });
  it('does not infer commercial rights from official domain or human selection', () => {
    const source = fixture();
    const result = assess({
      ...source,
      photographs: [{ ...source.photographs![0]!, rightsEvidenceRef: undefined }],
    });
    expect(result.identityMatch).toBe('EXACT_MATCH');
    expect(result.rightsStatus).toBe('UNKNOWN');
    expect(reviewProductPhotograph(result, true, true, checkedAt)).toBe('EXACT_IDENTITY_VERIFIED');
    expect(
      reviewProductPhotograph(
        { ...assess(), authorityExpiresAt: '2027-01-01T00:00:00Z' },
        true,
        true,
        '2026-11-01T00:00:00Z',
      ),
    ).toBe('EXACT_IDENTITY_VERIFIED');
    expect(reviewProductPhotograph(assess(), true, true, '2026-11-01T00:00:00Z')).toBe('CANDIDATE');
  });
  it('keeps human approval separate from save readiness when dimensions are unknown', () => {
    const result = { ...assess(), widthPx: undefined };
    expect(reviewProductPhotograph(result, true, true, checkedAt)).toBe('HUMAN_APPROVED');
  });
  it('reports absent photograph-capable provider without calling search', async () => {
    const { search, dependencies } = provider();
    expect((await researchVerifiedProductImages(identity, context, {}, checkedAt)).status).toBe(
      'SEARCH_PROVIDER_NOT_CONFIGURED',
    );
    expect(
      (
        await researchVerifiedProductImages(
          identity,
          context,
          { ...dependencies, photographEvidenceSupported: false },
          checkedAt,
        )
      ).status,
    ).toBe('SEARCH_PROVIDER_NOT_CONFIGURED');
    expect(search).not.toHaveBeenCalled();
  });
  it('reuses governed SearchPort with exact allowlisted domains, caps at five and never pads results', async () => {
    const results = Array.from({ length: 8 }, (_, i) =>
      fixture(`https://brand-a.example/photo-${i}.webp`),
    );
    const { search, dependencies } = provider(results);
    const result = await researchVerifiedProductImages(identity, context, dependencies, checkedAt);
    expect(result.status).toBe('COMPLETED');
    expect(result.candidates).toHaveLength(5);
    expect(search.mock.calls[0]![0]).toMatchObject({
      costPolicy: 'FREE_ONLY',
      queries: [{ domains: ['brand-a.example'], maxResults: 8 }],
    });
    const one = provider([fixture(), fixture()]);
    expect(
      (await researchVerifiedProductImages(identity, context, one.dependencies, checkedAt))
        .candidates,
    ).toHaveLength(1);
  });
  it('requires a read-only, free-only, scoped provider and returns failures explicitly', async () => {
    const { search, dependencies } = provider();
    expect(
      (
        await researchVerifiedProductImages(
          identity,
          context,
          { ...dependencies, freeOnly: undefined },
          checkedAt,
        )
      ).status,
    ).toBe('POLICY_BLOCKED');
    expect(search).not.toHaveBeenCalled();
    search.mockRejectedValueOnce(new Error('provider unavailable'));
    expect(
      (await researchVerifiedProductImages(identity, context, dependencies, checkedAt)).status,
    ).toBe('PROVIDER_FAILED');
    search.mockResolvedValueOnce({
      status: 'SUCCESS',
      messages: [],
      data: [fixture()],
      trace: { usage: { costEstimate: 1 } },
    });
    expect(
      (await researchVerifiedProductImages(identity, context, dependencies, checkedAt)).status,
    ).toBe('POLICY_BLOCKED');
  });
});
