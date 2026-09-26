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
