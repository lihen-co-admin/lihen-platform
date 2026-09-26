import { describe, expect, it } from 'vitest';
import type {
  ContentSchedule,
  PreparedPublication,
} from '@lihen/marketing';
import {
  runSocialPublicationE2E,
} from '../src/composition/social-publication-e2e';
import {
  isSimulationAttempt,
  summarizeSocialPublicationConsole,
} from '../src/domain/social-publication-console';

const scheduledFor = new Date('2026-09-26T14:00:00.000Z');

function schedule(): ContentSchedule {
  return {
    id: 'schedule-social-11',
    channelVariantId: 'variant-social-11',
    scheduledFor,
    timezone: 'America/Bogota',
    status: 'APPROVED',
    createdAt: new Date('2026-09-25T12:00:00.000Z'),
    updatedAt: new Date('2026-09-25T13:00:00.000Z'),
  };
}

function publication(): PreparedPublication {
  return {
    id: 'publication-social-11',
    campaignId: 'campaign-social-11',
    campaignContentId: 'content-social-11',
    channelVariantId: 'variant-social-11',
    scheduleId: 'schedule-social-11',
    channel: 'INSTAGRAM_FEED',
    copy: 'Contenido local de prueba LIHEN.CO',
    callToAction: 'Revisar propuesta',
    hashtags: ['LIHENCO', 'BeautyCare'],
    creativeAssetIds: ['asset-social-11'],
    status: 'APPROVED',
    preparedAt: new Date('2026-09-25T13:00:00.000Z'),
  };
}

describe('Control Center social publication E2E', () => {
  it('runs the governed flow with the in-memory publisher only', async () => {
    const result = await runSocialPublicationE2E({
      schedule: schedule(),
      publication: publication(),
      now: new Date('2026-09-26T14:30:00.000Z'),
      attemptId: 'attempt-social-11',
    });

    expect(result.externalExecution).toBe(false);
    expect(result.simulation).toBe(true);
    expect(result.attempt.status).toBe('SUCCEEDED');
    expect(result.attempt.attemptNumber).toBe(1);
    expect(result.attempt.startedAt).toBeInstanceOf(Date);
    expect(result.attempt.completedAt).toBeInstanceOf(Date);
    expect(result.attempt.externalPublicationRef)
      .toBe('local-test-publication');
    expect(isSimulationAttempt(result.attempt)).toBe(true);
  });

  it('summarizes governed social state without implying external publication', async () => {
    const result = await runSocialPublicationE2E({
      schedule: schedule(),
      publication: publication(),
      now: new Date('2026-09-26T14:30:00.000Z'),
      attemptId: 'attempt-social-11-summary',
    });

    expect(
      summarizeSocialPublicationConsole({
        schedules: [result.schedule],
        publications: [result.publication],
        attempts: [result.attempt],
      }),
    ).toEqual({
      scheduled: 1,
      approvedSchedules: 1,
      prepared: 1,
      approvedPublications: 1,
      pendingAttempts: 0,
      inProgressAttempts: 0,
      succeededAttempts: 1,
      failedAttempts: 0,
    });
  });
});

describe('Control Center social publication reconciliation visibility', () => {
  it('surfaces an unresolved IN_PROGRESS attempt for human reconciliation without completing it', async () => {
    const {
      runSocialPublicationReconciliationE2E,
    } = await import(
      '../src/composition/social-publication-e2e'
    );
    const {
      summarizePublicationReconciliation,
    } = await import(
      '../src/domain/social-publication-console'
    );

    const result =
      await runSocialPublicationReconciliationE2E({
        schedule: schedule(),
        publication: publication(),
        now: new Date('2026-09-26T14:30:00.000Z'),
        attemptId: 'attempt-social-13-reconciliation',
        uncertaintyWindowMs: 5 * 60 * 1000,
        elapsedMs: 10 * 60 * 1000,
      });

    expect(result.externalExecution).toBe(false);
    expect(result.readOnlyAssessment).toBe(true);

    expect(result.attempt.status).toBe('IN_PROGRESS');
    expect(result.attempt.startedAt).toBeInstanceOf(Date);
    expect(result.attempt.completedAt).toBeNull();
    expect(result.attempt.externalPublicationRef).toBeNull();
    expect(result.attempt.failureCode).toBeNull();

    expect(result.assessments).toHaveLength(1);
    expect(result.assessments[0]).toMatchObject({
      attemptId: 'attempt-social-13-reconciliation',
      status: 'IN_PROGRESS',
      requiresReconciliation: true,
      reason: 'IN_PROGRESS_OUTSIDE_UNCERTAINTY_WINDOW',
    });

    expect(
      summarizePublicationReconciliation(
        result.assessments,
      ),
    ).toEqual({
      assessedAttempts: 1,
      reconciliationRequired: 1,
      withinUncertaintyWindow: 0,
    });
  });

  it('keeps a recent IN_PROGRESS attempt inside the uncertainty window without declaring success or failure', async () => {
    const {
      runSocialPublicationReconciliationE2E,
    } = await import(
      '../src/composition/social-publication-e2e'
    );
    const {
      summarizePublicationReconciliation,
    } = await import(
      '../src/domain/social-publication-console'
    );

    const result =
      await runSocialPublicationReconciliationE2E({
        schedule: schedule(),
        publication: publication(),
        now: new Date('2026-09-26T14:30:00.000Z'),
        attemptId: 'attempt-social-13-window',
        uncertaintyWindowMs: 5 * 60 * 1000,
        elapsedMs: 2 * 60 * 1000,
      });

    expect(result.attempt.status).toBe('IN_PROGRESS');
    expect(result.attempt.completedAt).toBeNull();
    expect(result.attempt.externalPublicationRef).toBeNull();
    expect(result.attempt.failureCode).toBeNull();

    expect(result.assessments[0]).toMatchObject({
      requiresReconciliation: false,
      reason: 'WITHIN_UNCERTAINTY_WINDOW',
      status: 'IN_PROGRESS',
    });

    expect(
      summarizePublicationReconciliation(
        result.assessments,
      ),
    ).toEqual({
      assessedAttempts: 1,
      reconciliationRequired: 0,
      withinUncertaintyWindow: 1,
    });
  });
});
