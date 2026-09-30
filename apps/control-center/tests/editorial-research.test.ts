import { describe, expect, it } from 'vitest';
import {
  assessEditorialSearchResult,
  type EditorialResearchReport,
} from '@lihen/intelligence-core';
import type { ProductDetailDTO } from '@lihen/products';
import {
  authority,
  identity,
  searchResult,
} from '../../../packages/intelligence-core/tests/editorial-research.fixture';
import {
  acceptResearchEvidence,
  internalEditorialGrounding,
} from '../src/composition/editorial-grounding';
import { researchEditorialGroundingWithClient } from '../src/composition/editorial-research';
import {
  buildEditorialIntelligencePrompt,
  type EditorialIntelligenceInput,
} from '../src/composition/editorial-intelligence';

const detail = {
  id: identity.productId,
  name: identity.productName,
  sku: identity.sku,
  brandId: identity.brandId,
  brandName: identity.brand,
  categoryName: identity.category,
} as ProductDetailDTO;
const internal = () => internalEditorialGrounding(detail, '2026-09-29T00:00:00Z');
const report = (): EditorialResearchReport => ({
  identity,
  status: 'COMPLETED',
  evidenceStatus: 'SUPPORTED',
  query: 'fixture',
  sources: [assessEditorialSearchResult(identity, searchResult(), [authority])],
});

describe('editorial research integration without provider activation', () => {
  it('missing SearchPort preserves the actual internal facts and supplies explicit insufficient evidence', async () => {
    const before = internal();
    const result = await researchEditorialGroundingWithClient(before, {
      functions: {
        invoke: async () => ({
          data: {
            runtime: 'LIHEN_INTELLIGENCE',
            action: 'EDITORIAL_RESEARCH',
            requestId: 'request-test',
            correlationId: 'correlation-test',
            report: {
              identity: before.productIdentity,
              status: 'SEARCH_PROVIDER_NOT_CONFIGURED',
              evidenceStatus: 'INSUFFICIENT_EVIDENCE',
              query: null,
              sources: [],
            },
          },
          error: null,
        }),
      },
    });
    expect(result.evidence.internalFacts).toEqual(before.evidence.internalFacts);
    expect(result.evidence.sources).toEqual(before.evidence.sources);
    expect(result.evidence.research).toMatchObject({
      status: 'SEARCH_PROVIDER_NOT_CONFIGURED',
      evidenceStatus: 'INSUFFICIENT_EVIDENCE',
      sources: [],
    });
    expect(result.evidence.officialBrandFacts).toEqual([]);
    expect(result.evidence.secondaryFacts).toEqual([]);
  });
  it('verified external claims carry extracts and confidence but cannot override internal fields', () => {
    const merged = acceptResearchEvidence(internal(), report());
    expect(merged.evidence.officialBrandFacts[0]).toMatchObject({
      field: 'ingredients',
      evidenceRefs: ['ingredient'],
      usableInCopy: true,
    });
    expect(merged.evidence.officialBrandFacts[0]!.confidence?.score).toBe(0.9);
    expect(merged.evidence.officialBrandFacts[1]).toMatchObject({
      field: 'name',
      usableInCopy: false,
    });
    expect(merged.evidence.internalFacts.find((fact) => fact.field === 'name')?.value).toBe(
      'Agua de rosas',
    );
  });
  it('unknown authority and mismatched source identities cannot inject facts into grounding', () => {
    const source = report().sources[0]!;
    for (const change of [
      { authority: 'UNVERIFIED' as const },
      { identityMatch: 'IDENTITY_MISMATCH' as const },
    ]) {
      const merged = acceptResearchEvidence(internal(), {
        ...report(),
        sources: [{ ...source, ...change }],
      });
      expect(merged.evidence.officialBrandFacts).toEqual([]);
      expect(merged.evidence.secondaryFacts).toEqual([]);
    }
  });
  it('general context cannot masquerade as a verified claim, even with a copied reference', () => {
    const source = report().sources[0]!;
    const merged = acceptResearchEvidence(internal(), {
      ...report(),
      sources: [
        {
          ...source,
          claims: source.claims.map((claim) => ({
            ...claim,
            classification: 'GENERAL_EDITORIAL_CONTEXT',
          })),
        },
      ],
    });
    expect(merged.evidence.officialBrandFacts).toEqual([]);
  });
  it('generation receives only admitted external facts, never rejected results or research snippets', () => {
    const grounding = acceptResearchEvidence(internal(), report());
    const input = {
      product: detail,
      channels: ['INSTAGRAM_FEED'],
      target: 'all',
      draft: {
        channels: ['INSTAGRAM_FEED'],
        productId: detail.id,
        campaignName: '',
        copy: '',
        callToAction: '',
        hashtags: '',
        creativeAssetIds: [],
        date: '',
      },
    } as EditorialIntelligenceInput;
    const prompt = buildEditorialIntelligencePrompt(input, grounding);
    expect(prompt).toContain('Ingrediente documentado en fixture');
    expect(prompt).not.toContain('Conflicting external name');
    expect(prompt).not.toContain('Discovery only');
    expect(prompt).not.toContain('Synthetic product source');
  });
  it.each(['productId', 'sku', 'brand', 'brandId'])(
    'stale report for changed %s is rejected, without modifying current evidence',
    (field) => {
      const before = internal();
      expect(() =>
        acceptResearchEvidence(before, {
          ...report(),
          identity: { ...identity, [field]: 'changed' },
        }),
      ).toThrow('IDENTITY_MISMATCH');
      expect(before.evidence.officialBrandFacts).toEqual([]);
    },
  );
});
