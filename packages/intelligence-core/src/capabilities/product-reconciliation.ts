import type {
  Confidence,
  CorrelationId,
  IntelligenceCandidate,
  IntelligenceContext,
  IntelligenceEvidence,
  IntelligenceRecommendation,
} from '../contracts';
import type { ReconciliationReviewCandidateInput } from '../review-queue';

/**
 * WAVE 6 / GAP-020 — Product Reconciliation Engine.
 *
 * Pure policy/read-model layer over the reconciliation foundations that already exist.
 * It does not persist reconciliation runs/results/decisions, assign Product Master IDs,
 * create Product Master records, or execute controlled operations.
 */

export type ProductReconciliationMatchKind =
  | 'EXACT'
  | 'FUZZY'
  | 'AMBIGUOUS'
  | 'CONFLICT'
  | 'NONE';

export type ProductReconciliationClassification =
  | 'EXACT_MATCH'
  | 'POSSIBLE_MATCH'
  | 'CONFLICT'
  | 'NEW_PRODUCT'
  | 'REVIEW_REQUIRED';

export interface ProductReconciliationMatchSignal {
  readonly productId: string;
  readonly matchKind: Exclude<ProductReconciliationMatchKind, 'NONE'>;
  readonly confidence: number;
  readonly reasons: readonly string[];
  readonly evidenceIds?: readonly string[];
}

export interface ProductReconciliationSourceRecord {
  readonly sourceRecordId: string;
  readonly sourceRowKey: string;
  readonly productName: string | null;
  readonly supplierReference: string | null;
  readonly businessLine: 'BEAUTY_CARE' | 'STYLE' | null;
  readonly extractionConfidence: number | null;
  readonly evidenceIds: readonly string[];
}

export interface ProductReconciliationInput {
  readonly resultId: string;
  readonly correlationId: CorrelationId;
  readonly context: IntelligenceContext;
  readonly sourceRecord: ProductReconciliationSourceRecord;
  readonly matches: readonly ProductReconciliationMatchSignal[];
  readonly createdAt: string;
}

export interface ProductReconciliationPreparedResult {
  readonly resultId: string;
  readonly sourceRecordId: string;
  readonly classification: ProductReconciliationClassification;
  /**
   * Observed/proposed Product Master reference only. It is never an authorization
   * to persist product_id on a source record or mutate Product Master.
   */
  readonly proposedProductId: string | null;
  readonly canAutoAssignProductId: false;
  readonly canAutoCreateProductMaster: false;
  readonly requiresHumanReview: boolean;
  readonly confidence: Confidence;
  readonly candidate: IntelligenceCandidate;
  readonly recommendation: IntelligenceRecommendation;
  readonly reviewCandidate: ReconciliationReviewCandidateInput;
}

function requiredText(value: string, code: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(code);
  return normalized;
}

function validateScore(score: number, code: string): number {
  if (!Number.isFinite(score) || score < 0 || score > 1) {
    throw new Error(code);
  }
  return score;
}

function confidenceFrom(score: number, rationale: readonly string[]): Confidence {
  const normalized = validateScore(score, 'PRODUCT_RECONCILIATION_CONFIDENCE_INVALID');
  const band: Confidence['band'] =
    normalized >= 0.9
      ? 'VERY_HIGH'
      : normalized >= 0.75
        ? 'HIGH'
        : normalized >= 0.5
          ? 'MEDIUM'
          : normalized >= 0.25
            ? 'LOW'
            : 'VERY_LOW';
  return {
    score: normalized,
    band,
    rationale: [
      ...rationale,
      'Confidence is evidence quality, never mutation authorization.',
    ],
  };
}

function normalizeMatch(
  match: ProductReconciliationMatchSignal,
): ProductReconciliationMatchSignal {
  return {
    productId: requiredText(
      match.productId,
      'PRODUCT_RECONCILIATION_PRODUCT_ID_REQUIRED',
    ),
    matchKind: match.matchKind,
    confidence: validateScore(
      match.confidence,
      'PRODUCT_RECONCILIATION_MATCH_CONFIDENCE_INVALID',
    ),
    reasons: [...match.reasons],
    ...(match.evidenceIds ? { evidenceIds: [...match.evidenceIds] } : {}),
  };
}

function uniqueMatches(
  matches: readonly ProductReconciliationMatchSignal[],
): readonly ProductReconciliationMatchSignal[] {
  const normalized = matches.map(normalizeMatch);
  const ids = new Set<string>();
  for (const match of normalized) {
    if (ids.has(match.productId)) {
      throw new Error('PRODUCT_RECONCILIATION_DUPLICATE_PRODUCT_CANDIDATE');
    }
    ids.add(match.productId);
  }
  return normalized.sort((left, right) => {
    if (left.confidence !== right.confidence) {
      return right.confidence - left.confidence;
    }
    return left.productId.localeCompare(right.productId);
  });
}

function classify(
  matches: readonly ProductReconciliationMatchSignal[],
): {
  readonly classification: ProductReconciliationClassification;
  readonly proposedProductId: string | null;
  readonly requiresHumanReview: boolean;
  readonly confidenceScore: number;
  readonly rationale: readonly string[];
} {
  if (matches.length === 0) {
    return {
      classification: 'NEW_PRODUCT',
      proposedProductId: null,
      requiresHumanReview: true,
      confidenceScore: 0,
      rationale: [
        'No Product Master candidate was observed for the supplier source record.',
        'A new-product possibility requires human review before Product Master creation.',
      ],
    };
  }

  const conflicts = matches.filter((match) => match.matchKind === 'CONFLICT');
  if (conflicts.length > 0) {
    return {
      classification: 'CONFLICT',
      proposedProductId: null,
      requiresHumanReview: true,
      confidenceScore: Math.max(...conflicts.map((match) => match.confidence)),
      rationale: [
        'At least one reconciliation signal reports a product identity conflict.',
        'Conflicting evidence cannot authorize a Product Master assignment.',
      ],
    };
  }

  const exact = matches.filter((match) => match.matchKind === 'EXACT');
  if (exact.length === 1 && matches.length === 1) {
    return {
      classification: 'EXACT_MATCH',
      proposedProductId: exact[0]!.productId,
      requiresHumanReview: true,
      confidenceScore: exact[0]!.confidence,
      rationale: [
        'A single exact Product Master candidate was observed.',
        'Exact match is still a proposal/evidence result; canonical assignment remains governed.',
      ],
    };
  }

  if (exact.length > 1) {
    return {
      classification: 'CONFLICT',
      proposedProductId: null,
      requiresHumanReview: true,
      confidenceScore: Math.max(...exact.map((match) => match.confidence)),
      rationale: [
        'Multiple exact Product Master candidates were observed.',
        'Multiple exact candidates are contradictory and require human review.',
      ],
    };
  }

  const ambiguous = matches.filter((match) => match.matchKind === 'AMBIGUOUS');
  if (ambiguous.length > 0 || matches.length > 1) {
    return {
      classification: 'REVIEW_REQUIRED',
      proposedProductId: null,
      requiresHumanReview: true,
      confidenceScore: matches[0]!.confidence,
      rationale: [
        'Multiple or explicitly ambiguous Product Master candidates were observed.',
        'Ambiguous reconciliation never autoassigns product_id.',
      ],
    };
  }

  const match = matches[0]!;
  if (match.matchKind === 'FUZZY') {
    return {
      classification: 'POSSIBLE_MATCH',
      proposedProductId: match.productId,
      requiresHumanReview: true,
      confidenceScore: match.confidence,
      rationale: [
        'A fuzzy Product Master candidate was observed.',
        'Fuzzy reconciliation never autoassigns product_id.',
      ],
    };
  }

  return {
    classification: 'REVIEW_REQUIRED',
    proposedProductId: null,
    requiresHumanReview: true,
    confidenceScore: match.confidence,
    rationale: [
      'The reconciliation signal cannot be resolved safely by policy.',
      'Human review is required.',
    ],
  };
}

function evidenceIdsFor(
  source: ProductReconciliationSourceRecord,
  matches: readonly ProductReconciliationMatchSignal[],
): readonly string[] {
  return [
    ...new Set([
      ...source.evidenceIds,
      ...matches.flatMap((match) => match.evidenceIds ?? []),
    ]),
  ];
}

function candidateTypeFor(
  classification: ProductReconciliationClassification,
): IntelligenceCandidate['type'] {
  return classification === 'NEW_PRODUCT' ? 'NEW_PRODUCT' : 'PRODUCT_MATCH';
}

function recommendationAction(
  classification: ProductReconciliationClassification,
): string {
  if (classification === 'NEW_PRODUCT') return 'REVIEW_NEW_PRODUCT_CANDIDATE';
  if (classification === 'CONFLICT') return 'REVIEW_PRODUCT_RECONCILIATION_CONFLICT';
  if (classification === 'EXACT_MATCH') return 'REVIEW_EXACT_PRODUCT_MATCH';
  return 'REVIEW_POSSIBLE_PRODUCT_MATCH';
}

export function prepareProductReconciliation(
  input: ProductReconciliationInput,
): ProductReconciliationPreparedResult {
  const resultId = requiredText(
    input.resultId,
    'PRODUCT_RECONCILIATION_RESULT_ID_REQUIRED',
  );
  const correlationId = requiredText(
    input.correlationId,
    'PRODUCT_RECONCILIATION_CORRELATION_ID_REQUIRED',
  );
  const sourceRecordId = requiredText(
    input.sourceRecord.sourceRecordId,
    'PRODUCT_RECONCILIATION_SOURCE_RECORD_ID_REQUIRED',
  );
  requiredText(
    input.sourceRecord.sourceRowKey,
    'PRODUCT_RECONCILIATION_SOURCE_ROW_KEY_REQUIRED',
  );
  const createdAt = requiredText(
    input.createdAt,
    'PRODUCT_RECONCILIATION_CREATED_AT_REQUIRED',
  );

  if (
    input.context.type !== 'PRODUCT' &&
    input.context.type !== 'SUPPLIER' &&
    input.context.type !== 'DOCUMENT'
  ) {
    throw new Error('PRODUCT_RECONCILIATION_CONTEXT_INVALID');
  }

  if (
    input.sourceRecord.extractionConfidence !== null
  ) {
    validateScore(
      input.sourceRecord.extractionConfidence,
      'PRODUCT_RECONCILIATION_SOURCE_CONFIDENCE_INVALID',
    );
  }

  const matches = uniqueMatches(input.matches);
  const decision = classify(matches);
  const evidenceIds = evidenceIdsFor(input.sourceRecord, matches);
  const confidence = confidenceFrom(
    decision.confidenceScore,
    decision.rationale,
  );

  const candidateId = `product-reconciliation:${resultId}:candidate`;
  const candidate: IntelligenceCandidate = {
    candidateId,
    correlationId,
    type: candidateTypeFor(decision.classification),
    context: input.context,
    payload: {
      resultId,
      sourceRecordId,
      sourceRowKey: input.sourceRecord.sourceRowKey,
      classification: decision.classification,
      proposedProductId: decision.proposedProductId,
      canAutoAssignProductId: false,
      canAutoCreateProductMaster: false,
      observedMatches: matches.map((match) => ({
        productId: match.productId,
        matchKind: match.matchKind,
        confidence: match.confidence,
        reasons: [...match.reasons],
      })),
    },
    evidenceIds,
    confidence,
    status: 'IN_REVIEW',
    createdAt,
  };

  const recommendation: IntelligenceRecommendation = {
    recommendationId: `product-reconciliation:${resultId}:review`,
    correlationId,
    context: input.context,
    actionType: recommendationAction(decision.classification),
    title:
      decision.classification === 'NEW_PRODUCT'
        ? 'Review new product candidate'
        : 'Review Product Master reconciliation',
    explanation: decision.rationale.join(' '),
    priority:
      decision.classification === 'CONFLICT' ||
      decision.classification === 'REVIEW_REQUIRED'
        ? 'P1'
        : 'P2',
    severity:
      decision.classification === 'CONFLICT' ? 'CRITICAL' : 'WARNING',
    source: 'PRODUCT_RECONCILIATION',
    rationale: [
      ...decision.rationale,
      'The existing source-specific reconciliation decision path remains authoritative.',
      'Existing Control Plane is required for any governed canonical mutation.',
    ],
    evidenceIds,
    confidence,
    risk: {
      level: 'R3',
      reasons: [
        'Product Master identity is canonical master data.',
        'A reconciliation result cannot authorize mutation by itself.',
      ],
      requiresHumanReview: true,
    },
    status: 'OPEN',
    createdAt,
  };

  const reviewCandidate: ReconciliationReviewCandidateInput = {
    resultId,
    correlationId,
    title: recommendation.title,
    summary: recommendation.explanation,
    confidence: confidence.score,
    reviewRequired: true,
    status: 'PENDING',
    createdAt,
    entity: decision.proposedProductId
      ? {
          entityType: 'PRODUCT',
          entityId: decision.proposedProductId,
          ...(input.sourceRecord.productName
            ? { label: input.sourceRecord.productName }
            : {}),
        }
      : {
          entityType: 'PRODUCT',
          ...(input.sourceRecord.productName
            ? { label: input.sourceRecord.productName }
            : {}),
        },
    evidence: evidenceIds.map((evidenceId) => ({ evidenceId })),
    sourceMetadata: {
      classification: decision.classification,
      sourceRecordId,
      sourceRowKey: input.sourceRecord.sourceRowKey,
      proposedProductId: decision.proposedProductId,
      canAutoAssignProductId: false,
      canAutoCreateProductMaster: false,
      decisionPath: 'EXISTING_PRODUCT_RECONCILIATION_DECISIONS',
      mutationBoundary: 'EXISTING_CONTROL_PLANE',
    },
  };

  return {
    resultId,
    sourceRecordId,
    classification: decision.classification,
    proposedProductId: decision.proposedProductId,
    canAutoAssignProductId: false,
    canAutoCreateProductMaster: false,
    requiresHumanReview: true,
    confidence,
    candidate,
    recommendation,
    reviewCandidate,
  };
}

export function evidenceFromPersistedReconciliation(input: {
  readonly resultId: string;
  readonly correlationId: CorrelationId;
  readonly context: IntelligenceContext;
  readonly classification: ProductReconciliationClassification;
  readonly productId: string | null;
  readonly confidence: number | null;
  readonly reason: string | null;
  readonly sourcePayload: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
}): IntelligenceEvidence {
  const resultId = requiredText(
    input.resultId,
    'PRODUCT_RECONCILIATION_RESULT_ID_REQUIRED',
  );
  const correlationId = requiredText(
    input.correlationId,
    'PRODUCT_RECONCILIATION_CORRELATION_ID_REQUIRED',
  );
  const createdAt = requiredText(
    input.createdAt,
    'PRODUCT_RECONCILIATION_CREATED_AT_REQUIRED',
  );
  const score = input.confidence ?? 0;
  const confidence = confidenceFrom(score, [
    `Persisted reconciliation classification: ${input.classification}.`,
  ]);

  return {
    evidenceId: `product-reconciliation:${resultId}:evidence`,
    correlationId,
    context: input.context,
    capability: 'PRODUCT_INTELLIGENCE',
    sourceAuthority: {
      level: 'FIRST_PARTY',
      sourceName: 'LIHEN Product Master Reconciliation',
      rationale: [
        'The observation comes from the existing LIHEN reconciliation foundation.',
        'Persisted reconciliation evidence is not mutation authorization.',
      ],
    },
    observation:
      input.reason?.trim() ||
      `Existing reconciliation result classified as ${input.classification}.`,
    payload: {
      resultId,
      classification: input.classification,
      observedProductId: input.productId,
      sourcePayload: input.sourcePayload,
      canAutoAssignProductId: false,
    },
    confidence,
    fingerprint: [
      resultId,
      input.classification,
      input.productId ?? '',
      String(score),
    ]
      .join('|')
      .toLowerCase(),
    createdAt,
  };
}
