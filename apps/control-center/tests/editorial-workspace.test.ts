import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  createEditorialDraft,
  programEditorial,
  readEditorialWorkspace,
  readEditorialCache,
  resolveProductAssociationsFromMedia,
  saveEditorialItemToRuntime,
  reviewEditorial,
  saveEditorialDraftToRuntime,
  type EditorialDraft,
} from '../src/composition/editorial-workspace';
import {
  channelCapability,
  dayKey,
  editorialStatus,
  planEditorial,
  whatsappCapability,
} from '../src/domain/editorial-planning';

const now = new Date('2026-09-27T16:00:00Z');
const goals = { weekly: 5, priorityChannel: 'TIKTOK', priorityProduct: '', priorityCampaign: '' };
function draft(overrides: Partial<EditorialDraft> = {}) {
  let sequence = 0;
  return createEditorialDraft(
    {
      copy: 'Cuidado LIHEN',
      callToAction: 'Conoce más',
      hashtags: '#LIHENCO, #BeautyCare',
      creativeAssetIds: [],
      channels: ['INSTAGRAM_FEED'],
      productId: '',
      campaignName: 'Beauty',
      date: '2026-09-28T10:30',
      ...overrides,
    },
    now,
    () => `id-${++sequence}`,
  )[0]!;
}
describe('editorial workspace governance', () => {
  it('creates DRAFT/PREPARED without PublicationAttempt or approval', () => {
    const item = draft();
    expect(item.schedule?.status).toBe('DRAFT');
    expect(item.publication.status).toBe('PREPARED');
    expect(item.attempts).toEqual([]);
    expect(item.publication.hashtags).toEqual(['LIHENCO', 'BeautyCare']);
  });
  it('supports an unscheduled draft without inventing a schedule date', () => {
    const item = draft({ date: '' });
    expect(item.schedule).toBeNull();
    expect(item.publication.scheduleId).toBeNull();
    expect(planEditorial([item], goals, now).unscheduled).toHaveLength(1);
  });
  it('creates channel variants with independent copy, CTA, hashtags and media on shared content', () => {
    let sequence = 0;
    const variants = createEditorialDraft(
      {
        copy: 'Shared starting copy',
        callToAction: 'Shared CTA',
        hashtags: '#Shared',
        creativeAssetIds: ['shared-image'],
        channels: ['INSTAGRAM_FEED', 'FACEBOOK'],
        channelVariants: {
          INSTAGRAM_FEED: {
            copy: 'Instagram story',
            callToAction: 'Guárdalo',
            hashtags: '#Instagram #LIHENCO',
            creativeAssetIds: ['instagram-image'],
          },
          FACEBOOK: {
            copy: 'Facebook post',
            callToAction: 'Conoce la colección',
            hashtags: '#Facebook',
            creativeAssetIds: ['facebook-image'],
          },
        },
        productId: 'product-1',
        campaignName: 'Cuidado diario',
        date: '',
      },
      now,
      () => `variant-${++sequence}`,
    );
    expect(variants).toHaveLength(2);
    expect(variants[0]?.publication.copy).toBe('Instagram story');
    expect(variants[0]?.publication.callToAction).toBe('Guárdalo');
    expect(variants[0]?.publication.hashtags).toEqual(['Instagram', 'LIHENCO']);
    expect(variants[0]?.publication.creativeAssetIds).toEqual(['instagram-image']);
    expect(variants[1]?.publication.copy).toBe('Facebook post');
    expect(variants[1]?.publication.creativeAssetIds).toEqual(['facebook-image']);
    expect(variants[0]?.publication.campaignContentId).toBe(
      variants[1]?.publication.campaignContentId,
    );
    expect(variants[0]?.publication.channelVariantId).not.toBe(
      variants[1]?.publication.channelVariantId,
    );
    expect(variants.every((item) => item.publication.status === 'PREPARED')).toBe(true);
    expect(variants.every((item) => item.attempts.length === 0)).toBe(true);
  });
  it('requires copy on every selected channel variant before saving', () => {
    expect(() =>
      createEditorialDraft(
        {
          copy: '',
          callToAction: '',
          hashtags: '',
          creativeAssetIds: [],
          channels: ['INSTAGRAM_FEED', 'FACEBOOK'],
          channelVariants: {
            INSTAGRAM_FEED: {
              copy: 'Instagram draft',
              callToAction: '',
              hashtags: '',
              creativeAssetIds: [],
            },
          },
          productId: '',
          campaignName: '',
          date: '',
        },
        now,
        () => 'unused',
      ),
    ).toThrow('cada variante');
  });
  it('requires human review before approval and a separate programming decision', async () => {
    const item = draft();
    await expect(reviewEditorial(item, 'APPROVE', now)).rejects.toThrow();
    await expect(
      programEditorial(item, '2026-09-29T15:00', now, () => 'schedule'),
    ).rejects.toThrow();
    const reviewed = await reviewEditorial(item, 'SUBMIT_FOR_REVIEW', now);
    const approved = await reviewEditorial(reviewed, 'APPROVE', now);
    expect(approved.publication.status).toBe('APPROVED');
    expect(approved.schedule?.status).toBe('READY_FOR_REVIEW');
    expect(editorialStatus(approved)).toBe('Aprobado · sin programar');
    const scheduled = await programEditorial(approved, '2026-09-29T15:00', now, () => 'operation');
    expect(scheduled.schedule?.status).toBe('APPROVED');
    expect(scheduled.attempts).toEqual([]);
    expect(scheduled.schedule?.scheduledFor.toISOString()).toBe('2026-09-29T20:00:00.000Z');
  });
  it('does not schedule in the past', async () => {
    const item = await reviewEditorial(
      await reviewEditorial(draft(), 'SUBMIT_FOR_REVIEW', now),
      'APPROVE',
      now,
    );
    await expect(programEditorial(item, '2026-09-26T10:00', now, () => 'id')).rejects.toThrow(
      'futura',
    );
  });
  it('calculates deterministic recommendations and gaps without mutation or approval', () => {
    const item = draft();
    const before = JSON.stringify(item);
    const first = planEditorial([item], goals, now);
    expect(first).toEqual(planEditorial([item], goals, now));
    expect(first.gaps).toHaveLength(6);
    expect(first.scheduled).toHaveLength(0);
    expect(first.recommendations.join(' ')).toContain('TikTok');
    expect(JSON.stringify(item)).toBe(before);
    expect(item.publication.status).toBe('PREPARED');
  });
  it('preserves channel, date, timezone and state on reload', () => {
    const item = draft({ channels: ['TIKTOK'] });
    const [restored] = readEditorialCache({ getItem: () => JSON.stringify([item]) }, 'test');
    expect(restored).toEqual(item);
    expect(restored?.schedule?.scheduledFor.toISOString()).toBe('2026-09-28T15:30:00.000Z');
    expect(restored?.schedule?.timezone).toBe('America/Bogota');
    expect(restored?.publication.channel).toBe('TIKTOK');
  });
  it('uses Bogotá dates across UTC midnight', () => {
    expect(dayKey(new Date('2026-09-28T02:00:00Z'))).toBe('2026-09-27');
    expect(planEditorial([], goals, now).gaps).toHaveLength(7);
  });
  it('keeps TikTok external integration pending and WhatsApp send blocked', () => {
    expect(channelCapability('TIKTOK').runtimeSupported).toBe(false);
    expect(channelCapability('INSTAGRAM_REEL').runtimeSupported).toBe(true);
    expect(channelCapability('TIKTOK').externalPublicationEnabled).toBe(false);
    expect(whatsappCapability.sendingEnabled).toBe(false);
    expect(channelCapability('WHATSAPP').status).toBe('ENVÍO BLOQUEADO');
  });
  it('reflects the real governed Meta runtime allowlist without claiming activation', () => {
    const runtime = readFileSync(
      resolve('supabase/functions/marketing-social-runtime/index.ts'),
      'utf8',
    );
    expect(runtime).toContain("['FACEBOOK', 'INSTAGRAM_FEED', 'INSTAGRAM_STORY', 'INSTAGRAM_REEL']");
    for (const channel of ['FACEBOOK', 'INSTAGRAM_FEED', 'INSTAGRAM_STORY', 'INSTAGRAM_REEL']) {
      expect(channelCapability(channel).runtimeSupported).toBe(true);
      expect(channelCapability(channel).externalPublicationEnabled).toBe(false);
    }
  });
  it('saving a draft only calls the two existing SAVE actions', async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: { data: { id: 'saved' }, externalPublication: false },
      error: null,
    });
    await saveEditorialDraftToRuntime(draft(), { functions: { invoke } });
    expect(invoke.mock.calls.map((call) => call[1].body.action)).toEqual([
      'SAVE_CONTENT_SCHEDULE',
      'SAVE_PREPARED_PUBLICATION',
    ]);
    expect(invoke.mock.calls[0]![1].body.payload.status).toBe('DRAFT');
    expect(invoke.mock.calls[1]![1].body.payload.status).toBe('PREPARED');
  });
  it('writes DRAFT through the durable port without creating PublicationAttempt', async () => {
    const invoke = vi.fn().mockImplementation((_name, request) =>
      Promise.resolve({
        data: { data: { id: request.body.payload.id }, externalPublication: false },
        error: null,
      }),
    );
    const item = draft();
    const saved = await saveEditorialItemToRuntime(item, { functions: { invoke } });
    expect(saved.publication.status).toBe('PREPARED');
    expect(saved.schedule?.status).toBe('DRAFT');
    expect(saved.attempts).toEqual([]);
    expect(invoke.mock.calls.map((call) => call[1].body.action)).toEqual([
      'SAVE_CONTENT_SCHEDULE',
      'SAVE_PREPARED_PUBLICATION',
    ]);
  });
  it('rebuilds the calendar from rows returned by the shared runtime', async () => {
    const rows = {
      schedules: [
        {
          id: 'schedule',
          channel_variant_id: 'variant',
          scheduled_for: '2026-09-28T15:30:00Z',
          timezone: 'America/Bogota',
          status: 'APPROVED',
          created_at: '2026-09-27T16:00:00Z',
          updated_at: '2026-09-27T16:00:00Z',
        },
      ],
      publications: [
        {
          id: 'publication',
          campaign_id: 'campaign',
          campaign_content_id: 'content',
          channel_variant_id: 'variant',
          schedule_id: 'schedule',
          channel: 'TIKTOK',
          copy: 'TikTok editorial',
          cta: null,
          hashtags: ['LIHENCO'],
          creative_asset_ids: [],
          status: 'APPROVED',
          prepared_at: '2026-09-27T16:00:00Z',
        },
      ],
      attempts: [],
    };
    const invoke = vi
      .fn()
      .mockResolvedValue({ data: { data: rows, externalPublication: false }, error: null });
    const [item] = await readEditorialWorkspace({ functions: { invoke } });
    expect(item?.publication.channel).toBe('TIKTOK');
    expect(item?.schedule?.scheduledFor.toISOString()).toBe('2026-09-28T15:30:00.000Z');
    expect(item?.schedule?.status).toBe('APPROVED');
    expect(item?.attempts).toEqual([]);
    expect(invoke.mock.calls[0]?.[1].body.action).toBe('READ_EDITORIAL_WORKSPACE');
  });
  it('resolves product links only from media IDs belonging to real catalog products', async () => {
    const base = draft();
    const item = { ...base, publication: { ...base.publication, creativeAssetIds: ['asset-b'] } };
    const readImages = vi.fn(async (productId: string) =>
      productId === 'product-b' ? [{ id: 'asset-b' }] : [{ id: 'asset-a' }],
    );
    const [linked] = await resolveProductAssociationsFromMedia(
      [item],
      [{ id: 'product-a' }, { id: 'product-b' }],
      readImages,
    );
    expect(linked?.productId).toBe('product-b');
    expect(readImages).toHaveBeenCalledTimes(2);
  });
  it('does not use a demo catalog or browser cache as the operational workspace source', () => {
    const page = readFileSync(
      resolve('apps/control-center/src/pages/SocialContentPage.tsx'),
      'utf8',
    );
    expect(page).toContain('readEditorialWorkspace');
    expect(page).toContain("productsComposition.source === 'supabase'");
    expect(page).not.toContain('readEditorialCache');
    expect(page).not.toMatch(/Producto demo Beauty Care|Producto demo Style/);
  });
  it('fails closed on partial remote save and does not advance to a publication', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: null, error: { message: 'Write blocked' } });
    await expect(saveEditorialDraftToRuntime(draft(), { functions: { invoke } })).rejects.toThrow(
      'Write blocked',
    );
    expect(invoke).toHaveBeenCalledTimes(1);
  });
  it('does not synchronize locally approved content or conversation channels', async () => {
    const invoke = vi.fn();
    const item = draft();
    await expect(
      saveEditorialDraftToRuntime(
        { ...item, publication: { ...item.publication, status: 'APPROVED' } },
        { functions: { invoke } },
      ),
    ).rejects.toThrow();
    await expect(
      saveEditorialDraftToRuntime(
        { ...item, publication: { ...item.publication, channel: 'WHATSAPP_DIRECT' } },
        { functions: { invoke } },
      ),
    ).rejects.toThrow();
    expect(invoke).not.toHaveBeenCalled();
  });
  it('excludes cancelled content from workload and recommendations', async () => {
    const cancelled = await reviewEditorial(draft(), 'CANCEL', now);
    expect(editorialStatus(cancelled)).toBe('Cancelado');
    expect(planEditorial([cancelled], goals, now).gaps).toHaveLength(7);
  });
  it('ordinary workspace exposes no real-publication test or execution path', () => {
    for (const file of [
      'pages/SocialContentPage.tsx',
      'composition/editorial-workspace.ts',
      'components/EditorialComposer.tsx',
      'pages/ConversationsPage.tsx',
    ]) {
      const source = readFileSync(resolve('apps/control-center/src', file), 'utf8');
      expect(source).not.toMatch(
        /executeControlledSocialPublicationInDev|EXECUTE_PUBLICATION_ATTEMPT|CREATE_PUBLICATION_ATTEMPT|PUBLICAR PRUEBA REAL/,
      );
    }
  });
  it('guards shared read in the authenticated runtime and introduces no local RLS policy', () => {
    const runtime = readFileSync(
      resolve('supabase/functions/marketing-social-runtime/index.ts'),
      'utf8',
    );
    expect(runtime.indexOf("!['OWNER', 'ADMIN'].includes(profile.role_code)")).toBeLessThan(
      runtime.indexOf("action === 'READ_EDITORIAL_WORKSPACE'"),
    );
    expect(runtime).toContain("action === 'READ_EDITORIAL_WORKSPACE'");
    const page = readFileSync(
      resolve('apps/control-center/src/pages/SocialContentPage.tsx'),
      'utf8',
    );
    expect(page).not.toMatch(
      /executeControlledSocialPublicationInDev|CREATE_PUBLICATION_ATTEMPT|EXECUTE_PUBLICATION_ATTEMPT/,
    );
  });
  it('keeps the shared editorial runtime action read-only and limited to editorial fields', () => {
    const runtime = readFileSync(
      resolve('supabase/functions/marketing-social-runtime/index.ts'),
      'utf8',
    );
    const readStart = runtime.indexOf("if (action === 'READ_EDITORIAL_WORKSPACE')");
    const readEnd = runtime.indexOf("} else if (action === 'SAVE_CONTENT_SCHEDULE')", readStart);
    const readBranch = runtime.slice(readStart, readEnd);

    expect(readStart).toBeGreaterThan(-1);
    expect(readEnd).toBeGreaterThan(readStart);
    expect(readBranch).toContain(".from('marketing_content_schedules')");
    expect(readBranch).toContain(".from('marketing_prepared_publications')");
    expect(readBranch).toContain(".from('marketing_publication_attempts')");
    expect(readBranch).not.toContain(".select('*')");
    expect(readBranch).not.toMatch(
      /\.rpc\(|CREATE_PUBLICATION_ATTEMPT|EXECUTE_PUBLICATION_ATTEMPT|metaPublicationEnabled/,
    );
  });
});
