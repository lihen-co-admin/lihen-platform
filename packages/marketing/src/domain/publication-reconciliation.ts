import type { PublicationAttempt } from './publication-attempt';

export type PublicationReconciliationReason =
  | 'NOT_IN_PROGRESS'
  | 'START_TIME_MISSING'
  | 'ALREADY_COMPLETED'
  | 'WITHIN_UNCERTAINTY_WINDOW'
  | 'IN_PROGRESS_OUTSIDE_UNCERTAINTY_WINDOW';

export interface PublicationReconciliationAssessment {
  readonly attemptId: string;
  readonly requiresReconciliation: boolean;
  readonly reason: PublicationReconciliationReason;
  readonly status: PublicationAttempt['status'];
  readonly startedAt: Date | null;
  readonly completedAt: Date | null;
  readonly ageMs: number | null;
}

export interface AssessPublicationReconciliationInput {
  readonly attempt: PublicationAttempt;
  readonly now: Date;
  readonly uncertaintyWindowMs: number;
}

export function assessPublicationReconciliation(
  input: AssessPublicationReconciliationInput,
): PublicationReconciliationAssessment {
  const { attempt, now, uncertaintyWindowMs } = input;

  if (attempt.status !== 'IN_PROGRESS') {
    return {
      attemptId: attempt.id,
      requiresReconciliation: false,
      reason: 'NOT_IN_PROGRESS',
      status: attempt.status,
      startedAt: attempt.startedAt,
      completedAt: attempt.completedAt,
      ageMs: null,
    };
  }

  if (attempt.startedAt === null) {
    return {
      attemptId: attempt.id,
      requiresReconciliation: false,
      reason: 'START_TIME_MISSING',
      status: attempt.status,
      startedAt: null,
      completedAt: attempt.completedAt,
      ageMs: null,
    };
  }

  if (attempt.completedAt !== null) {
    return {
      attemptId: attempt.id,
      requiresReconciliation: false,
      reason: 'ALREADY_COMPLETED',
      status: attempt.status,
      startedAt: attempt.startedAt,
      completedAt: attempt.completedAt,
      ageMs: Math.max(
        0,
        now.getTime() - attempt.startedAt.getTime(),
      ),
    };
  }

  const ageMs = Math.max(
    0,
    now.getTime() - attempt.startedAt.getTime(),
  );

  if (ageMs < uncertaintyWindowMs) {
    return {
      attemptId: attempt.id,
      requiresReconciliation: false,
      reason: 'WITHIN_UNCERTAINTY_WINDOW',
      status: attempt.status,
      startedAt: attempt.startedAt,
      completedAt: null,
      ageMs,
    };
  }

  return {
    attemptId: attempt.id,
    requiresReconciliation: true,
    reason: 'IN_PROGRESS_OUTSIDE_UNCERTAINTY_WINDOW',
    status: attempt.status,
    startedAt: attempt.startedAt,
    completedAt: null,
    ageMs,
  };
}
