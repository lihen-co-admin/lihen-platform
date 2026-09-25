import { describe, expect, it } from 'vitest';

import type {
  ContentSchedule,
  PreparedPublication,
  PublicationAttempt,
} from '../src';

import {
  InMemoryMarketingSocialRepository,
} from '../src';

function makeSchedule(
  overrides: Partial<ContentSchedule> = {},
): ContentSchedule {
  return {
    id: 'schedule-1',
    channelVariantId: 'variant-instagram',
    scheduledFor: new Date('2026-09-28T15:00:00.000Z'),
    timezone: 'America/Bogota',
    status: 'APPROVED',
    createdAt: new Date('2026-09-24T20:00:00.000Z'),
    updatedAt: new Date('2026-09-24T20:00:00.000Z'),
    ...overrides,
  };
}

function makePreparedPublication(
  overrides: Partial<PreparedPublication> = {},
): PreparedPublication {
  return {
    id: 'prepared-1',
    campaignId: 'campaign-1',
    campaignContentId: 'content-1',
    channelVariantId: 'variant-instagram',
    scheduleId: 'schedule-1',
    channel: 'INSTAGRAM_FEED',
    copy: 'Contenido preparado',
    callToAction: 'Conoce más',
    hashtags: ['#LIHEN'],
    creativeAssetIds: ['asset-1'],
    status: 'APPROVED',
    preparedAt: new Date('2026-09-24T20:30:00.000Z'),
    ...overrides,
  };
}

function makeAttempt(
  overrides: Partial<PublicationAttempt> = {},
): PublicationAttempt {
  return {
    id: 'attempt-1',
    preparedPublicationId: 'prepared-1',
    attemptNumber: 1,
    status: 'PENDING',
    startedAt: null,
    completedAt: null,
    externalPublicationRef: null,
    failureCode: null,
    ...overrides,
  };
}

describe('InMemoryMarketingSocialRepository', () => {
  it('saves and retrieves a ContentSchedule by id', async () => {
    const repository =
      new InMemoryMarketingSocialRepository();

    const schedule = makeSchedule();

    await repository.saveContentSchedule(schedule, { operationKey: 'test-operation' });

    await expect(
      repository.getContentScheduleById(schedule.id),
    ).resolves.toEqual(schedule);
  });

  it('lists schedules only for the requested ChannelVariant', async () => {
    const repository =
      new InMemoryMarketingSocialRepository();

    const instagram = makeSchedule();

    const tiktok = makeSchedule({
      id: 'schedule-2',
      channelVariantId: 'variant-tiktok',
    });

    await repository.saveContentSchedule(instagram, { operationKey: 'test-operation' });
    await repository.saveContentSchedule(tiktok, { operationKey: 'test-operation' });

    await expect(
      repository.listContentSchedulesByChannelVariantId(
        'variant-instagram',
      ),
    ).resolves.toEqual([instagram]);
  });

  it('saves and retrieves a PreparedPublication by id', async () => {
    const repository =
      new InMemoryMarketingSocialRepository();

    const publication = makePreparedPublication();

    await repository.savePreparedPublication(publication, { operationKey: 'test-operation' });

    await expect(
      repository.getPreparedPublicationById(publication.id),
    ).resolves.toEqual(publication);
  });

  it('keeps prepared publications isolated by ChannelVariant', async () => {
    const repository =
      new InMemoryMarketingSocialRepository();

    const instagram = makePreparedPublication();

    const tiktok = makePreparedPublication({
      id: 'prepared-2',
      channelVariantId: 'variant-tiktok',
      channel: 'TIKTOK',
      scheduleId: null,
    });

    await repository.savePreparedPublication(instagram, { operationKey: 'test-operation' });
    await repository.savePreparedPublication(tiktok, { operationKey: 'test-operation' });

    await expect(
      repository.listPreparedPublicationsByChannelVariantId(
        'variant-instagram',
      ),
    ).resolves.toEqual([instagram]);

    await expect(
      repository.listPreparedPublicationsByChannelVariantId(
        'variant-tiktok',
      ),
    ).resolves.toEqual([tiktok]);
  });

  it('records attempts independently per PreparedPublication', async () => {
    const repository =
      new InMemoryMarketingSocialRepository();

    const instagramAttempt = makeAttempt();

    const tiktokAttempt = makeAttempt({
      id: 'attempt-2',
      preparedPublicationId: 'prepared-2',
      status: 'FAILED',
      failureCode: 'PROVIDER_FAILURE',
    });

    await repository.savePublicationAttempt(instagramAttempt);
    await repository.savePublicationAttempt(tiktokAttempt);

    await expect(
      repository.listPublicationAttemptsByPreparedPublicationId(
        'prepared-1',
      ),
    ).resolves.toEqual([instagramAttempt]);

    await expect(
      repository.listPublicationAttemptsByPreparedPublicationId(
        'prepared-2',
      ),
    ).resolves.toEqual([tiktokAttempt]);
  });

  it('orders attempts by attemptNumber for one PreparedPublication', async () => {
    const repository =
      new InMemoryMarketingSocialRepository();

    const second = makeAttempt({
      id: 'attempt-2',
      attemptNumber: 2,
      status: 'FAILED',
      failureCode: 'PROVIDER_FAILURE',
    });

    const first = makeAttempt({
      id: 'attempt-1',
      attemptNumber: 1,
    });

    await repository.savePublicationAttempt(second);
    await repository.savePublicationAttempt(first);

    await expect(
      repository.listPublicationAttemptsByPreparedPublicationId(
        'prepared-1',
      ),
    ).resolves.toEqual([first, second]);
  });

  it('updates a stored entity when the same id is saved again', async () => {
    const repository =
      new InMemoryMarketingSocialRepository();

    const draft = makeSchedule({
      status: 'DRAFT',
    });

    const approved = makeSchedule({
      status: 'APPROVED',
      updatedAt: new Date('2026-09-24T21:00:00.000Z'),
    });

    await repository.saveContentSchedule(draft, { operationKey: 'test-operation' });
    await repository.saveContentSchedule(approved, { operationKey: 'test-operation' });

    await expect(
      repository.getContentScheduleById(draft.id),
    ).resolves.toEqual(approved);
  });
});
