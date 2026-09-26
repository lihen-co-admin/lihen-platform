import { describe, expect, it } from 'vitest';
import {
  BlockedSocialPublishingAdapter,
  ExecutePublicationAttemptHandler,
  InMemoryMarketingSocialRepository,
  InMemorySocialPublishingAdapter,
  MarketingSocialExternalPublicationBlockedError,
  MarketingSocialPublicationAttemptNotPendingError,
} from '../src';
import type {
  ContentSchedule,
  PreparedPublication,
} from '../src';

function schedule(): ContentSchedule {
  return {
    id: 'schedule-1',
    channelVariantId: 'variant-1',
    scheduledFor: new Date('2026-09-26T15:00:00.000Z'),
    timezone: 'America/Bogota',
    status: 'APPROVED',
    createdAt: new Date('2026-09-25T14:00:00.000Z'),
    updatedAt: new Date('2026-09-25T14:30:00.000Z'),
  };
}

function publication(): PreparedPublication {
  return {
    id: 'publication-1',
    campaignId: 'campaign-1',
    campaignContentId: 'content-1',
    channelVariantId: 'variant-1',
    scheduleId: 'schedule-1',
    channel: 'INSTAGRAM_FEED',
    copy: 'Prepared copy',
    callToAction: 'Ver más',
    hashtags: ['lihen'],
    creativeAssetIds: ['asset-1'],
    status: 'APPROVED',
    preparedAt: new Date('2026-09-25T14:30:00.000Z'),
  };
}

async function seededRepository() {
  const repository =
    new InMemoryMarketingSocialRepository();

  await repository.saveContentSchedule(
    schedule(),
    { operationKey: 'seed-schedule' },
  );

  await repository.savePreparedPublication(
    publication(),
    { operationKey: 'seed-publication' },
  );

  await repository.createPendingPublicationAttempt(
    {
      id: 'attempt-1',
      preparedPublicationId: 'publication-1',
    },
    { operationKey: 'prepare-attempt' },
  );

  return repository;
}

function command() {
  return {
    preparedPublicationId: 'publication-1',
    attemptId: 'attempt-1',
    startOperationKey: 'execute-start-1',
    completionOperationKey: 'execute-complete-1',
  };
}

describe(
  'Marketing social publication execution boundary',
  () => {
    it(
      'publishes through the port and records success',
      async () => {
        const repository = await seededRepository();

        const publisher =
          new InMemorySocialPublishingAdapter({
            outcome: 'SUCCEEDED',
            externalPublicationRef: 'local-ref-1',
          });

        const handler =
          new ExecutePublicationAttemptHandler(
            repository,
            publisher,
          );

        const result =
          await handler.execute(command());

        expect(result.status).toBe('SUCCEEDED');
        expect(result.startedAt).toBeInstanceOf(Date);
        expect(result.completedAt).toBeInstanceOf(Date);
        expect(result.externalPublicationRef)
          .toBe('local-ref-1');
        expect(result.failureCode).toBeNull();

        expect(publisher.requests).toHaveLength(1);
        expect(publisher.requests[0]).toMatchObject({
          attemptId: 'attempt-1',
          preparedPublicationId: 'publication-1',
          channel: 'INSTAGRAM_FEED',
          copy: 'Prepared copy',
        });
      },
    );

    it(
      'records an explicit publisher failure',
      async () => {
        const repository = await seededRepository();

        const publisher =
          new InMemorySocialPublishingAdapter({
            outcome: 'FAILED',
            failureCode: 'LOCAL_PROVIDER_FAILURE',
          });

        const handler =
          new ExecutePublicationAttemptHandler(
            repository,
            publisher,
          );

        const result =
          await handler.execute(command());

        expect(result.status).toBe('FAILED');
        expect(result.externalPublicationRef).toBeNull();
        expect(result.failureCode)
          .toBe('LOCAL_PROVIDER_FAILURE');
      },
    );

    it(
      'blocks real execution and leaves uncertain state in progress',
      async () => {
        const repository = await seededRepository();

        const handler =
          new ExecutePublicationAttemptHandler(
            repository,
            new BlockedSocialPublishingAdapter(),
          );

        await expect(
          handler.execute(command()),
        ).rejects.toBeInstanceOf(
          MarketingSocialExternalPublicationBlockedError,
        );

        const attempts =
          await repository
            .listPublicationAttemptsByPreparedPublicationId(
              'publication-1',
            );

        expect(attempts).toHaveLength(1);
        expect(attempts[0]?.status)
          .toBe('IN_PROGRESS');
        expect(attempts[0]?.completedAt).toBeNull();
      },
    );

    it(
      'does not publish a completed attempt twice',
      async () => {
        const repository = await seededRepository();
        const publisher =
          new InMemorySocialPublishingAdapter();

        const handler =
          new ExecutePublicationAttemptHandler(
            repository,
            publisher,
          );

        await handler.execute(command());

        await expect(
          handler.execute(command()),
        ).rejects.toBeInstanceOf(
          MarketingSocialPublicationAttemptNotPendingError,
        );

        expect(publisher.requests).toHaveLength(1);
      },
    );

    it(
      'keeps persistence transitions idempotent',
      async () => {
        const repository = await seededRepository();

        const started =
          await repository.startPublicationAttempt(
            { id: 'attempt-1' },
            { operationKey: 'start-replay' },
          );

        const replayedStart =
          await repository.startPublicationAttempt(
            { id: 'attempt-1' },
            { operationKey: 'start-replay' },
          );

        expect(started.status).toBe('IN_PROGRESS');
        expect(replayedStart).toEqual(started);

        const completed =
          await repository.completePublicationAttempt(
            {
              id: 'attempt-1',
              outcome: 'SUCCEEDED',
              externalPublicationRef: 'local-ref',
            },
            { operationKey: 'complete-replay' },
          );

        const replayedCompletion =
          await repository.completePublicationAttempt(
            {
              id: 'attempt-1',
              outcome: 'SUCCEEDED',
              externalPublicationRef: 'local-ref',
            },
            { operationKey: 'complete-replay' },
          );

        expect(completed.status).toBe('SUCCEEDED');
        expect(replayedCompletion).toEqual(completed);
      },
    );
  },
);
