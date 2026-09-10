import type {
  Confidence,
  CorrelationId,
  IntelligenceContext,
  IntelligenceEvidence,
  IntelligenceRecommendation,
  SourceAuthority,
} from '../contracts';

export interface CustomerIntelligenceSnapshot {
  readonly customerId: string;
  readonly status: 'ACTIVE' | 'INACTIVE';
  readonly orderCount: number;
  readonly purchaseCount: number;
  readonly lifetimeValue: number;
  readonly lastOrderAt: string | null;
  readonly lastPurchaseAt: string | null;
}

export interface PrepareCustomerIntelligenceInput {
  readonly correlationId: CorrelationId;
  readonly evidenceId: string;
  readonly recommendationId: string;
  readonly snapshot: CustomerIntelligenceSnapshot;
  readonly createdAt: string;
  readonly fingerprint: string;
}

export interface PreparedCustomerIntelligence {
  readonly evidence: IntelligenceEvidence;
  readonly recommendation: IntelligenceRecommendation;
}

function requireText(value: string, label: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${label} is required.`);
  }

  return normalized;
}

function confidenceFor(
  snapshot: CustomerIntelligenceSnapshot,
): Confidence {
  const hasHistory =
    snapshot.orderCount > 0 || snapshot.purchaseCount > 0;

  return {
    score: hasHistory ? 0.9 : 0.75,
    band: hasHistory ? 'VERY_HIGH' : 'HIGH',
    rationale: [
      'Customer Intelligence uses first-party LIHEN customer/order/sale read models only.',
      hasHistory
        ? 'Observed first-party commercial history is available.'
        : 'Customer exists but commercial history is not yet available.',
    ],
  };
}

function sourceAuthority(): SourceAuthority {
  return {
    level: 'FIRST_PARTY',
    sourceName: 'LIHEN Customer Read Model',
    sourceUri: 'lihen://customer/read-model',
    rationale: [
      'Derived only from LIHEN canonical Customer, Order and Sale authorities.',
      'No external provider or inferred sensitive attribute is used.',
    ],
  };
}

export function prepareCustomerIntelligence(
  input: PrepareCustomerIntelligenceInput,
): PreparedCustomerIntelligence {
  const correlationId = requireText(
    input.correlationId,
    'Correlation ID',
  );
  const evidenceId = requireText(input.evidenceId, 'Evidence ID');
  const recommendationId = requireText(
    input.recommendationId,
    'Recommendation ID',
  );
  const customerId = requireText(
    input.snapshot.customerId,
    'Customer ID',
  );
  const fingerprint = requireText(
    input.fingerprint,
    'Evidence fingerprint',
  );
  const createdAt = requireText(input.createdAt, 'Created at');

  const confidence = confidenceFor(input.snapshot);

  const context: IntelligenceContext = {
    contextId: `customer:${customerId}`,
    type: 'CUSTOMER',
    entityId: customerId,
    attributes: {},
  };

  const evidence: IntelligenceEvidence = {
    evidenceId,
    correlationId,
    context,
    capability: 'CUSTOMER_INTELLIGENCE',
    sourceAuthority: sourceAuthority(),
    observation:
      'First-party Customer activity snapshot analyzed without autonomous mutation or contact.',
    payload: {
      customerId,
      status: input.snapshot.status,
      orderCount: input.snapshot.orderCount,
      purchaseCount: input.snapshot.purchaseCount,
      lifetimeValue: input.snapshot.lifetimeValue,
      lastOrderAt: input.snapshot.lastOrderAt,
      lastPurchaseAt: input.snapshot.lastPurchaseAt,
    },
    confidence,
    fingerprint,
    createdAt,
  };

  const hasPurchaseHistory = input.snapshot.purchaseCount > 0;

  const recommendation: IntelligenceRecommendation = {
    recommendationId,
    correlationId,
    context,
    actionType: hasPurchaseHistory
      ? 'REVIEW_CUSTOMER_RELATIONSHIP'
      : 'REVIEW_CUSTOMER_FIRST_PURCHASE_OPPORTUNITY',
    title: hasPurchaseHistory
      ? 'Review customer relationship'
      : 'Review first-purchase opportunity',
    explanation: hasPurchaseHistory
      ? 'First-party purchase history exists. Human review may determine whether follow-up or a future governed marketing action is appropriate.'
      : 'No linked completed purchase is present in the supplied read model. Human review may determine whether a future governed action is appropriate.',
    priority: hasPurchaseHistory ? 'P3' : 'P4',
    severity: 'INFO',
    source: 'LIHEN Customer Read Model',
    rationale: [
      'Recommendation derived from first-party Customer, Order and Sale read models.',
      'No autonomous customer contact, lifecycle mutation or publication is authorized.',
    ],
    evidenceIds: [evidenceId],
    confidence,
    risk: {
      level: 'R2',
      reasons: [
        'Customer-related recommendation may influence a future governed business action.',
      ],
      requiresHumanReview: true,
    },
    status: 'OPEN',
    createdAt,
  };

  return {
    evidence,
    recommendation,
  };
}
