import { describe, expect, it } from 'vitest';

import {
  AssessPublicationReconciliationHandler,
  InMemoryMarketingSocialRepository,
  assessPublicationReconciliation,
  type PublicationAttempt,
} from '../src';

function attempt(
  overrides: Partial<PublicationAttempt> = {},
): PublicationAttempt {
  return {
    id: 'attempt-1',
    preparedPublicationId: 'publication-1',
    attemptNumber: 1,
    status: 'IN_PROGRESS',
    startedAt: new Date('2026-09-26T15:00:00.000Z'),
    completedAt: null,
    externalPublicationRef: null,
    failureCode: null,
    ...overrides,
  };
}

describe('Marketing social publication reconciliation', () => {
  it('flags only an unresolved in-progress attempt outside the uncertainty window', () => {
    const result = assessPublicationReconciliation({
      attempt: attempt(),
      now: new Date('2026-09-26T15:10:00.000Z'),
      uncertaintyWindowMs: 5 * 60 * 1000,
    });

    expect(result.requiresReconciliation).toBe(true);
    expect(result.reason)
      .toBe('IN_PROGRESS_OUTSIDE_UNCERTAINTY_WINDOW');
    expect(result.ageMs).toBe(10 * 60 * 1000);
  });

  it('does not flag an in-progress attempt still inside the uncertainty window', () => {
    const result = assessPublicationReconciliation({
      attempt: attempt(),
      now: new Date('2026-09-26T15:02:00.000Z'),
      uncertaintyWindowMs: 5 * 60 * 1000,
    });

    expect(result.requiresReconciliation).toBe(false);
    expect(result.reason).toBe('WITHIN_UNCERTAINTY_WINDOW');
  });

  it('does not reinterpret terminal attempts as requiring reconciliation', () => {
    const result = assessPublicationReconciliation({
      attempt: attempt({
        status: 'SUCCEEDED',
        completedAt: new Date('2026-09-26T15:01:00.000Z'),
        externalPublicationRef: 'external-ref',
      }),
      now: new Date('2026-09-26T16:00:00.000Z'),
      uncertaintyWindowMs: 5 * 60 * 1000,
    });

    expect(result.requiresReconciliation).toBe(false);
    expect(result.reason).toBe('NOT_IN_PROGRESS');
  });

  it('does not invent a result when an in-progress attempt has no start time', () => {
    const result = assessPublicationReconciliation({
      attempt: attempt({ startedAt: null }),
      now: new Date('2026-09-26T16:00:00.000Z'),
      uncertaintyWindowMs: 5 * 60 * 1000,
    });

    expect(result.requiresReconciliation).toBe(false);
    expect(result.reason).toBe('START_TIME_MISSING');
  });

  it('assesses repository state without writing or creating another attempt', async () => {
    const repository =
      new InMemoryMarketingSocialRepository();

    await repository.createPendingPublicationAttempt(
      {
        id: 'attempt-1',
        preparedPublicationId: 'publication-1',
      },
      { operationKey: 'prepare-1' },
    );

    await repository.startPublicationAttempt(
      { id: 'attempt-1' },
      { operationKey: 'start-1' },
    );

    const before =
      await repository
        .listPublicationAttemptsByPreparedPublicationId(
          'publication-1',
        );

    const startedAt = before[0]?.startedAt;
    expect(startedAt).toBeInstanceOf(Date);

    const handler =
      new AssessPublicationReconciliationHandler(repository);

    const assessments = await handler.execute({
      preparedPublicationId: 'publication-1',
      now: new Date(
        (startedAt as Date).getTime() + 10 * 60 * 1000,
      ),
      uncertaintyWindowMs: 5 * 60 * 1000,
    });

    const after =
      await repository
        .listPublicationAttemptsByPreparedPublicationId(
          'publication-1',
        );

    expect(assessments).toHaveLength(1);
    expect(assessments[0]?.requiresReconciliation).toBe(true);
    expect(after).toEqual(before);
    expect(after).toHaveLength(1);
    expect(after[0]?.status).toBe('IN_PROGRESS');
    expect(after[0]?.completedAt).toBeNull();
    expect(after[0]?.externalPublicationRef).toBeNull();
    expect(after[0]?.failureCode).toBeNull();
  });

  it('rejects an invalid uncertainty window without touching repository state', async () => {
    const repository =
      new InMemoryMarketingSocialRepository();

    const handler =
      new AssessPublicationReconciliationHandler(repository);

    await expect(
      handler.execute({
        preparedPublicationId: 'publication-1',
        now: new Date('2026-09-26T16:00:00.000Z'),
        uncertaintyWindowMs: -1,
      }),
    ).rejects.toBeInstanceOf(RangeError);

    const attempts =
      await repository
        .listPublicationAttemptsByPreparedPublicationId(
          'publication-1',
        );

    expect(attempts).toHaveLength(0);
  });
});
