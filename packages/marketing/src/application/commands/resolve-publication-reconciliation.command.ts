import type {
  PublicationReconciliationAssessment,
} from '../../domain/publication-reconciliation';
import type {
  PublicationReconciliationResolutionDecision,
} from '../../domain/publication-reconciliation-resolution';

export interface ResolvePublicationReconciliationCommand {
  readonly assessment: PublicationReconciliationAssessment;
  readonly decision: PublicationReconciliationResolutionDecision;
  readonly resolvedBy: string;
  readonly resolvedAt: Date;
}
