import { describe, expect, it, vi } from 'vitest';
import {
  MarketingSocialPersistenceUnavailableError,
  MarketingSocialWriteBlockedError,
  SupabaseMarketingSocialRepository,
} from '../src';
import type {
  ContentSchedule,
  PreparedPublication,
  PublicationAttempt,
} from '../src';

function contentSchedule(): ContentSchedule {
  return {
    id: 'schedule-1',
    channelVariantId: 'variant-1',
    scheduledFor: '2026-09-26T15:00:00-05:00',
    timezone: 'America/Bogota',
    status: 'APPROVED',
    createdAt: '2026-09-25T00:00:00-05:00',
    updatedAt: '2026-09-25T00:00:00-05:00',
  };
}

function preparedPublication(): PreparedPublication {
  return {
    id: 'publication-1',
    campaignId: 'campaign-1',
    campaignContentId: 'content-1',
    channelVariantId: 'variant-1',
    scheduleId: 'schedule-1',
    channel: 'INSTAGRAM_FEED',
    copy: 'Prepared copy',
    cta: null,
    hashtags: [],
    creativeAssetIds: [],
    status: 'APPROVED',
    preparedAt: '2026-09-25T00:00:00-05:00',
  };
}

function publicationAttempt(): PublicationAttempt {
  return {
    id: 'attempt-1',
    preparedPublicationId: 'publication-1',
    attemptNumber: 1,
    status: 'PENDING',
    startedAt: null,
    completedAt: null,
    externalPublicationRef: null,
    failureCode: null,
  };
}

describe('SupabaseMarketingSocialRepository safety boundary', () => {
  it('blocks all persistence writes while no governed Supabase write path exists', async () => {
    const from = vi.fn();
    const rpc = vi.fn();

    const repository = new SupabaseMarketingSocialRepository({
      from,
      rpc,
    } as never);

    await expect(
      repository.saveContentSchedule(contentSchedule()),
    ).rejects.toBeInstanceOf(MarketingSocialWriteBlockedError);

    await expect(
      repository.savePreparedPublication(preparedPublication()),
    ).rejects.toBeInstanceOf(MarketingSocialWriteBlockedError);

    await expect(
      repository.savePublicationAttempt(publicationAttempt()),
    ).rejects.toBeInstanceOf(MarketingSocialWriteBlockedError);

    expect(from).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('does not assume social table names before the database schema is authorized', async () => {
    const from = vi.fn();
    const rpc = vi.fn();

    const repository = new SupabaseMarketingSocialRepository({
      from,
      rpc,
    } as never);

    await expect(
      repository.getContentScheduleById('schedule-1'),
    ).rejects.toBeInstanceOf(MarketingSocialPersistenceUnavailableError);

    await expect(
      repository.listContentSchedulesByChannelVariantId('variant-1'),
    ).rejects.toBeInstanceOf(MarketingSocialPersistenceUnavailableError);

    await expect(
      repository.getPreparedPublicationById('publication-1'),
    ).rejects.toBeInstanceOf(MarketingSocialPersistenceUnavailableError);

    await expect(
      repository.listPreparedPublicationsByChannelVariantId('variant-1'),
    ).rejects.toBeInstanceOf(MarketingSocialPersistenceUnavailableError);

    await expect(
      repository.listPublicationAttemptsByPreparedPublicationId(
        'publication-1',
      ),
    ).rejects.toBeInstanceOf(MarketingSocialPersistenceUnavailableError);

    expect(from).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
});
