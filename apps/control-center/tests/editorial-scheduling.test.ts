import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
beforeEach(() => { vi.stubEnv('DEV', true); vi.stubEnv('VITE_EDITORIAL_DEV_SYNC_ENABLED', 'true'); });
afterEach(() => vi.unstubAllEnvs());
import { EditorialScheduling } from '../src/components/EditorialScheduling';
import { EditorialAgenda } from '../src/components/EditorialAgenda';
import {
  createEditorialDraft,
  parseEditorialDate,
  programEditorial,
  reviewEditorial,
  saveEditorialItemInDev,
} from '../src/composition/editorial-workspace';
import { isEditorialScheduled, type EditorialItem } from '../src/domain/editorial-planning';

const now = new Date('2026-09-29T16:00:00Z');
function draft() {
  let sequence = 0;
  return createEditorialDraft(
    {
      copy: 'Copy',
      callToAction: 'Conoce',
      hashtags: '#LIHEN',
      creativeAssetIds: ['durable-media'],
      channels: ['TIKTOK'],
      productId: 'product',
      campaignName: '',
      date: '2026-09-30T10:30',
    },
    now,
    () => String(++sequence),
  )[0]!;
}
async function scheduled() {
  const reviewed = await reviewEditorial(draft(), 'SUBMIT_FOR_REVIEW', now);
  const approved = await reviewEditorial(reviewed, 'APPROVE', now);
  return programEditorial(approved, '2026-09-30T23:30', now, () => 'schedule-operation');
}
function rows(item: EditorialItem) {
  const p = item.publication,
    s = item.schedule!;
  return {
    publications: [
      {
        id: p.id,
        campaign_id: p.campaignId,
        campaign_content_id: p.campaignContentId,
        channel_variant_id: p.channelVariantId,
        schedule_id: p.scheduleId,
        channel: p.channel,
        copy: p.copy,
        cta: p.callToAction,
        hashtags: p.hashtags,
        creative_asset_ids: p.creativeAssetIds,
        status: p.status,
        prepared_at: p.preparedAt.toISOString(),
      },
    ],
    schedules: [
      {
        id: s.id,
        channel_variant_id: s.channelVariantId,
        scheduled_for: s.scheduledFor.toISOString(),
        timezone: s.timezone,
        status: s.status,
        created_at: s.createdAt.toISOString(),
        updated_at: s.updatedAt.toISOString(),
      },
    ],
    attempts: [],
  };
}
function markup(item: EditorialItem) {
  return renderToStaticMarkup(
    createElement(EditorialScheduling, {
      item,
      now,
      disabled: false,
      onSchedule: vi.fn(),
      productName: 'Beauty',
    }),
  );
}
describe('editorial scheduling UX', () => {
  it.each(['product', 'media'])('blocks incomplete approved content: %s', async (missing) => {
    const item = await reviewEditorial(
      await reviewEditorial(draft(), 'SUBMIT_FOR_REVIEW', now),
      'APPROVE',
      now,
    );
    if (missing === 'product') item.productId = '';
    else item.publication = { ...item.publication, creativeAssetIds: [] };
    expect(markup(item)).toMatch(/<fieldset[^>]*disabled/);
    expect(markup(item)).toContain('cancélala y crea un borrador completo');
  });
  it('does not confirm a save if the subsequent read fails', async () => {
    const invoke = vi
      .fn()
      .mockResolvedValueOnce({
        data: { data: { id: 'schedule' }, externalPublication: false },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { data: { id: 'publication' }, externalPublication: false },
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: { message: 'Read unavailable' } });
    await expect(
      saveEditorialItemInDev(await scheduled(), { functions: { invoke } }),
    ).rejects.toThrow('Read unavailable');
    expect(invoke).toHaveBeenCalledTimes(3);
  });
  it('keeps draft dates proposed and content approval separate from programming', async () => {
    expect(markup(draft())).toContain('fecha propuesta; no confirmada');
    expect(markup(draft())).not.toContain('<fieldset');
    const approved = await reviewEditorial(
      await reviewEditorial(draft(), 'SUBMIT_FOR_REVIEW', now),
      'APPROVE',
      now,
    );
    expect(isEditorialScheduled(approved)).toBe(false);
    expect(markup(approved)).toContain('Sin programación confirmada');
    expect(markup(approved)).toContain('Solo autorizo la programación editorial');
    expect(markup(approved)).toMatch(/<button[^>]*disabled/);
  });
  it('shows channel/product/media/APPROVED/Bogota with execution disabled', async () => {
    const item = await scheduled();
    expect(item.attempts).toEqual([]);
    expect(item.schedule?.scheduledFor.toISOString()).toBe('2026-10-01T04:30:00.000Z');
    const html = markup(item);
    for (const text of [
      'TikTok',
      'Beauty',
      'durable-media',
      'Programado editorialmente',
      'APPROVED',
      'America/Bogota',
      '23:30',
      'automática continúa desactivada',
    ])
      expect(html).toContain(text);
    expect(html).not.toContain('<button');
  });
  it('does not label mismatched schedule linkage as programmed', async () => {
    const item = await scheduled();
    expect(
      isEditorialScheduled({ ...item, publication: { ...item.publication, scheduleId: 'wrong' } }),
    ).toBe(false);
  });
  it('labels proposed dates distinctly in the agenda', () => {
    const html = renderToStaticMarkup(
      createElement(EditorialAgenda, { items: [draft()], days: ['2026-09-30'], onOpen: vi.fn() }),
    );
    expect(html).toContain('Fecha propuesta; no confirmada');
    expect(html).toContain('10:30');
  });
  it.each(['2026-02-30T12:00', '2026-09-30T25:00', '2026-09-30', '2026-09-30T12:00Z'])(
    'rejects invalid local date %s',
    (value) => {
      expect(() => parseEditorialDate(value)).toThrow();
    },
  );
  it('rejects past scheduling and unapproved content', async () => {
    await expect(programEditorial(draft(), '2026-09-30T10:00', now, () => 'id')).rejects.toThrow(
      'Aprueba',
    );
    await expect(
      programEditorial(await scheduled(), '2026-09-28T10:00', now, () => 'id'),
    ).rejects.toThrow('futura');
  });
  it('reads durable state after writes, without attempts or provider actions', async () => {
    const item = await scheduled();
    const invoke = vi.fn().mockImplementation((_name, request) =>
      Promise.resolve({
        data: {
          data:
            request.body.action === 'READ_EDITORIAL_WORKSPACE'
              ? rows(item)
              : { id: request.body.payload.id },
          externalPublication: false,
        },
        error: null,
      }),
    );
    const confirmed = await saveEditorialItemInDev(item, { functions: { invoke } });
    expect(confirmed).not.toBe(item);
    expect(isEditorialScheduled(confirmed)).toBe(true);
    expect(invoke.mock.calls.map((call) => call[1].body.action)).toEqual([
      'SAVE_CONTENT_SCHEDULE',
      'SAVE_PREPARED_PUBLICATION',
      'READ_EDITORIAL_WORKSPACE',
    ]);
    expect(confirmed.attempts).toEqual([]);
  });
  it.each(['approval', 'date', 'media', 'missing'])(
    'rejects durable readback mismatch: %s',
    async (mismatch) => {
      const item = await scheduled(),
        data = rows(item);
      if (mismatch === 'approval') data.publications[0]!.status = 'IN_REVIEW';
      if (mismatch === 'date') data.schedules[0]!.scheduled_for = now.toISOString();
      if (mismatch === 'media') data.publications[0]!.creative_asset_ids = ['other'];
      if (mismatch === 'missing') data.publications = [];
      const invoke = vi.fn().mockImplementation((_name, request) =>
        Promise.resolve({
          data: {
            data:
              request.body.action === 'READ_EDITORIAL_WORKSPACE'
                ? data
                : { id: item.publication.id },
            externalPublication: false,
          },
          error: null,
        }),
      );
      await expect(saveEditorialItemInDev(item, { functions: { invoke } })).rejects.toThrow(
        'DEV no confirmó',
      );
    },
  );
  it('does not retry or report success after a failed persistence call', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: null, error: { message: 'DEV unavailable' } });
    await expect(
      saveEditorialItemInDev(await scheduled(), { functions: { invoke } }),
    ).rejects.toThrow('DEV unavailable');
    expect(invoke).toHaveBeenCalledTimes(1);
  });
});
