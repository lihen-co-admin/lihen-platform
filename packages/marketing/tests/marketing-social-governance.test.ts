import { describe, expect, it } from 'vitest';
import {
  InMemoryMarketingSocialRepository,
  MarketingSocialEntityNotFoundError,
  MarketingSocialInvalidTransitionError,
  ReviewContentScheduleHandler,
  ReviewPreparedPublicationHandler,
  type ContentSchedule,
  type PreparedPublication,
} from '../src';

const makeSchedule = (
  status: ContentSchedule['status'] = 'DRAFT',
): ContentSchedule => ({
  id: 'schedule-1',
  channelVariantId: 'variant-1',
  scheduledFor: new Date('2026-09-28T14:00:00.000Z'),
  timezone: 'America/Bogota',
  status,
  createdAt: new Date('2026-09-25T00:00:00.000Z'),
  updatedAt: new Date('2026-09-25T00:00:00.000Z'),
});

const makePublication = (
  status: PreparedPublication['status'] = 'PREPARED',
): PreparedPublication => ({
  id: 'publication-1',
  campaignId: 'campaign-1',
  campaignContentId: 'content-1',
  channelVariantId: 'variant-1',
  scheduleId: 'schedule-1',
  channel: 'INSTAGRAM_FEED',
  copy: 'Prepared copy',
  callToAction: 'Discover more',
  hashtags: ['LIHEN'],
  creativeAssetIds: ['asset-1'],
  status,
  preparedAt: new Date('2026-09-25T00:00:00.000Z'),
});

describe('Marketing social human review governance', () => {
  it('moves a content schedule through human review to approval', async () => {
    const repository = new InMemoryMarketingSocialRepository();
    await repository.saveContentSchedule(makeSchedule());

    const handler = new ReviewContentScheduleHandler(repository);

    const review = await handler.execute({
      scheduleId: 'schedule-1',
      decision: 'SUBMIT_FOR_REVIEW',
    });

    expect(review.status).toBe('READY_FOR_REVIEW');

    const approved = await handler.execute({
      scheduleId: 'schedule-1',
      decision: 'APPROVE',
    });

    expect(approved.status).toBe('APPROVED');
  });

  it('allows cancelling a schedule before approval', async () => {
    const repository = new InMemoryMarketingSocialRepository();
    await repository.saveContentSchedule(
      makeSchedule('READY_FOR_REVIEW'),
    );

    const result = await new ReviewContentScheduleHandler(
      repository,
    ).execute({
      scheduleId: 'schedule-1',
      decision: 'CANCEL',
    });

    expect(result.status).toBe('CANCELLED');
  });

  it('rejects an invalid content schedule transition', async () => {
    const repository = new InMemoryMarketingSocialRepository();
    await repository.saveContentSchedule(makeSchedule());

    await expect(
      new ReviewContentScheduleHandler(repository).execute({
        scheduleId: 'schedule-1',
        decision: 'APPROVE',
      }),
    ).rejects.toBeInstanceOf(MarketingSocialInvalidTransitionError);
  });

  it('moves a prepared publication through human review to approval', async () => {
    const repository = new InMemoryMarketingSocialRepository();
    await repository.savePreparedPublication(makePublication());

    const handler = new ReviewPreparedPublicationHandler(repository);

    const review = await handler.execute({
      preparedPublicationId: 'publication-1',
      decision: 'SUBMIT_FOR_REVIEW',
    });

    expect(review.status).toBe('IN_REVIEW');

    const approved = await handler.execute({
      preparedPublicationId: 'publication-1',
      decision: 'APPROVE',
    });

    expect(approved.status).toBe('APPROVED');
  });

  it('allows cancelling a prepared publication before approval', async () => {
    const repository = new InMemoryMarketingSocialRepository();
    await repository.savePreparedPublication(
      makePublication('IN_REVIEW'),
    );

    const result = await new ReviewPreparedPublicationHandler(
      repository,
    ).execute({
      preparedPublicationId: 'publication-1',
      decision: 'CANCEL',
    });

    expect(result.status).toBe('CANCELLED');
  });

  it('rejects an invalid prepared publication transition', async () => {
    const repository = new InMemoryMarketingSocialRepository();
    await repository.savePreparedPublication(makePublication());

    await expect(
      new ReviewPreparedPublicationHandler(repository).execute({
        preparedPublicationId: 'publication-1',
        decision: 'APPROVE',
      }),
    ).rejects.toBeInstanceOf(MarketingSocialInvalidTransitionError);
  });

  it('fails explicitly when the governed entity does not exist', async () => {
    const repository = new InMemoryMarketingSocialRepository();

    await expect(
      new ReviewContentScheduleHandler(repository).execute({
        scheduleId: 'missing',
        decision: 'SUBMIT_FOR_REVIEW',
      }),
    ).rejects.toBeInstanceOf(MarketingSocialEntityNotFoundError);

    await expect(
      new ReviewPreparedPublicationHandler(repository).execute({
        preparedPublicationId: 'missing',
        decision: 'SUBMIT_FOR_REVIEW',
      }),
    ).rejects.toBeInstanceOf(MarketingSocialEntityNotFoundError);
  });

  it('approval does not create publication attempts', async () => {
    const repository = new InMemoryMarketingSocialRepository();
    await repository.savePreparedPublication(
      makePublication('IN_REVIEW'),
    );

    await new ReviewPreparedPublicationHandler(repository).execute({
      preparedPublicationId: 'publication-1',
      decision: 'APPROVE',
    });

    expect(
      await repository.listPublicationAttemptsByPreparedPublicationId(
        'publication-1',
      ),
    ).toEqual([]);
  });
});
