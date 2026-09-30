import { assessEditorialSearchResult } from '@lihen/intelligence-core';
import {
  authority,
  searchResult,
} from '../../../packages/intelligence-core/tests/editorial-research.fixture';
import { describe, expect, it, vi } from 'vitest';
import type { ProductDetailDTO, ProductListItemDTO } from '@lihen/products';
import {
  createEditorialIntelligence,
  editorialIntelligenceContext,
  EditorialIntelligenceUnavailable,
  type EditorialIntelligenceInput,
} from '../src/composition/editorial-intelligence';
import { createAssistantRuntimeInvoker } from '../src/composition/assistant-runtime';
import {
  createEditorialDraft,
  saveEditorialItemToRuntime,
} from '../src/composition/editorial-workspace';
import {
  acceptResearchEvidence,
  internalEditorialGrounding,
  type VerifiedResearchRecord,
} from '../src/composition/editorial-grounding';
import { groundedPlanSchema, renderGroundedPlan } from '../src/composition/editorial-grounded-text';

const detail: ProductDetailDTO = {
  id: 'durable-product',
  name: 'Agua de rosas',
  sku: 'BC-067',
  brandId: 'brand-a',
  brandName: 'Marca A',
  categoryId: 'category',
  categoryName: 'Cuidado',
  slug: 'agua-rosas',
  businessLine: 'BEAUTY_CARE',
  status: 'ACTIVE',
  salePrice: { amount: 10000, currency: 'COP' },
};
const product = detail as ProductListItemDTO;
const grounding = () => internalEditorialGrounding(detail, '2026-09-29T12:00:00Z');
const input: EditorialIntelligenceInput = {
  product,
  target: 'all',
  channels: ['INSTAGRAM_FEED', 'TIKTOK'],
  draft: {
    productId: product.id,
    campaignName: 'Concepto manual',
    copy: '',
    callToAction: '',
    hashtags: '',
    date: '',
    creativeAssetIds: [],
    channels: ['INSTAGRAM_FEED', 'TIKTOK'],
    channelVariants: {
      INSTAGRAM_FEED: {
        copy: 'Manual IG',
        callToAction: 'CTA IG',
        hashtags: '#IG',
        creativeAssetIds: ['image-id'],
      },
      TIKTOK: {
        copy: 'Manual TT',
        callToAction: 'CTA TT',
        hashtags: '#TT',
        creativeAssetIds: ['video-id'],
      },
    },
  },
};
const recommendation = {
  productId: product.id,
  campaignName: [{ editorial: 'campaign.focus' }, { fact: 'internal:name' }],
  variants: [
    {
      channel: 'INSTAGRAM_FEED',
      copy: [{ fact: 'internal:name' }, { editorial: 'feed.invite' }],
      callToAction: [{ editorial: 'cta.explore' }],
      hashtags: ['editorial:lihen', 'internal:category', 'internal:category'],
    },
    {
      channel: 'TIKTOK',
      copy: [{ editorial: 'tiktok.hook' }, { fact: 'internal:name' }],
      callToAction: [{ editorial: 'cta.comment' }],
      hashtags: ['editorial:lihen', 'internal:name'],
    },
  ],
};
const turn = (answer = JSON.stringify(recommendation)) => ({
  status: 'SUCCESS',
  answer,
  contextSource: 'ProductMaster:GetProductById',
  context: {
    contextId: 'product',
    type: 'PRODUCT',
    entityId: detail.id,
    attributes: { product: detail },
  },
});
const research = (
  trust: 'VERIFIED_OFFICIAL_BRAND' | 'SUPPORTED_SECONDARY' = 'VERIFIED_OFFICIAL_BRAND',
): VerifiedResearchRecord => ({
  identity: grounding().productIdentity,
  status: 'COMPLETED',
  evidenceStatus: 'SUPPORTED',
  query: 'fixture',
  sources: [
    assessEditorialSearchResult(grounding().productIdentity, searchResult(), [
      {
        ...authority,
        role: trust === 'VERIFIED_OFFICIAL_BRAND' ? 'OFFICIAL_BRAND' : 'SECONDARY_REFERENCE',
      },
    ]),
  ],
});
const researchGrounding = async <T>(value: T): Promise<T> => value;

describe('grounded editorial recommendations', () => {
  it('resolves exact product/SKU/brand before generation and includes channel context without changing manual input', async () => {
    const read = vi.fn().mockResolvedValue(grounding());
    const invokeProductTurn = vi.fn().mockResolvedValue(turn());
    const before = JSON.stringify(input);
    const result = await createEditorialIntelligence(
      { invokeProductTurn },
      read,
      researchGrounding,
    )(input);
    expect(read).toHaveBeenCalledWith(product);
    expect(read.mock.invocationCallOrder[0]).toBeLessThan(
      invokeProductTurn.mock.invocationCallOrder[0]!,
    );
    const request = invokeProductTurn.mock.calls[0]![0];
    expect(request.productId).toBe(product.id);
    for (const value of ['BC-067', 'Marca A', 'Manual IG', 'video-id', 'Hook rápido'])
      expect(request.prompt).toContain(value);
    expect(JSON.stringify(input)).toBe(before);
    expect(result.productIdentity).toMatchObject({
      productId: product.id,
      sku: 'BC-067',
      brand: 'Marca A',
    });
    expect(result.evidence.usedFactIds).toContain('internal:name');
    expect(result.evidence.sources[0]!.trust).toBe('VERIFIED_INTERNAL');
    expect(result.variants[0]!.callToAction).not.toBe(result.variants[1]!.callToAction);
    expect(result.variants[0]!.hashtags).toEqual(['#LIHENCO', '#Cuidado']);
    expect(result.variants[1]!.hashtags).toEqual(['#LIHENCO', '#Aguaderosas']);
  });

  it('omits absent fields and marks unsupported product properties as insufficient', () => {
    const minimal = { id: 'minimal', name: 'Producto' } as ProductDetailDTO;
    expect(internalEditorialGrounding(minimal, 'now').productIdentity).toEqual({
      productId: 'minimal',
      productName: 'Producto',
    });
    expect(internalEditorialGrounding(minimal, 'now').evidence.internalFacts).toHaveLength(1);
    expect(grounding().evidence.unsupportedClaims).toContainEqual({
      field: 'ingredients',
      status: 'INSUFFICIENT_EVIDENCE',
    });
    expect(
      editorialIntelligenceContext({
        ...input,
        product: { id: 'minimal', name: 'Producto' } as ProductListItemDTO,
      }).product,
    ).toEqual({ product_id: 'minimal', name: 'Producto' });
  });

  it.each(['brand', 'productId', 'sku', 'brandId'])(
    'rejects another identity differing in %s including Agua de rosas Marca B',
    (field) => {
      const record = research();
      expect(() =>
        acceptResearchEvidence(grounding(), {
          ...record,
          identity: { ...record.identity, [field]: 'Marca B / other product' },
        }),
      ).toThrow('IDENTITY_MISMATCH');
    },
  );

  it('allows an exact-identity official fact to support a literal claim; internal facts win conflicts', () => {
    const record = research();
    const evidence = acceptResearchEvidence(grounding(), record);
    expect(evidence.evidence.officialBrandFacts[0]!.usableInCopy).toBe(true);
    expect(evidence.evidence.officialBrandFacts[1]!.usableInCopy).toBe(false);
    const plan = groundedPlanSchema.parse({
      ...recommendation,
      campaignName: [{ fact: 'https://brand-a.example/product#claim-0' }],
    });
    expect(renderGroundedPlan(plan, evidence).campaignName).toBe(
      'Ingrediente documentado en fixture',
    );
    expect(() =>
      renderGroundedPlan(
        { ...plan, campaignName: [{ fact: 'https://brand-a.example/product#claim-1' }] },
        evidence,
      ),
    ).toThrow('INSUFFICIENT_EVIDENCE');
  });

  it('labels secondary sources and never promotes them to official product claims', () => {
    const evidence = acceptResearchEvidence(grounding(), research('SUPPORTED_SECONDARY'));
    expect(evidence.evidence.secondaryFacts[0]!.trust).toBe('SUPPORTED_SECONDARY');
    expect(evidence.evidence.officialBrandFacts).toEqual([]);
    const plan = groundedPlanSchema.parse({
      ...recommendation,
      campaignName: [{ fact: 'https://brand-a.example/product#claim-0' }],
    });
    expect(() => renderGroundedPlan(plan, evidence)).toThrow('INSUFFICIENT_EVIDENCE');
  });

  it.each([
    'internal:benefits',
    'internal:ingredients',
    'internal:inventory',
    'model:hidrata',
    'official:invented',
  ])('rejects unsupported fact %s instead of generating plausible claims', async (fact) => {
    const invokeProductTurn = vi
      .fn()
      .mockResolvedValue(turn(JSON.stringify({ ...recommendation, campaignName: [{ fact }] })));
    await expect(
      createEditorialIntelligence(
        { invokeProductTurn },
        async () => grounding(),
        researchGrounding,
      )(input),
    ).rejects.toThrow('INSUFFICIENT_EVIDENCE');
  });

  it.each([
    { campaignName: 'Hidrata profundamente y reduce manchas' },
    { campaignName: [{ editorial: 'hidrata profundamente' }] },
    { sources: [{ url: 'https://invented.example', trust: 'VERIFIED_OFFICIAL_BRAND' }] },
    { approved: true },
    { variants: [] },
    { productId: 'other' },
  ])('rejects free claims, invented provenance, or mismatched output %j', async (change) => {
    await expect(
      createEditorialIntelligence(
        {
          invokeProductTurn: vi
            .fn()
            .mockResolvedValue(turn(JSON.stringify({ ...recommendation, ...change }))),
        },
        async () => grounding(),
        researchGrounding,
      )(input),
    ).rejects.toThrow();
  });

  it('general editorial style is separated from product facts and unsupported hashtags are rejected', async () => {
    const result = await createEditorialIntelligence(
      { invokeProductTurn: vi.fn().mockResolvedValue(turn()) },
      async () => grounding(),
      researchGrounding,
    )(input);
    expect(result.evidence.editorialContext).toBe('GENERAL_EDITORIAL_CONTEXT');
    expect(result.evidence.internalFacts.some((fact) => fact.value.includes('inspir'))).toBe(false);
    const plan = groundedPlanSchema.parse(recommendation);
    plan.variants[0]!.hashtags = ['#AntiAcne'];
    expect(() => renderGroundedPlan(plan, grounding())).toThrow('INSUFFICIENT_EVIDENCE');
  });

  it('requires server-resolved product identity to match the independently read evidence', async () => {
    const response = turn();
    response.context.attributes.product = { ...detail, brandName: 'Marca B' };
    await expect(
      createEditorialIntelligence(
        { invokeProductTurn: vi.fn().mockResolvedValue(response) },
        async () => grounding(),
        researchGrounding,
      )(input),
    ).rejects.toThrow('IDENTITY_MISMATCH');
  });

  it('fails before model invocation if authoritative product reading fails', async () => {
    const invokeProductTurn = vi.fn();
    await expect(
      createEditorialIntelligence(
        { invokeProductTurn },
        async () => {
          throw new Error('read failed');
        },
        researchGrounding,
      )(input),
    ).rejects.toThrow('read failed');
    expect(invokeProductTurn).not.toHaveBeenCalled();
  });

  it.each(['PROVIDER_NOT_CONFIGURED', 'PERMISSION_DENIED', 'NO_RESULT'])(
    'reports %s with no simulated output',
    async (status) => {
      await expect(
        createEditorialIntelligence(
          { invokeProductTurn: vi.fn().mockResolvedValue({ status }) },
          async () => grounding(),
          researchGrounding,
        )(input),
      ).rejects.toBeInstanceOf(EditorialIntelligenceUnavailable);
    },
  );

  it('only calls ASSISTANT; explicit later saving preserves separate variants as drafts without schedules or attempts', async () => {
    const invoke = vi.fn().mockResolvedValue({
      error: null,
      data: {
        runtime: 'LIHEN_INTELLIGENCE',
        action: 'ASSISTANT',
        roleCode: 'OWNER',
        assistant: turn(),
      },
    });
    const result = await createEditorialIntelligence(
      createAssistantRuntimeInvoker({ functions: { invoke } }),
      async () => grounding(),
      researchGrounding,
    )(input);
    expect(invoke).toHaveBeenCalledOnce();
    expect(invoke.mock.calls[0]![0]).toBe('intelligence-runtime');
    expect(invoke.mock.calls[0]![1].body.action).toBe('ASSISTANT');
    const draft = {
      ...input.draft,
      channelVariants: Object.fromEntries(
        result.variants.map((variant) => [
          variant.channel,
          {
            copy: variant.copy,
            callToAction: variant.callToAction,
            hashtags: variant.hashtags.join(' '),
            creativeAssetIds: input.draft.channelVariants![variant.channel]!.creativeAssetIds,
          },
        ]),
      ),
    };
    let sequence = 0;
    const items = createEditorialDraft(draft, new Date(), () => `id-${++sequence}`);
    const save = vi
      .fn()
      .mockResolvedValue({ error: null, data: { data: {}, externalPublication: false } });
    for (const [index, item] of items.entries()) {
      expect(item.publication.status).toBe('PREPARED');
      expect(item.schedule).toBeNull();
      expect(item.attempts).toEqual([]);
      expect(item.productId).toBe(product.id);
      await saveEditorialItemToRuntime(item, { functions: { invoke: save } });
      expect(save.mock.calls[index]![1].body.action).toBe('SAVE_PREPARED_PUBLICATION');
      expect(save.mock.calls[index]![1].body.payload.callToAction).toBe(
        result.variants[index]!.callToAction,
      );
      expect(save.mock.calls[index]![1].body.payload.copy).toBe(result.variants[index]!.copy);
      expect(save.mock.calls[index]![1].body.payload.hashtags).toEqual(
        result.variants[index]!.hashtags.map((tag) => tag.slice(1)),
      );
    }
  });
});
