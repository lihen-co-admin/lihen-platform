import type {
  CorrelationId,
  IntelligenceDecision,
  IntelligenceRecommendation,
  IntelligenceRiskLevel,
} from './contracts';

/**
 * GAP-010 — Unified Human Review Queue
 *
 * This is a unified read/review model, not a second decision store.
 * Source systems keep authority over their own decisions and controlled mutations.
 */

export type HumanReviewSourceKind =
  | 'INTELLIGENCE_RECOMMENDATION'
  | 'PRODUCT_RECONCILIATION'
  | 'VISUAL_INTELLIGENCE'
  | 'SUPPLIER_CANDIDATE'
  | 'GOVERNANCE';

export type HumanReviewStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'DEFERRED'
  | 'REPLACED'
  | 'SUPERSEDED';

export type HumanReviewPriority = 'P0' | 'P1' | 'P2' | 'P3' | 'P4';

export interface HumanReviewEntityRef {
  readonly entityType: string;
  readonly entityId?: string;
  readonly label?: string;
}

export interface HumanReviewEvidenceRef {
  readonly evidenceId: string;
  readonly label?: string;
  readonly sourceUri?: string;
}

export interface HumanReviewExistingDecisionRef {
  readonly decisionId: string;
  readonly decision: 'APPROVE' | 'REJECT' | 'DEFER' | 'REPLACE';
  readonly decidedBy: string;
  readonly decidedAt: string;
  readonly reason: string;
}

export interface HumanReviewItem {
  readonly reviewId: string;
  readonly sourceKind: HumanReviewSourceKind;
  readonly sourceRecordId: string;
  readonly correlationId: CorrelationId;
  readonly title: string;
  readonly summary: string;
  readonly priority: HumanReviewPriority;
  readonly riskLevel: IntelligenceRiskLevel | 'UNKNOWN';
  readonly status: HumanReviewStatus;
  readonly requiresHumanDecision: boolean;
  readonly entity?: HumanReviewEntityRef;
  readonly evidence: readonly HumanReviewEvidenceRef[];
  readonly existingDecision?: HumanReviewExistingDecisionRef;
  readonly createdAt: string;
  readonly sourceMetadata: Readonly<Record<string, unknown>>;
}

export interface ReconciliationReviewCandidateInput {
  readonly resultId: string;
  readonly correlationId: CorrelationId;
  readonly title: string;
  readonly summary: string;
  readonly confidence?: number;
  readonly reviewRequired: boolean;
  readonly status: HumanReviewStatus;
  readonly createdAt: string;
  readonly entity?: HumanReviewEntityRef;
  readonly evidence?: readonly HumanReviewEvidenceRef[];
  readonly existingDecision?: HumanReviewExistingDecisionRef;
  readonly sourceMetadata?: Readonly<Record<string, unknown>>;
}

export interface GenericHumanReviewSourceInput {
  readonly sourceKind: Exclude<
    HumanReviewSourceKind,
    'INTELLIGENCE_RECOMMENDATION' | 'PRODUCT_RECONCILIATION'
  >;
  readonly sourceRecordId: string;
  readonly correlationId: CorrelationId;
  readonly title: string;
  readonly summary: string;
  readonly priority?: HumanReviewPriority;
  readonly riskLevel?: IntelligenceRiskLevel | 'UNKNOWN';
  readonly status: HumanReviewStatus;
  readonly requiresHumanDecision: boolean;
  readonly createdAt: string;
  readonly entity?: HumanReviewEntityRef;
  readonly evidence?: readonly HumanReviewEvidenceRef[];
  readonly existingDecision?: HumanReviewExistingDecisionRef;
  readonly sourceMetadata?: Readonly<Record<string, unknown>>;
}

export interface HumanReviewQueueFilter {
  readonly sourceKinds?: readonly HumanReviewSourceKind[];
  readonly statuses?: readonly HumanReviewStatus[];
  readonly minimumPriority?: HumanReviewPriority;
  readonly requiresHumanDecisionOnly?: boolean;
}

const PRIORITY_WEIGHT: Readonly<Record<HumanReviewPriority, number>> = {
  P0: 4,
  P1: 3,
  P2: 2,
  P3: 1,
  P4: 0,
};

function decisionToStatus(
  decision: IntelligenceDecision['decision'],
): HumanReviewStatus {
  if (decision === 'APPROVE') return 'APPROVED';
  if (decision === 'REJECT') return 'REJECTED';
  if (decision === 'REPLACE') return 'REPLACED';
  return 'DEFERRED';
}

function recommendationStatus(
  recommendation: IntelligenceRecommendation,
  decision?: IntelligenceDecision,
): HumanReviewStatus {
  if (decision) return decisionToStatus(decision.decision);
  if (recommendation.status === 'SUPERSEDED') return 'SUPERSEDED';
  if (recommendation.status === 'REJECTED') return 'REJECTED';
  if (recommendation.status === 'APPROVED') return 'APPROVED';
  return 'PENDING';
}

function recommendationDecisionRef(
  decision: IntelligenceDecision,
): HumanReviewExistingDecisionRef {
  return {
    decisionId: decision.decisionId,
    decision: decision.decision,
    decidedBy: decision.decidedBy,
    decidedAt: decision.decidedAt,
    reason: decision.reason,
  };
}

export function reviewItemFromRecommendation(input: {
  readonly recommendation: IntelligenceRecommendation;
  readonly decision?: IntelligenceDecision;
}): HumanReviewItem {
  const { recommendation, decision } = input;

  if (
    decision &&
    decision.recommendationId &&
    decision.recommendationId !== recommendation.recommendationId
  ) {
    throw new Error('REVIEW_DECISION_RECOMMENDATION_MISMATCH');
  }

  if (
    decision &&
    decision.correlationId !== recommendation.correlationId
  ) {
    throw new Error('REVIEW_DECISION_CORRELATION_MISMATCH');
  }

  return {
    reviewId: `INTELLIGENCE_RECOMMENDATION:${recommendation.recommendationId}`,
    sourceKind: 'INTELLIGENCE_RECOMMENDATION',
    sourceRecordId: recommendation.recommendationId,
    correlationId: recommendation.correlationId,
    title: recommendation.title,
    summary: recommendation.explanation,
    priority: recommendation.priority,
    riskLevel: recommendation.risk.level,
    status: recommendationStatus(recommendation, decision),
    requiresHumanDecision: recommendation.risk.requiresHumanReview,
    entity: recommendation.context.entityId
      ? {
          entityType: recommendation.context.type,
          entityId: recommendation.context.entityId,
        }
      : {
          entityType: recommendation.context.type,
        },
    evidence: recommendation.evidenceIds.map((evidenceId) => ({ evidenceId })),
    ...(decision
      ? { existingDecision: recommendationDecisionRef(decision) }
      : {}),
    createdAt: recommendation.createdAt,
    sourceMetadata: {
      actionType: recommendation.actionType,
      source: recommendation.source,
      confidence: recommendation.confidence.score,
    },
  };
}

export function reviewItemFromReconciliation(
  input: ReconciliationReviewCandidateInput,
): HumanReviewItem {
  return {
    reviewId: `PRODUCT_RECONCILIATION:${input.resultId}`,
    sourceKind: 'PRODUCT_RECONCILIATION',
    sourceRecordId: input.resultId,
    correlationId: input.correlationId,
    title: input.title,
    summary: input.summary,
    priority:
      input.reviewRequired && (input.confidence ?? 0) < 0.7 ? 'P1' : 'P2',
    riskLevel: input.reviewRequired ? 'R3' : 'R1',
    status: input.status,
    requiresHumanDecision: input.reviewRequired,
    ...(input.entity ? { entity: input.entity } : {}),
    evidence: input.evidence ?? [],
    ...(input.existingDecision
      ? { existingDecision: input.existingDecision }
      : {}),
    createdAt: input.createdAt,
    sourceMetadata: {
      ...(input.sourceMetadata ?? {}),
      ...(input.confidence === undefined
        ? {}
        : { confidence: input.confidence }),
    },
  };
}

export function reviewItemFromGenericSource(
  input: GenericHumanReviewSourceInput,
): HumanReviewItem {
  return {
    reviewId: `${input.sourceKind}:${input.sourceRecordId}`,
    sourceKind: input.sourceKind,
    sourceRecordId: input.sourceRecordId,
    correlationId: input.correlationId,
    title: input.title,
    summary: input.summary,
    priority: input.priority ?? 'P2',
    riskLevel: input.riskLevel ?? 'UNKNOWN',
    status: input.status,
    requiresHumanDecision: input.requiresHumanDecision,
    ...(input.entity ? { entity: input.entity } : {}),
    evidence: input.evidence ?? [],
    ...(input.existingDecision
      ? { existingDecision: input.existingDecision }
      : {}),
    createdAt: input.createdAt,
    sourceMetadata: input.sourceMetadata ?? {},
  };
}

export function buildUnifiedHumanReviewQueue(input: {
  readonly recommendations?: readonly {
    readonly recommendation: IntelligenceRecommendation;
    readonly decision?: IntelligenceDecision;
  }[];
  readonly reconciliations?: readonly ReconciliationReviewCandidateInput[];
  readonly otherSources?: readonly GenericHumanReviewSourceInput[];
  readonly filter?: HumanReviewQueueFilter;
}): readonly HumanReviewItem[] {
  const items: HumanReviewItem[] = [
    ...(input.recommendations ?? []).map(reviewItemFromRecommendation),
    ...(input.reconciliations ?? []).map(reviewItemFromReconciliation),
    ...(input.otherSources ?? []).map(reviewItemFromGenericSource),
  ];

  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.reviewId)) {
      throw new Error(`DUPLICATE_REVIEW_ID:${item.reviewId}`);
    }
    seen.add(item.reviewId);
  }

  const filter = input.filter;
  const filtered = items.filter((item) => {
    if (
      filter?.sourceKinds &&
      !filter.sourceKinds.includes(item.sourceKind)
    ) {
      return false;
    }

    if (filter?.statuses && !filter.statuses.includes(item.status)) {
      return false;
    }

    if (
      filter?.minimumPriority &&
      PRIORITY_WEIGHT[item.priority] <
        PRIORITY_WEIGHT[filter.minimumPriority]
    ) {
      return false;
    }

    if (filter?.requiresHumanDecisionOnly && !item.requiresHumanDecision) {
      return false;
    }

    return true;
  });

  return filtered.sort((a, b) => {
    const priorityDelta =
      PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
    if (priorityDelta !== 0) return priorityDelta;

    return a.createdAt.localeCompare(b.createdAt);
  });
}

/**
 * A queue item is only a projection/read model.
 * Decisions must be written back through the source-specific existing decision path.
 */
export function assertReviewItemDoesNotAuthorizeExecution(
  item: HumanReviewItem,
): true {
  if ('execute' in item.sourceMetadata || 'publish' in item.sourceMetadata) {
    throw new Error('REVIEW_ITEM_EXECUTION_AUTHORITY_FORBIDDEN');
  }
  return true;
}
