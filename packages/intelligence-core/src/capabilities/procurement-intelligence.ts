import type {
  Confidence,
  CorrelationId,
  IntelligenceContext,
  IntelligenceEvidence,
  IntelligenceRecommendation,
  IntelligenceRisk,
  IntelligenceSeverity,
} from '../contracts';

/**
 * WAVE 8 / GAP-028 — Procurement Intelligence.
 *
 * Pure ANALYTICS over governed Purchase/Supplier read models.
 * It never confirms or receives purchases, posts inventory/finance,
 * mutates supplier costs, or calls persistence/RPC infrastructure.
 */
export type ProcurementPurchaseStatus =
  | 'DRAFT'
  | 'CONFIRMED'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'CANCELLED';

export interface ProcurementPurchaseReadModel {
  readonly id: string;
  readonly purchaseNumber: string;
  readonly supplierId: string;
  readonly status: ProcurementPurchaseStatus;
  readonly purchaseDate: string | null;
  readonly expectedDate: string | null;
  readonly receivedAt: Date | string | null;
}

export interface ProcurementPurchaseItemReadModel {
  readonly id: string;
  readonly purchaseId: string;
  readonly productId: string;
  readonly quantityRequested: number;
  readonly quantityReceived: number;
  readonly quotedUnitCost: number | null;
  readonly finalUnitCost: number | null;
}

export interface SupplierPerformanceObservation {
  readonly supplierId: string;
  readonly purchaseCount: number;
  readonly overduePurchaseCount: number;
  readonly receivedPurchaseCount: number;
  readonly averageReceiptDelayDays?: number | null;
}

export interface ProcurementIntelligencePolicy {
  readonly overdueGraceDays: number;
  readonly costIncreaseWarningPercent: number;
  readonly supplierOverdueRateWarningPercent: number;
}

export type ProcurementIntelligenceSignalKind =
  | 'PURCHASE_INTEGRITY_ANOMALY'
  | 'RECEIPT_OVERDUE'
  | 'PARTIAL_RECEIPT'
  | 'COST_INCREASE'
  | 'COST_DECREASE'
  | 'SUPPLIER_DELAY_PATTERN';

export interface ProcurementIntelligenceSignal {
  readonly kind: ProcurementIntelligenceSignalKind;
  readonly severity: IntelligenceSeverity;
  readonly title: string;
  readonly explanation: string;
  readonly rationale: readonly string[];
}

export interface ProcurementIntelligenceMetrics {
  readonly requestedUnits: number;
  readonly receivedUnits: number;
  readonly remainingUnits: number;
  readonly receiptProgressPercent: number;
  readonly observedQuotedReceiptValue: number | null;
  readonly observedFinalReceiptValue: number | null;
  readonly observedCostVarianceAmount: number | null;
  readonly observedCostVariancePercent: number | null;
  readonly supplierOverdueRatePercent: number | null;
  readonly supplierAverageReceiptDelayDays: number | null;
}

export interface ProcurementIntelligenceGovernance {
  readonly canAutoConfirmPurchase: false;
  readonly canAutoReceivePurchase: false;
  readonly canAutoPostInventory: false;
  readonly canAutoPostFinance: false;
  readonly canAutoChangeSupplierCost: false;
}

export interface ProcurementIntelligenceInput {
  readonly correlationId: CorrelationId;
  readonly purchase: ProcurementPurchaseReadModel;
  readonly items: readonly ProcurementPurchaseItemReadModel[];
  readonly supplierPerformance?: SupplierPerformanceObservation;
  readonly policy: ProcurementIntelligencePolicy;
  readonly asOf: Date | string;
  readonly createdAt: string;
}

export interface ProcurementIntelligenceReport {
  readonly purchaseId: string;
  readonly supplierId: string;
  readonly context: IntelligenceContext;
  readonly metrics: ProcurementIntelligenceMetrics;
  readonly signals: readonly ProcurementIntelligenceSignal[];
  readonly evidence: readonly IntelligenceEvidence[];
  readonly recommendations: readonly IntelligenceRecommendation[];
  readonly governance: ProcurementIntelligenceGovernance;
}

function requireText(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}

function requireFiniteNonNegative(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a finite non-negative number.`);
  }
  return value;
}

function requirePercent(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`${label} must be a finite percentage from 0 to 100.`);
  }
  return value;
}

function parseDate(value: Date | string, label: string): Date {
  const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`${label} must be a valid date.`);
  return parsed;
}

function parseOptionalDay(value: string | null, label: string): Date | null {
  if (value === null) return null;
  return parseDate(`${value}T00:00:00.000Z`, label);
}

function validatePolicy(
  policy: ProcurementIntelligencePolicy,
): ProcurementIntelligencePolicy {
  return Object.freeze({
    overdueGraceDays: requireFiniteNonNegative(
      policy.overdueGraceDays,
      'overdueGraceDays',
    ),
    costIncreaseWarningPercent: requirePercent(
      policy.costIncreaseWarningPercent,
      'costIncreaseWarningPercent',
    ),
    supplierOverdueRateWarningPercent: requirePercent(
      policy.supplierOverdueRateWarningPercent,
      'supplierOverdueRateWarningPercent',
    ),
  });
}

function confidenceFor(
  hasCostComparison: boolean,
  hasSupplierPerformance: boolean,
): Confidence {
  const score = hasCostComparison && hasSupplierPerformance
    ? 0.95
    : hasCostComparison || hasSupplierPerformance
      ? 0.9
      : 0.85;

  return Object.freeze({
    score,
    band: score >= 0.9 ? 'VERY_HIGH' : 'HIGH',
    rationale: Object.freeze([
      'Purchase and Purchase Item inputs come from the governed Procurement read boundary.',
      hasCostComparison
        ? 'Quoted and final costs provide explicit comparable receipt evidence.'
        : 'No complete quoted/final receipt comparison is available; cost change is not invented.',
      hasSupplierPerformance
        ? 'Supplier performance observation is explicitly supplied as a read model.'
        : 'Supplier history is absent; supplier performance patterns are not inferred from one purchase.',
    ]),
  });
}

function riskFor(kind: ProcurementIntelligenceSignalKind): IntelligenceRisk {
  if (kind === 'PURCHASE_INTEGRITY_ANOMALY') {
    return Object.freeze({
      level: 'R4',
      reasons: Object.freeze([
        'Repairing purchase/inventory state may require governed operational mutations.',
        'Intelligence must not rewrite purchase receipts or inventory movements automatically.',
      ]),
      requiresHumanReview: true,
    });
  }

  if (
    kind === 'RECEIPT_OVERDUE'
    || kind === 'COST_INCREASE'
    || kind === 'SUPPLIER_DELAY_PATTERN'
  ) {
    return Object.freeze({
      level: 'R2',
      reasons: Object.freeze([
        'This finding may influence a procurement or supplier decision.',
        'The recommendation remains advisory and requires human review before governed action.',
      ]),
      requiresHumanReview: true,
    });
  }

  return Object.freeze({
    level: 'R1',
    reasons: Object.freeze([
      'This is a read-only procurement observation and does not mutate canonical state.',
    ]),
    requiresHumanReview: false,
  });
}

function actionTypeFor(kind: ProcurementIntelligenceSignalKind): string {
  switch (kind) {
    case 'PURCHASE_INTEGRITY_ANOMALY':
      return 'REVIEW_PURCHASE_INTEGRITY';
    case 'RECEIPT_OVERDUE':
      return 'REVIEW_OVERDUE_PURCHASE';
    case 'PARTIAL_RECEIPT':
      return 'REVIEW_PARTIAL_RECEIPT';
    case 'COST_INCREASE':
      return 'REVIEW_PURCHASE_COST_INCREASE';
    case 'COST_DECREASE':
      return 'REVIEW_PURCHASE_COST_DECREASE';
    case 'SUPPLIER_DELAY_PATTERN':
      return 'REVIEW_SUPPLIER_DELIVERY_PATTERN';
  }
}

function priorityFor(
  kind: ProcurementIntelligenceSignalKind,
): IntelligenceRecommendation['priority'] {
  switch (kind) {
    case 'PURCHASE_INTEGRITY_ANOMALY':
      return 'P1';
    case 'RECEIPT_OVERDUE':
    case 'COST_INCREASE':
    case 'SUPPLIER_DELAY_PATTERN':
      return 'P2';
    case 'PARTIAL_RECEIPT':
      return 'P3';
    case 'COST_DECREASE':
      return 'P4';
  }
}

function canonicalSignalOrder(kind: ProcurementIntelligenceSignalKind): number {
  return [
    'PURCHASE_INTEGRITY_ANOMALY',
    'RECEIPT_OVERDUE',
    'SUPPLIER_DELAY_PATTERN',
    'COST_INCREASE',
    'PARTIAL_RECEIPT',
    'COST_DECREASE',
  ].indexOf(kind);
}

function stableFingerprint(parts: readonly (string | number | null)[]): string {
  const text = parts.map((part) => String(part ?? '')).join('|');
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function analyzeProcurementIntelligence(
  input: ProcurementIntelligenceInput,
): ProcurementIntelligenceReport {
  const correlationId = requireText(input.correlationId, 'correlationId');
  const purchaseId = requireText(input.purchase.id, 'purchase.id');
  const purchaseNumber = requireText(
    input.purchase.purchaseNumber,
    'purchase.purchaseNumber',
  );
  const supplierId = requireText(input.purchase.supplierId, 'purchase.supplierId');
  const createdAt = requireText(input.createdAt, 'createdAt');
  parseDate(createdAt, 'createdAt');
  const asOf = parseDate(input.asOf, 'asOf');
  const policy = validatePolicy(input.policy);
  const expectedDate = parseOptionalDay(
    input.purchase.expectedDate,
    'purchase.expectedDate',
  );
  if (input.purchase.receivedAt !== null) {
    parseDate(input.purchase.receivedAt, 'purchase.receivedAt');
  }

  const seenItemIds = new Set<string>();
  let requestedUnits = 0;
  let receivedUnits = 0;
  let observedQuotedReceiptValue = 0;
  let observedFinalReceiptValue = 0;
  let comparableReceiptLines = 0;
  let integrityIssue = false;

  for (const item of input.items) {
    const itemId = requireText(item.id, 'item.id');
    if (seenItemIds.has(itemId)) {
      throw new Error('Purchase Item IDs must be unique.');
    }
    seenItemIds.add(itemId);

    if (item.purchaseId !== purchaseId) {
      throw new Error('Every Purchase Item must belong to the requested purchase.');
    }
    requireText(item.productId, 'item.productId');

    const requested = requireFiniteNonNegative(
      item.quantityRequested,
      'item.quantityRequested',
    );
    const received = requireFiniteNonNegative(
      item.quantityReceived,
      'item.quantityReceived',
    );
    if (!Number.isInteger(requested) || !Number.isInteger(received)) {
      throw new Error('Purchase quantities must be integers.');
    }
    if (received > requested) integrityIssue = true;

    if (item.quotedUnitCost !== null) {
      requireFiniteNonNegative(item.quotedUnitCost, 'item.quotedUnitCost');
    }
    if (item.finalUnitCost !== null) {
      requireFiniteNonNegative(item.finalUnitCost, 'item.finalUnitCost');
    }

    requestedUnits += requested;
    receivedUnits += received;

    if (
      received > 0
      && item.quotedUnitCost !== null
      && item.finalUnitCost !== null
    ) {
      observedQuotedReceiptValue += received * item.quotedUnitCost;
      observedFinalReceiptValue += received * item.finalUnitCost;
      comparableReceiptLines += 1;
    }
  }

  const remainingUnits = Math.max(0, requestedUnits - receivedUnits);
  const receiptProgressPercent = requestedUnits === 0
    ? 0
    : Math.min(100, Math.round((receivedUnits / requestedUnits) * 100));

  if (input.items.length === 0 && input.purchase.status !== 'CANCELLED') {
    integrityIssue = true;
  }
  if (input.purchase.status === 'DRAFT' && receivedUnits > 0) {
    integrityIssue = true;
  }
  if (input.purchase.status === 'RECEIVED' && remainingUnits > 0) {
    integrityIssue = true;
  }
  if (
    ['CONFIRMED', 'PARTIALLY_RECEIVED'].includes(input.purchase.status)
    && remainingUnits === 0
    && requestedUnits > 0
  ) {
    integrityIssue = true;
  }

  const hasCostComparison = comparableReceiptLines > 0;
  const quotedReceiptValue = hasCostComparison ? observedQuotedReceiptValue : null;
  const finalReceiptValue = hasCostComparison ? observedFinalReceiptValue : null;
  const observedCostVarianceAmount = hasCostComparison
    ? observedFinalReceiptValue - observedQuotedReceiptValue
    : null;
  const observedCostVariancePercent =
    hasCostComparison && observedQuotedReceiptValue > 0
      ? ((observedFinalReceiptValue - observedQuotedReceiptValue)
        / observedQuotedReceiptValue) * 100
      : null;

  let supplierOverdueRatePercent: number | null = null;
  let supplierAverageReceiptDelayDays: number | null = null;
  if (input.supplierPerformance) {
    if (input.supplierPerformance.supplierId !== supplierId) {
      throw new Error(
        'Supplier performance observation must belong to the purchase supplier.',
      );
    }
    const purchaseCount = requireFiniteNonNegative(
      input.supplierPerformance.purchaseCount,
      'supplierPerformance.purchaseCount',
    );
    const overduePurchaseCount = requireFiniteNonNegative(
      input.supplierPerformance.overduePurchaseCount,
      'supplierPerformance.overduePurchaseCount',
    );
    const receivedPurchaseCount = requireFiniteNonNegative(
      input.supplierPerformance.receivedPurchaseCount,
      'supplierPerformance.receivedPurchaseCount',
    );
    if (
      !Number.isInteger(purchaseCount)
      || !Number.isInteger(overduePurchaseCount)
      || !Number.isInteger(receivedPurchaseCount)
    ) {
      throw new Error('Supplier performance counts must be integers.');
    }
    if (
      overduePurchaseCount > purchaseCount
      || receivedPurchaseCount > purchaseCount
    ) {
      throw new Error(
        'Supplier performance counts cannot exceed purchaseCount.',
      );
    }

    supplierOverdueRatePercent = purchaseCount === 0
      ? null
      : (overduePurchaseCount / purchaseCount) * 100;

    if (
      input.supplierPerformance.averageReceiptDelayDays !== undefined
      && input.supplierPerformance.averageReceiptDelayDays !== null
    ) {
      supplierAverageReceiptDelayDays = requireFiniteNonNegative(
        input.supplierPerformance.averageReceiptDelayDays,
        'supplierPerformance.averageReceiptDelayDays',
      );
    }
  }

  const signals: ProcurementIntelligenceSignal[] = [];

  if (integrityIssue) {
    signals.push({
      kind: 'PURCHASE_INTEGRITY_ANOMALY',
      severity: 'CRITICAL',
      title: 'Purchase state requires integrity review',
      explanation:
        'Purchase status, lines, or accumulated receipt quantities are internally inconsistent and must be reviewed before any corrective action.',
      rationale: Object.freeze([
        `Status=${input.purchase.status}.`,
        `Items=${input.items.length}.`,
        `Requested units=${requestedUnits}.`,
        `Received units=${receivedUnits}.`,
        `Remaining units=${remainingUnits}.`,
      ]),
    });
  }

  const overdue =
    expectedDate !== null
    && ['CONFIRMED', 'PARTIALLY_RECEIVED'].includes(input.purchase.status)
    && remainingUnits > 0
    && asOf.getTime()
      > expectedDate.getTime() + policy.overdueGraceDays * 86_400_000;

  if (overdue) {
    signals.push({
      kind: 'RECEIPT_OVERDUE',
      severity: 'WARNING',
      title: 'Purchase receipt is overdue',
      explanation:
        'The purchase still has units pending after the explicit expected-date grace policy.',
      rationale: Object.freeze([
        `Expected date=${input.purchase.expectedDate}.`,
        `Grace days=${policy.overdueGraceDays}.`,
        `Remaining units=${remainingUnits}.`,
      ]),
    });
  }

  if (receivedUnits > 0 && remainingUnits > 0) {
    signals.push({
      kind: 'PARTIAL_RECEIPT',
      severity: 'INFO',
      title: 'Purchase is partially received',
      explanation:
        'Receipt progress is incomplete; only physically received units may advance through governed inventory receipt.',
      rationale: Object.freeze([
        `Received units=${receivedUnits}.`,
        `Requested units=${requestedUnits}.`,
        `Receipt progress=${receiptProgressPercent}%.`,
      ]),
    });
  }

  if (
    observedCostVariancePercent !== null
    && observedCostVariancePercent >= policy.costIncreaseWarningPercent
  ) {
    signals.push({
      kind: 'COST_INCREASE',
      severity: 'WARNING',
      title: 'Observed purchase cost increased',
      explanation:
        'Comparable received lines show a final unit-cost increase against their quoted unit cost.',
      rationale: Object.freeze([
        `Observed variance=${observedCostVariancePercent.toFixed(2)}%.`,
        `Warning threshold=${policy.costIncreaseWarningPercent}%.`,
        'Only received lines with both quoted and final cost are compared.',
      ]),
    });
  } else if (
    observedCostVariancePercent !== null
    && observedCostVariancePercent < 0
  ) {
    signals.push({
      kind: 'COST_DECREASE',
      severity: 'INFO',
      title: 'Observed purchase cost decreased',
      explanation:
        'Comparable received lines show a lower final cost than their quoted cost.',
      rationale: Object.freeze([
        `Observed variance=${observedCostVariancePercent.toFixed(2)}%.`,
        'Only received lines with both quoted and final cost are compared.',
      ]),
    });
  }

  if (
    supplierOverdueRatePercent !== null
    && supplierOverdueRatePercent >= policy.supplierOverdueRateWarningPercent
  ) {
    signals.push({
      kind: 'SUPPLIER_DELAY_PATTERN',
      severity: 'WARNING',
      title: 'Supplier delivery pattern requires review',
      explanation:
        'The explicitly supplied supplier history meets or exceeds the overdue-rate warning policy.',
      rationale: Object.freeze([
        `Supplier overdue rate=${supplierOverdueRatePercent.toFixed(2)}%.`,
        `Warning threshold=${policy.supplierOverdueRateWarningPercent}%.`,
        `Historical purchases=${input.supplierPerformance!.purchaseCount}.`,
      ]),
    });
  }

  signals.sort(
    (left, right) =>
      canonicalSignalOrder(left.kind) - canonicalSignalOrder(right.kind),
  );

  const context: IntelligenceContext = Object.freeze({
    contextId: `purchase:${purchaseId}`,
    type: 'PURCHASE',
    entityId: purchaseId,
    attributes: Object.freeze({
      purchaseId,
      purchaseNumber,
      supplierId,
      status: input.purchase.status,
      asOf: asOf.toISOString(),
    }),
  });

  const confidence = confidenceFor(
    hasCostComparison,
    input.supplierPerformance !== undefined,
  );

  const evidence = signals.map<IntelligenceEvidence>((signal, index) =>
    Object.freeze({
      evidenceId: `procurement:${purchaseId}:${signal.kind.toLowerCase()}:${index + 1}`,
      correlationId,
      context,
      capability: 'ANALYTICS',
      sourceAuthority: Object.freeze({
        level: 'FIRST_PARTY',
        sourceName: 'LIHEN Procurement Read Model',
        rationale: Object.freeze([
          'Purchase, items, and optional supplier history come from governed read boundaries.',
          'The capability is persistence-neutral and does not acquire operational write authority.',
        ]),
      }),
      observation: signal.explanation,
      payload: Object.freeze({
        signalKind: signal.kind,
        requestedUnits,
        receivedUnits,
        remainingUnits,
        observedCostVariancePercent,
        supplierOverdueRatePercent,
      }),
      confidence,
      fingerprint: stableFingerprint([
        purchaseId,
        supplierId,
        signal.kind,
        requestedUnits,
        receivedUnits,
        observedCostVariancePercent,
        supplierOverdueRatePercent,
      ]),
      createdAt,
    }),
  );

  const recommendations = signals.map<IntelligenceRecommendation>(
    (signal, index) => {
      const evidenceId = evidence[index]!.evidenceId;
      return Object.freeze({
        recommendationId: `procurement:${purchaseId}:${signal.kind.toLowerCase()}:recommendation`,
        correlationId,
        context,
        actionType: actionTypeFor(signal.kind),
        title: signal.title,
        explanation: signal.explanation,
        priority: priorityFor(signal.kind),
        severity: signal.severity,
        source: 'LIHEN Procurement Intelligence',
        rationale: signal.rationale,
        evidenceIds: Object.freeze([evidenceId]),
        confidence,
        risk: riskFor(signal.kind),
        status: 'OPEN',
        createdAt,
      });
    },
  );

  return Object.freeze({
    purchaseId,
    supplierId,
    context,
    metrics: Object.freeze({
      requestedUnits,
      receivedUnits,
      remainingUnits,
      receiptProgressPercent,
      observedQuotedReceiptValue: quotedReceiptValue,
      observedFinalReceiptValue: finalReceiptValue,
      observedCostVarianceAmount,
      observedCostVariancePercent,
      supplierOverdueRatePercent,
      supplierAverageReceiptDelayDays,
    }),
    signals: Object.freeze(signals),
    evidence: Object.freeze(evidence),
    recommendations: Object.freeze(recommendations),
    governance: Object.freeze({
      canAutoConfirmPurchase: false,
      canAutoReceivePurchase: false,
      canAutoPostInventory: false,
      canAutoPostFinance: false,
      canAutoChangeSupplierCost: false,
    }),
  });
}
