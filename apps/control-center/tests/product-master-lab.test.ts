import type { ProductImageDTO } from '@lihen/products';
import type { VariantEvidence, VariantMedia } from '../src/domain/product-variant-demand';
import { describe, it, expect } from 'vitest';
import {
  identityBaseline,
  buildProductMasterProjection,
  type CommercialNameReview,
  commercialNameProposalIssues,
  canApproveCommercialName,
  reviewCommercialNameProposal,
  type CommercialNameProposal,
  proposalIssues,
  publicHttps,
  recoverReview,
  reviewProposal,
  type IdentityProposal,
} from '../src/domain/product-master-lab';
import {
  variantDemand,
  mediaForVariant,
  canApproveVariantMedia,
  type CommercialFact,
} from '../src/domain/product-variant-demand';
import { localFixture } from '../../../tests/product-master/local-lab-fixture';
import {
  loadLocalLabData,
  clearLocalLabData,
  localLabSchema,
} from '../src/domain/product-master-lab-data';
// Synthetic test-only identity; no DEV snapshots or photographic payloads.
const pilots = { products: [{ id: 'test-pilot', sku: 'BC-20550', name: 'BASE ATENEA 30ML', business_line: 'BEAUTY_CARE', images: [] }] };
const official = {
  variants: localFixture.family.variants.map((v) => ({ ...v, exactMatchToLihen: 'UNCONFIRMED' })),
};
const p: IdentityProposal = {
  productId: 'durable-id',
  baseline: 'v1',
  values: {
    name: 'Official name',
    brand: 'Official brand',
    manufacturer: '',
    reference: '',
    gtin: '',
    variant: 'tone 1 / 30 ml',
    description: '',
    supplier: '',
  },
  sourceUrl: 'https://brand.example.com/product',
  sourceKind: 'BRAND',
  evidence: 'Source lists exact variant; reviewed manually',
  checkedAt: '2026-01-01',
  exactVariant: true,
  discardedVariants: '',
  reviewer: 'Human tester',
};
describe('Product Master isolated review', () => {
  it('requires source, exact variant and reviewer before rehearsal approval', () => {
    expect(() => reviewProposal({ ...p, exactVariant: false }, true)).toThrow('EVIDENCE_REQUIRED');
    expect(proposalIssues({ ...p, evidence: '', reviewer: '' })).toHaveLength(2);
  });
  it('keeps durable identity and current data unchanged during approval', () => {
    const input = structuredClone(p);
    const result = reviewProposal(input, true);
    result.proposal.values.name = 'Changed proposal';
    expect(input).toEqual(p);
    expect(result.proposal.productId).toBe('durable-id');
    expect(result.status).toBe('APPROVED_REHEARSAL');
  });
  it('roundtrips explicit local files and requires reapproval', () => {
    const result = recoverReview(JSON.stringify(reviewProposal(p, true)), 'durable-id', 'v1');
    expect(result.proposal).toEqual(p);
    expect(result.status).toBe('PENDING');
    expect(result.events[0]?.action).toBe('RECOVERED_REQUIRES_REVIEW');
  });
  it('rejects stale identity, wrong product, malformed fields and huge files', () => {
    const json = JSON.stringify(reviewProposal(p, true));
    expect(() => recoverReview(json, 'other', 'v1')).toThrow();
    expect(() => recoverReview(json, 'durable-id', 'v2')).toThrow();
    expect(() => recoverReview('{}', 'durable-id', 'v1')).toThrow();
    expect(() => recoverReview(' '.repeat(100001), 'durable-id', 'v1')).toThrow();
  });
  it('does not interpret private URLs or credentialed URLs as public source links', () => {
    for (const value of [
      'http://brand.com',
      'https://127.0.0.1',
      'https://[::1]',
      'https://user:password@brand.com',
      'https://host.internal',
    ])
      expect(publicHttps(value)).toBe(false);
  });
  it('baselines durable ID and old name without changing SKU', () => {
    expect(identityBaseline({ id: 'p', name: 'Old', sku: 'sku', businessLine: 'STYLE' })).not.toBe(
      identityBaseline({ id: 'p', name: 'New', sku: 'sku', businessLine: 'STYLE' }),
    );
  });
  it('requires explicit validated local input and rejects malformed payloads', () => {
    expect(localLabSchema.safeParse({}).success).toBe(false);
    expect(() => loadLocalLabData('{')).toThrow();
    expect(() =>
      loadLocalLabData(
        JSON.stringify({
          ...localFixture,
          products: [localFixture.products[0], localFixture.products[0]],
        }),
      ),
    ).toThrow('Identificadores duplicados');
    expect(() => loadLocalLabData(JSON.stringify(localFixture))).not.toThrow();
    clearLocalLabData();
  });
});
describe('variant boundaries and commercial facts', () => {
  const scope = { familyProductId: 'p', variantId: 'light30' };
  const fact: CommercialFact = {
    ...scope,
    verified: true,
    currency: 'COP',
    from: '2026-01-01',
    to: '2026-02-01',
    soldUnits: 12,
    realizedRevenue: 600000,
    confirmedOrderUnits: 15,
    averageStock: 6,
  };
  const demand = (facts: CommercialFact[]) => variantDemand(scope, facts, fact.from, fact.to);
  it('supports all source variants beyond gallery limits without creating internal IDs', () => {
    expect(official.variants.length).toBeGreaterThan(10);
    expect(official.variants.some((v) => v.title.endsWith('30ml'))).toBe(true);
    expect(official.variants.some((v) => v.title.endsWith('50ml'))).toBe(true);
    expect(official.variants.every((v) => v.exactMatchToLihen === 'UNCONFIRMED')).toBe(true);
  });
  it('does not share pictures between tones, presentations or parent products', () => {
    const image = {
      ...scope,
      id: 'img',
      imageUrl: 'https://brand.com/a.webp',
      rights: 'UNVERIFIED' as const,
      exactMatch: false,
    };
    expect(
      mediaForVariant(scope, [
        image,
        { ...image, variantId: 'light50' },
        { ...image, familyProductId: 'other' },
      ]),
    ).toEqual([image]);
  });
  it('blocks media approval without both rights and exact identity', () => {
    const image = {
      ...scope,
      id: 'img',
      imageUrl: 'https://brand.com/a.webp',
      rights: 'UNVERIFIED' as const,
      exactMatch: false,
    };
    expect(canApproveVariantMedia(image, 'I approve', true)).toBe(false);
    expect(
      canApproveVariantMedia(
        { ...image, rights: 'VERIFIED', exactMatch: true },
        'license reference',
        true,
      ),
    ).toBe(true);
  });
  it('shows no data rather than zero for missing variant allocations', () => {
    expect(demand([])).toMatchObject({
      status: 'SIN DATOS',
      units: null,
      revenue: null,
      turnover: null,
    });
    expect(demand([{ ...fact, variantId: 'other' }]).units).toBeNull();
    expect(demand([{ ...fact, familyProductId: 'other' }]).units).toBeNull();
  });
  it('calculates sales, realized revenue, registered orders and turnover only in exact scope', () => {
    expect(demand([fact, { ...fact, variantId: 'other', soldUnits: 999 }])).toMatchObject({
      units: 12,
      revenue: 600000,
      requested: 15,
      turnover: 2,
    });
  });
  it('refuses unverified, duplicate, nonfinite, mixed currency or period data', () => {
    for (const facts of [
      [{ ...fact, verified: false }],
      [fact, fact],
      [{ ...fact, realizedRevenue: NaN }],
      [{ ...fact, currency: 'USD' }],
      [{ ...fact, to: '2026-03-01' }],
    ])
      expect(demand(facts).status).toBe('NO VERIFICADO');
  });
  it('distinguishes recorded zero sales from absent data and never divides by zero stock', () => {
    expect(demand([{ ...fact, soldUnits: 0, realizedRevenue: 0, averageStock: 0 }])).toMatchObject({
      status: 'DATOS REGISTRADOS',
      units: 0,
      turnover: null,
    });
  });
});

describe('PM2-PRODUCT-NAME-01 independent local name review', () => {
  const current = {
    id: 'synthetic-product',
    name: 'Current name',
    sku: 'TEST',
    businessLine: 'STYLE',
  };
  function proposal(): CommercialNameProposal {
    return {
      productId: current.id,
      currentName: current.name,
      candidateName: 'Evidence-backed test name',
      baseline: identityBaseline(current),
      evidence: 'Exact name transcribed from the referenced source.',
      sourceUrl: 'https://brand.example.com/product',
      sourceKind: 'BRAND',
      checkedAt: '2026-01-02',
      reviewer: '',
      evidenceRecords: [
        {
          id: 'e1',
          productId: current.id,
          candidateName: 'Evidence-backed test name',
          sourceKind: 'BRAND',
          sourceUrl: 'https://brand.example.com/product',
          excerpt: 'Evidence-backed test name',
          checkedAt: '2026-01-01',
          resolvesConflictIds: ['c1'],
        },
      ],
      identificationConflicts: [],
    };
  }
  it('separates eligibility from an explicit human name-only approval without mutating inputs', () => {
    const input = proposal();
    const before = structuredClone({ input, current });
    expect(canApproveCommercialName(input, current)).toBe(true);
    expect(input.reviewer).toBe('');
    expect(() => reviewCommercialNameProposal(input, current, true, '')).toThrow(
      'NAME_HUMAN_REVIEW_REQUIRED',
    );
    const reviewed = reviewCommercialNameProposal(input, current, true, 'Human reviewer');
    expect(reviewed.status).toBe('APPROVED_REHEARSAL');
    expect(reviewed.proposal.productId).toBe(current.id);
    expect(reviewed).not.toHaveProperty('imageApproval');
    expect(reviewed).not.toHaveProperty('variantApproval');
    reviewed.proposal.candidateName = 'Changed local copy';
    expect({ input, current }).toEqual(before);
  });
  it('requires existing, product-bound evidence explicitly addressing each conflict and human resolution', () => {
    const input = proposal();
    input.identificationConflicts = [
      {
        id: 'c1',
        description: 'Conflicting label',
        resolutionEvidenceIds: [],
        resolvedBy: null,
        resolvedAt: null,
      },
    ];
    expect(canApproveCommercialName(input, current)).toBe(false);
    input.identificationConflicts = [
      {
        ...input.identificationConflicts[0]!,
        resolutionEvidenceIds: ['I confirm the name'],
        resolvedBy: 'Reviewer',
        resolvedAt: '2026-01-03',
      },
    ];
    expect(commercialNameProposalIssues(input, current)).toContain('NAME_CONFLICT_UNRESOLVED');
    input.identificationConflicts = [
      { ...input.identificationConflicts[0]!, resolutionEvidenceIds: ['e1'] },
    ];
    expect(canApproveCommercialName(input, current)).toBe(true);
    input.evidenceRecords[0]!.resolvesConflictIds = [];
    expect(canApproveCommercialName(input, current)).toBe(false);
  });
  it('accepts a stable authenticated DEV image locator without requiring a public URL', () => {
    const input = proposal();
    input.sourceKind = 'DEV_PRIVATE';
    input.sourceUrl =
      'https://vnmkupzptujtywnnabkp.supabase.co/storage/v1/object/authenticated/lihen-product-originals/products/synthetic-product/source.webp';
    input.evidenceRecords = [
      {
        ...input.evidenceRecords[0]!,
        sourceKind: input.sourceKind,
        sourceUrl: input.sourceUrl,
      },
    ];
    expect(canApproveCommercialName(input, current)).toBe(true);
    for (const url of [
      input.sourceUrl.replace('synthetic-product', 'other-product'),
      input.sourceUrl.replace('vnmkupzptujtywnnabkp', 'gqitoossdbiohqegjvlh'),
      input.sourceUrl + '?token=secret',
      'file:///private-image.webp',
      'https://brand.example.com/source.webp',
    ]) {
      const invalid = {
        ...input,
        sourceUrl: url,
        evidenceRecords: [{ ...input.evidenceRecords[0]!, sourceUrl: url }],
      };
      expect(canApproveCommercialName(invalid, current)).toBe(false);
    }
  });
  it.each(['name', 'id', 'sku', 'businessLine'] as const)(
    'rejects stale baseline after changing %s',
    (field) => {
      const changed = { ...current, [field]: 'changed' };
      expect(commercialNameProposalIssues(proposal(), changed)).toContain('NAME_BASELINE_STALE');
      expect(() => reviewCommercialNameProposal(proposal(), changed, true, 'Reviewer')).toThrow(
        'NAME_PROPOSAL_NOT_ELIGIBLE',
      );
    },
  );
  it('rejects empty names, insufficient evidence, cross-product records and future or untraceable resolution', () => {
    for (const input of [
      { ...proposal(), candidateName: null },
      { ...proposal(), candidateName: ' ' },
      { ...proposal(), evidence: '' },
      { ...proposal(), evidenceRecords: [] },
      {
        ...proposal(),
        evidenceRecords: [{ ...proposal().evidenceRecords[0]!, productId: 'other' }],
      },
      {
        ...proposal(),
        evidenceRecords: [{ ...proposal().evidenceRecords[0]!, candidateName: 'another name' }],
      },
      {
        ...proposal(),
        evidenceRecords: [{ ...proposal().evidenceRecords[0]!, checkedAt: '2999-01-01' }],
      },
      {
        ...proposal(),
        identificationConflicts: [
          {
            id: 'c1',
            description: 'Conflict',
            resolutionEvidenceIds: ['e1'],
            resolvedBy: 'Reviewer',
            resolvedAt: '2025-01-01',
          },
        ],
      },
    ])
      expect(() => reviewCommercialNameProposal(input, current, true, 'Reviewer')).toThrow(
        'NAME_PROPOSAL_NOT_ELIGIBLE',
      );
  });
  it('keeps BC-20550 BASE ATENEA 30ML without a substitute or approval while identity conflicts remain', () => {
    const pilot = pilots.products.find((product) => product.sku === 'BC-20550')!;
    const product = {
      id: pilot.id,
      name: pilot.name,
      sku: pilot.sku,
      businessLine: pilot.business_line,
    };
    const before = JSON.stringify(pilot);
    const input: CommercialNameProposal = {
      ...proposal(),
      productId: product.id,
      currentName: product.name,
      baseline: identityBaseline(product),
      candidateName: null,
      evidenceRecords: [],
      identificationConflicts: [
        {
          id: 'identity',
          description: 'Atenea versus unverified visual attribution',
          resolutionEvidenceIds: [],
          resolvedBy: null,
          resolvedAt: null,
        },
      ],
    };
    expect(product.name).toBe('BASE ATENEA 30ML');
    expect(canApproveCommercialName(input, product)).toBe(false);
    expect(() => reviewCommercialNameProposal(input, product, true, 'Reviewer')).toThrow(
      'NAME_PROPOSAL_NOT_ELIGIBLE',
    );
    expect(JSON.stringify(pilot)).toBe(before);
  });
});

describe('PM2-PRODUCT-PROJECTION-01 read-only scope and independent review states', () => {
  const product = {
    id: 'projection-test',
    name: 'Current test name',
    sku: 'TEST',
    businessLine: 'STYLE',
  };
  const image: ProductImageDTO = {
    id: 'image-1',
    productId: product.id,
    publicUrl: 'https://brand.example.com/image.webp',
    isMain: true,
    sortOrder: 0,
    sourceType: 'MANUAL',
  };
  const variant: VariantEvidence = {
    familyProductId: product.id,
    sourceVariantId: 'external-test-reference',
    attributes: {},
    sourceUrl: 'https://brand.example.com/reference',
    code: null,
    status: 'UNCONFIRMED',
  };
  const media: VariantMedia = {
    familyProductId: product.id,
    variantId: variant.sourceVariantId,
    id: image.id,
    imageUrl: image.publicUrl,
    rights: 'UNVERIFIED',
    exactMatch: false,
  };
  const input = () => ({
    nameReview: null as CommercialNameReview | null,
    variants: [structuredClone(variant)],
    variantMedia: [structuredClone(media)],
    images: [structuredClone(image)],
  });
  function nameReview(): CommercialNameReview {
    const proposal: CommercialNameProposal = {
      productId: product.id,
      currentName: product.name,
      candidateName: 'Synthetic candidate',
      baseline: identityBaseline(product),
      evidence: 'Source transcription',
      sourceKind: 'BRAND',
      sourceUrl: 'https://brand.example.com/name',
      checkedAt: '2026-01-02',
      reviewer: '',
      evidenceRecords: [
        {
          id: 'name-source',
          productId: product.id,
          candidateName: 'Synthetic candidate',
          sourceKind: 'BRAND',
          sourceUrl: 'https://brand.example.com/name',
          excerpt: 'Synthetic candidate',
          checkedAt: '2026-01-01',
          resolvesConflictIds: [],
        },
      ],
      identificationConflicts: [],
    };
    return reviewCommercialNameProposal(proposal, product, true, 'Test reviewer');
  }
  it('retains product and ID, preserving historical name approval without commercial application or other approvals', () => {
    const source = { ...input(), nameReview: nameReview() };
    const result = buildProductMasterProjection(product, source);
    expect(result.product).toEqual(product);
    expect(result.name).toMatchObject({
      currentName: product.name,
      eligible: true,
      applied: false,
      recordedReview: { status: 'APPROVED_REHEARSAL' },
    });
    expect(result.variants[0]?.reviewStatus).toBe('PENDING');
    expect(result.images.reviewStatus).toBe('PENDING');
    expect(result.variants[0]?.evidence.status).toBe('UNCONFIRMED');
    expect(result.blockers).toContain('VISUAL_PROVENANCE_UNCONFIRMED');
  });
  it('keeps a stale historical review but makes its current eligibility false', () => {
    const review = nameReview();
    const result = buildProductMasterProjection(
      { ...product, name: 'New current name' },
      { ...input(), nameReview: review },
    );
    expect(result.name.recordedReview).toEqual(review);
    expect(result.name.recordedReview?.status).toBe('APPROVED_REHEARSAL');
    expect(result.name.eligible).toBe(false);
    expect(result.name.eligibilityIssues).toContain('NAME_BASELINE_STALE');
    expect(result.name.applied).toBe(false);
  });
  it('links only an explicit matching family, variant reference, image ID and URL, never assigns roles from isMain', () => {
    const result = buildProductMasterProjection(product, input());
    expect(result.variants[0]?.images).toEqual([media]);
    expect(result.images.roles).toEqual({
      catalogPrimary: null,
      webPrimary: null,
      gallery: [],
      groupPhoto: [],
      byVariant: {},
    });
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        'VARIANT_SOURCE_UNCONFIRMED',
        'VARIANT_IDENTITY_UNCONFIRMED',
        'VARIANT_IMAGE_RIGHTS_UNCONFIRMED',
        'IMAGE_ROLES_PENDING',
      ]),
    );
    expect(result.variants[0]?.evidence.code).toBeNull();
  });
  it.each(['id', 'imageUrl', 'variantId'] as const)(
    'preserves unlinked evidence rather than manufacturing a relation after %s mismatch',
    (field) => {
      const source = input();
      source.variantMedia[0] = { ...source.variantMedia[0]!, [field]: 'unmatched' };
      const result = buildProductMasterProjection(product, source);
      expect(result.variants[0]?.images).toEqual([]);
      expect(result.unlinkedVariantMedia).toEqual(source.variantMedia);
      expect(result.blockers).toContain('VARIANT_MEDIA_LINK_UNRESOLVED');
    },
  );
  it('refuses ambiguous image or variant identifiers without discarding their evidence', () => {
    const source = input();
    source.images.push({ ...image, publicUrl: 'https://brand.example.com/other.webp' });
    expect(buildProductMasterProjection(product, source).variants[0]?.images).toEqual([]);
    source.variants.push(structuredClone(variant));
    const result = buildProductMasterProjection(product, source);
    expect(result.variants).toHaveLength(2);
    expect(result.variants.every((candidate) => candidate.images.length === 0)).toBe(true);
    expect(result.blockers).toContain('VARIANT_REFERENCE_AMBIGUOUS');
  });
  it('excludes cross-product relationships, including foreign evidence nested in a name review', () => {
    const source = input();
    source.images.push({ ...image, productId: 'other-product' });
    source.variants.push({ ...variant, familyProductId: 'other-product' });
    source.variantMedia.push({ ...media, familyProductId: 'other-product' });
    source.nameReview = nameReview();
    source.nameReview.proposal.evidenceRecords[0]!.productId = 'other-product';
    const result = buildProductMasterProjection(product, source);
    expect(result.images.references).toEqual([image]);
    expect(result.variants).toHaveLength(1);
    expect(result.variants[0]?.images).toEqual([media]);
    expect(result.name.recordedReview).toBeNull();
    expect(result.name.eligibilityIssues).toContain('NAME_REVIEW_PRODUCT_MISMATCH');
    expect(result.blockers).toContain('FOREIGN_PRODUCT_REFERENCES_IGNORED');
    expect(JSON.stringify(result)).not.toContain('other-product');
  });
  it('isolates output snapshots from deeply frozen inputs in both directions', () => {
    const source = input();
    const freeze = (value: unknown) => {
      if (value && typeof value === 'object') {
        Object.values(value).forEach(freeze);
        Object.freeze(value);
      }
    };
    const before = JSON.stringify({ product, source });
    freeze(source);
    const result = buildProductMasterProjection(product, source);
    result.product.name = 'Output only';
    result.variants[0]!.evidence.code = 'Output only';
    (result.images.references[0]! as { publicUrl: string }).publicUrl =
      'https://example.com/output';
    result.images.roles.gallery.push(image.id);
    expect(JSON.stringify({ product, source })).toBe(before);
    expect(result.images.roles.groupPhoto).toEqual([]);
    expect(result.images.roles.byVariant).toEqual({});
  });
  it('does not promote official source labels, exactMatch or rights flags into human approval', () => {
    const source = input();
    source.variants[0]!.status = 'OFFICIAL_SOURCE';
    source.variantMedia[0]!.rights = 'VERIFIED';
    source.variantMedia[0]!.exactMatch = true;
    const result = buildProductMasterProjection(product, source);
    expect(result.variants[0]?.reviewStatus).toBe('PENDING');
    expect(result.variants[0]?.images[0]?.rights).toBe('VERIFIED');
    expect(result.blockers).toContain('VARIANT_REVIEW_PENDING');
    expect(result.blockers).toContain('VISUAL_PROVENANCE_UNCONFIRMED');
  });
  it('keeps BC-20550 unchanged with no variants, pending roles and unresolved identity discrepancy', () => {
    const pilot = pilots.products.find((candidate) => candidate.sku === 'BC-20550')!;
    const current = {
      id: pilot.id,
      name: pilot.name,
      sku: pilot.sku,
      businessLine: pilot.business_line,
    };
    const review = nameReview();
    review.status = 'PENDING';
    review.events = [];
    review.proposal = {
      ...review.proposal,
      productId: current.id,
      currentName: current.name,
      candidateName: null,
      baseline: identityBaseline(current),
      evidenceRecords: [],
      identificationConflicts: [
        {
          id: 'identity',
          description: 'Atenea versus unverified visual attribution',
          resolutionEvidenceIds: [],
          resolvedBy: null,
          resolvedAt: null,
        },
      ],
    };
    const before = JSON.stringify(pilot);
    const result = buildProductMasterProjection(current, {
      nameReview: review,
      variants: [],
      variantMedia: [],
      images: [],
    });
    expect(result.product.name).toBe('BASE ATENEA 30ML');
    expect(result.product.id).toBe(pilot.id);
    expect(result.name).toMatchObject({
      currentName: 'BASE ATENEA 30ML',
      eligible: false,
      applied: false,
    });
    expect(result.name.recordedReview?.proposal.candidateName).toBeNull();
    expect(result.variants).toEqual([]);
    expect(result.images.roles).toEqual({
      catalogPrimary: null,
      webPrimary: null,
      gallery: [],
      groupPhoto: [],
      byVariant: {},
    });
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        'NAME_CONFLICT_UNRESOLVED',
        'IDENTITY_REVIEW_PENDING',
        'VARIANT_REFERENCES_PENDING',
        'VISUAL_PROVENANCE_UNCONFIRMED',
      ]),
    );
    expect(JSON.stringify(pilot)).toBe(before);
  });
});
