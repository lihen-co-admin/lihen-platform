import type { PublicationReconciliationAssessment } from './publication-reconciliation';

export const publicationReconciliationResolutionDecisions = [
  'ACKNOWLEDGE_UNKNOWN',
  'ESCALATE_FOR_INVESTIGATION',
] as const;

export type PublicationReconciliationResolutionDecision =
  (typeof publicationReconciliationResolutionDecisions)[number];

export interface PublicationReconciliationResolution {
  readonly attemptId: string;
  readonly decision: PublicationReconciliationResolutionDecision;
  readonly resolvedBy: string;
  readonly resolvedAt: Date;
  readonly externalOutcome: 'UNKNOWN';
}

export interface ResolvePublicationReconciliationInput {
  readonly assessment: PublicationReconciliationAssessment;
  readonly decision: PublicationReconciliationResolutionDecision;
  readonly resolvedBy: string;
  readonly resolvedAt: Date;
}

export function resolvePublicationReconciliation(
  input: ResolvePublicationReconciliationInput,
): PublicationReconciliationResolution {
  if (!input.assessment.requiresReconciliation) {
    throw new Error(
      'Publication attempt must require reconciliation before human resolution.',
    );
  }

  if (
    input.assessment.reason !==
    'IN_PROGRESS_OUTSIDE_UNCERTAINTY_WINDOW'
  ) {
    throw new Error(
      'Only an uncertain in-progress publication attempt can be resolved.',
    );
  }

  if (input.resolvedBy.trim().length === 0) {
    throw new Error('resolvedBy is required.');
  }

  if (Number.isNaN(input.resolvedAt.getTime())) {
    throw new Error('resolvedAt must be a valid date.');
  }

  return {
    attemptId: input.assessment.attemptId,
    decision: input.decision,
    resolvedBy: input.resolvedBy.trim(),
    resolvedAt: input.resolvedAt,
    externalOutcome: 'UNKNOWN',
  };
}
