import { describe, expect, it } from 'vitest';
import {
  InMemoryMarketingSocialRepository,
  MarketingSocialEntityNotFoundError,
  MarketingSocialOperationKeyRequiredError,
  MarketingSocialPublicationNotApprovedError,
  MarketingSocialPublicationNotDueError,
  MarketingSocialPublicationScheduleRequiredError,
  MarketingSocialScheduleNotApprovedError,
  MarketingSocialWriteOperationConflictError,
  PrepareDuePublicationAttemptHandler,
} from '../src';

const operation = { operationKey: 'social-09-test' };

const schedule = (overrides = {}) => ({
  id: 'schedule-1',
  channelVariantId: 'variant-1',
  scheduledFor: new Date('2026-09-25T15:00:00.000Z'),
  timezone: 'America/Bogota',
  status: 'APPROVED' as const,
  createdAt: new Date('2026-09-25T13:00:00.000Z'),
  updatedAt: new Date('2026-09-25T14:00:00.000Z'),
  ...overrides,
});

const publication = (overrides = {}) => ({
  id: 'prepared-1',
  campaignId: 'campaign-1',
  campaignContentId: 'content-1',
  channelVariantId: 'variant-1',
  scheduleId: 'schedule-1',
  channel: 'INSTAGRAM_FEED' as const,
  copy: 'Prepared copy',
  callToAction: '',
  hashtags: [],
  creativeAssetIds: [],
  status: 'APPROVED' as const,
  preparedAt: new Date('2026-09-25T14:00:00.000Z'),
  ...overrides,
});

const command = (overrides = {}) => ({
  preparedPublicationId: 'prepared-1',
  attemptId: 'attempt-1',
  operationKey: 'social-09-attempt-1',
  now: new Date('2026-09-25T15:00:00.000Z'),
  ...overrides,
});

describe('Marketing social publication orchestration', () => {
  it('prepares only a PENDING attempt for an approved due publication', async () => {
    const repository = new InMemoryMarketingSocialRepository();

    await repository.saveContentSchedule(schedule(), operation);
    await repository.savePreparedPublication(publication(), operation);

    const handler =
      new PrepareDuePublicationAttemptHandler(repository);

    await expect(handler.execute(command())).resolves.toEqual({
      id: 'attempt-1',
      preparedPublicationId: 'prepared-1',
      attemptNumber: 1,
      status: 'PENDING',
      startedAt: null,
      completedAt: null,
      externalPublicationRef: null,
      failureCode: null,
    });
  });

  it('rejects a missing PreparedPublication', async () => {
    const handler =
      new PrepareDuePublicationAttemptHandler(
        new InMemoryMarketingSocialRepository(),
      );

    await expect(handler.execute(command()))
      .rejects.toBeInstanceOf(
        MarketingSocialEntityNotFoundError,
      );
  });

  it('rejects a publication that is not approved', async () => {
    const repository = new InMemoryMarketingSocialRepository();

    await repository.savePreparedPublication(
      publication({ status: 'IN_REVIEW' as const }),
      operation,
    );

    const handler =
      new PrepareDuePublicationAttemptHandler(repository);

    await expect(handler.execute(command()))
      .rejects.toBeInstanceOf(
        MarketingSocialPublicationNotApprovedError,
      );
  });

  it('requires a schedule', async () => {
    const repository = new InMemoryMarketingSocialRepository();

    await repository.savePreparedPublication(
      publication({ scheduleId: null }),
      operation,
    );

    const handler =
      new PrepareDuePublicationAttemptHandler(repository);

    await expect(handler.execute(command()))
      .rejects.toBeInstanceOf(
        MarketingSocialPublicationScheduleRequiredError,
      );
  });

  it('requires an approved schedule', async () => {
    const repository = new InMemoryMarketingSocialRepository();

    await repository.saveContentSchedule(
      schedule({ status: 'READY_FOR_REVIEW' as const }),
      operation,
    );
    await repository.savePreparedPublication(publication(), operation);

    const handler =
      new PrepareDuePublicationAttemptHandler(repository);

    await expect(handler.execute(command()))
      .rejects.toBeInstanceOf(
        MarketingSocialScheduleNotApprovedError,
      );
  });

  it('rejects a publication whose schedule is not due', async () => {
    const repository = new InMemoryMarketingSocialRepository();

    await repository.saveContentSchedule(schedule(), operation);
    await repository.savePreparedPublication(publication(), operation);

    const handler =
      new PrepareDuePublicationAttemptHandler(repository);

    await expect(
      handler.execute(
        command({
          now: new Date('2026-09-25T14:59:59.999Z'),
        }),
      ),
    ).rejects.toBeInstanceOf(
      MarketingSocialPublicationNotDueError,
    );
  });

  it('increments attempt numbers without creating execution state', async () => {
    const repository = new InMemoryMarketingSocialRepository();

    await repository.saveContentSchedule(schedule(), operation);
    await repository.savePreparedPublication(publication(), operation);

    const handler =
      new PrepareDuePublicationAttemptHandler(repository);

    const first = await handler.execute(command());

    const second = await handler.execute(
      command({
        attemptId: 'attempt-2',
        operationKey: 'social-09-attempt-2',
      }),
    );

    expect(first.attemptNumber).toBe(1);
    expect(second.attemptNumber).toBe(2);
    expect(second.status).toBe('PENDING');
    expect(second.startedAt).toBeNull();
    expect(second.completedAt).toBeNull();
    expect(second.externalPublicationRef).toBeNull();
  });

  it('rejects a blank operation key before persisting an attempt', async () => {
    const repository = new InMemoryMarketingSocialRepository();

    await repository.saveContentSchedule(schedule(), operation);
    await repository.savePreparedPublication(publication(), operation);

    const handler =
      new PrepareDuePublicationAttemptHandler(repository);

    await expect(
      handler.execute(
        command({
          operationKey: '   ',
        }),
      ),
    ).rejects.toBeInstanceOf(
      MarketingSocialOperationKeyRequiredError,
    );

    await expect(
      repository.listPublicationAttemptsByPreparedPublicationId(
        'prepared-1',
      ),
    ).resolves.toEqual([]);
  });

  it('replays the same operation without creating another attempt', async () => {
    const repository = new InMemoryMarketingSocialRepository();

    await repository.saveContentSchedule(schedule(), operation);
    await repository.savePreparedPublication(publication(), operation);

    const handler =
      new PrepareDuePublicationAttemptHandler(repository);

    const first = await handler.execute(command());
    const replay = await handler.execute(command());

    expect(replay).toEqual(first);

    await expect(
      repository.listPublicationAttemptsByPreparedPublicationId(
        'prepared-1',
      ),
    ).resolves.toEqual([first]);

    expect(first.attemptNumber).toBe(1);
    expect(replay.attemptNumber).toBe(1);
  });

  it('rejects reuse of an operation key for a different attempt request', async () => {
    const repository = new InMemoryMarketingSocialRepository();

    await repository.saveContentSchedule(schedule(), operation);
    await repository.savePreparedPublication(publication(), operation);

    const handler =
      new PrepareDuePublicationAttemptHandler(repository);

    await handler.execute(command());

    await expect(
      handler.execute(
        command({
          attemptId: 'attempt-2',
        }),
      ),
    ).rejects.toBeInstanceOf(
      MarketingSocialWriteOperationConflictError,
    );

    const attempts =
      await repository.listPublicationAttemptsByPreparedPublicationId(
        'prepared-1',
      );

    expect(attempts).toHaveLength(1);
    expect(attempts[0]?.id).toBe('attempt-1');
  });

});
