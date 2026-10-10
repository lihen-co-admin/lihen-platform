import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createEditorialDraft,
  editEditorialDraft,
  readEditorialWorkspace,
  resolveProductAssociationsFromMedia,
  saveEditorialItemInDev,
} from '../src/composition/editorial-workspace';
import type { EditorialItem } from '../src/domain/editorial-planning';

beforeEach(() => {
  vi.stubEnv('VITE_EDITORIAL_DEV_SYNC_ENABLED', 'true');
  vi.stubEnv('VITE_PRODUCT_READ_SOURCE', 'supabase');
  vi.stubEnv('VITE_SUPABASE_URL', 'https://vnmkupzptujtywnnabkp.supabase.co');
});
afterEach(() => vi.unstubAllEnvs());

function draft(copy: string, at: string, productId = '') {
  let id = 0;
  return createEditorialDraft(
    {
      copy,
      productId,
      channels: ['INSTAGRAM_FEED'],
      callToAction: '',
      hashtags: '',
      creativeAssetIds: productId ? ['rose-image'] : [],
      campaignName: '',
      date: '',
    },
    new Date(at),
    () => `${copy}-${++id}`,
  )[0]!;
}

const resolveProducts = (items: readonly EditorialItem[]) =>
  resolveProductAssociationsFromMedia(items, [{ id: 'BC-067' }], async () => [
    { id: 'rose-image' },
  ]);

function runtime(initial: EditorialItem) {
  const p = initial.publication;
  let row = {
    id: p.id,
    campaign_id: p.campaignId,
    campaign_content_id: p.campaignContentId,
    channel_variant_id: p.channelVariantId,
    schedule_id: null,
    channel: p.channel,
    copy: p.copy,
    cta: p.callToAction,
    hashtags: p.hashtags,
    creative_asset_ids: p.creativeAssetIds,
    status: p.status,
    prepared_at: p.preparedAt.toISOString(),
  };
  const operations = new Set<string>();
  const invoke = vi.fn(async (_name, { body: { action, payload } }) => {
    if (action === 'SAVE_PREPARED_PUBLICATION') {
      // Match DEV's RPC: repeat keys do not write and prepared_at never changes on update.
      if (!operations.has(payload.operationKey)) {
        row = {
          ...row,
          copy: payload.copy,
          cta: payload.callToAction,
          hashtags: payload.hashtags,
          creative_asset_ids: payload.creativeAssetIds,
          status: payload.status,
        };
        operations.add(payload.operationKey);
      }
      return { data: { data: [row], externalPublication: false }, error: null };
    }
    if (action !== 'READ_EDITORIAL_WORKSPACE') throw new Error(`Unexpected action: ${action}`);
    return {
      data: {
        data: { publications: [row], schedules: [], attempts: [] },
        externalPublication: false,
      },
      error: null,
    };
  });
  return { client: { functions: { invoke } }, invoke, operations };
}

describe('existing editorial draft save and readback', () => {
  it('edits twice, preserves preparedAt and recovers the product through durable media', async () => {
    const original = draft('Original', '2026-10-01T12:00:00Z');
    const { client, invoke, operations } = runtime(original);
    const [loaded] = await readEditorialWorkspace(client, original.publication.id);
    const edited = editEditorialDraft(
      loaded!,
      draft('Agua de rosas', '2026-10-09T12:00:00Z', 'BC-067'),
    );
    const confirmed = await saveEditorialItemInDev(edited, client, resolveProducts);
    expect(confirmed.publication.id).toBe(original.publication.id);
    expect(confirmed.publication.preparedAt).toEqual(original.publication.preparedAt);
    expect(confirmed.productId).toBe('BC-067');
    expect(confirmed.publication.copy).toBe('Agua de rosas');
    const second = editEditorialDraft(
      confirmed,
      draft('Copy corregido', '2026-10-10T12:00:00Z', 'BC-067'),
    );
    await saveEditorialItemInDev(second, client, resolveProducts);
    await saveEditorialItemInDev(second, client, resolveProducts);
    expect(operations.size).toBe(3);
    const [recovered] = await resolveProducts(
      await readEditorialWorkspace(client, original.publication.id),
    );
    expect(recovered?.productId).toBe('BC-067');
    expect(recovered?.publication.copy).toBe('Copy corregido');
    expect(recovered?.attempts).toEqual([]);
    const reverted = editEditorialDraft(
      recovered!,
      draft('Agua de rosas', '2026-10-11T12:00:00Z', 'BC-067'),
    );
    expect((await saveEditorialItemInDev(reverted, client, resolveProducts)).publication.copy).toBe(
      'Agua de rosas',
    );
    expect(operations.size).toBe(4);
    expect(
      invoke.mock.calls.every(([, request]) =>
        ['READ_EDITORIAL_WORKSPACE', 'SAVE_PREPARED_PUBLICATION'].includes(request.body.action),
      ),
    ).toBe(true);
  });

  it('rejects a product without durable media before writing instead of simulating success', async () => {
    const original = draft('Original', '2026-10-01T12:00:00Z');
    const { client, invoke } = runtime(original);
    const edited = { ...original, productId: 'BC-067' };
    await expect(saveEditorialItemInDev(edited, client, resolveProducts)).rejects.toThrow(
      'DEV no conserva el producto',
    );
    expect(invoke).not.toHaveBeenCalled();
  });

  it('does not claim product recovery when media resolution fails after the write', async () => {
    const item = draft('Original', '2026-10-01T12:00:00Z', 'BC-067');
    const { client } = runtime(item);
    const resolve = vi
      .fn()
      .mockImplementationOnce(resolveProducts)
      .mockImplementationOnce(async (items: EditorialItem[]) => items);
    await expect(saveEditorialItemInDev(item, client, resolve)).rejects.toThrow(
      'no se pudo recuperar su producto',
    );
  });

  it('edits and recovers a draft without a product', async () => {
    const original = draft('Original', '2026-10-01T12:00:00Z');
    const { client } = runtime(original);
    const edited = editEditorialDraft(original, draft('Actualizado', '2026-10-09T12:00:00Z'));
    expect((await saveEditorialItemInDev(edited, client)).publication.copy).toBe('Actualizado');
    expect((await readEditorialWorkspace(client))[0]?.publication.copy).toBe('Actualizado');
  });
});
