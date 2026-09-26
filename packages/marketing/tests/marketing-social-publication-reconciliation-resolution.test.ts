import { describe, expect, it } from 'vitest';

import {
  ResolvePublicationReconciliationHandler,
  resolvePublicationReconciliation,
  type PublicationReconciliationAssessment,
} from '../src';

function uncertainAssessment(): PublicationReconciliationAssessment {
  return {
    attemptId: 'attempt-1',
    requiresReconciliation: true,
    reason: 'IN_PROGRESS_OUTSIDE_UNCERTAINTY_WINDOW',
    status: 'IN_PROGRESS',
    startedAt: new Date('2026-09-26T15:00:00.000Z'),
    completedAt: null,
    ageMs: 10 * 60 * 1000,
  };
}

describe('Marketing social publication reconciliation human resolution', () => {
  it('acknowledges an uncertain attempt without inventing an external outcome', () => {
    const result = resolvePublicationReconciliation({
      assessment: uncertainAssessment(),
      decision: 'ACKNOWLEDGE_UNKNOWN',
      resolvedBy: 'operator-1',
      resolvedAt: new Date('2026-09-26T15:11:00.000Z'),
    });

    expect(result.attemptId).toBe('attempt-1');
    expect(result.decision).toBe('ACKNOWLEDGE_UNKNOWN');
    expect(result.externalOutcome).toBe('UNKNOWN');
  });

  it('allows escalation while preserving UNKNOWN external outcome', async () => {
    const handler = new ResolvePublicationReconciliationHandler();

    const result = await handler.execute({
      assessment: uncertainAssessment(),
      decision: 'ESCALATE_FOR_INVESTIGATION',
      resolvedBy: 'operator-1',
      resolvedAt: new Date('2026-09-26T15:11:00.000Z'),
    });

    expect(result.decision).toBe('ESCALATE_FOR_INVESTIGATION');
    expect(result.externalOutcome).toBe('UNKNOWN');
  });

  it('rejects resolution when reconciliation is not required', () => {
    expect(() =>
      resolvePublicationReconciliation({
        assessment: {
          ...uncertainAssessment(),
          requiresReconciliation: false,
          reason: 'WITHIN_UNCERTAINTY_WINDOW',
        },
        decision: 'ACKNOWLEDGE_UNKNOWN',
        resolvedBy: 'operator-1',
        resolvedAt: new Date('2026-09-26T15:02:00.000Z'),
      }),
    ).toThrow(
      'Publication attempt must require reconciliation before human resolution.',
    );
  });

  it('requires a human actor', () => {
    expect(() =>
      resolvePublicationReconciliation({
        assessment: uncertainAssessment(),
        decision: 'ACKNOWLEDGE_UNKNOWN',
        resolvedBy: '   ',
        resolvedAt: new Date('2026-09-26T15:11:00.000Z'),
      }),
    ).toThrow('resolvedBy is required.');
  });

  it('does not expose success, failure, retry, provider or publication execution', () => {
    const result = resolvePublicationReconciliation({
      assessment: uncertainAssessment(),
      decision: 'ACKNOWLEDGE_UNKNOWN',
      resolvedBy: 'operator-1',
      resolvedAt: new Date('2026-09-26T15:11:00.000Z'),
    });

    expect(result.externalOutcome).toBe('UNKNOWN');
    expect('externalPublicationRef' in result).toBe(false);
    expect('failureCode' in result).toBe(false);
    expect('retry' in result).toBe(false);
  });
});
