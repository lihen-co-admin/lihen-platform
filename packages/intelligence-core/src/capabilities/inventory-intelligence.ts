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
 * WAVE 8 / GAP-027 — Inventory Intelligence.
 *
 * Pure ANALYTICS over governed Inventory read models.
 * It never records inventory movements, mutates stock, calls RPCs, or persists data.
 * Any suggested operational action remains advisory and subject to governed execution.
 */

export type InventoryIntelligenceBucket = 'ON_HAND' | 'RESERVED' | 'PENDING_IN';

export interface InventoryBalanceReadModel {
  readonly productId: string;
  readonly stockOnHand: number;
  readonly stockReserved: number;
  readonly stockPending: number;
  readonly stockAvailable: number;
}

export interface InventoryMovementReadModel {
  readonly id: string;
  readonly productId: string;
  readonly bucket: InventoryIntelligenceBucket;
  readonly quantityDelta: number;
  readonly occurredAt: Date | string;
}

export interface InventoryDemandObservation {
  readonly unitsSold: number;
  readonly windowDays: number;
}

export interface InventoryIntelligencePolicy {
  readonly criticalAvailableThreshold: number;
  readonly overstockDaysOfCoverThreshold: number;
  readonly immobileDaysThreshold: number;
  readonly replenishmentTargetDaysOfCover: number;
}

export type InventoryIntelligenceSignalKind =
  | 'INTEGRITY_ANOMALY'
  | 'CRITICAL_STOCK'
  | 'ROTATION_OBSERVED'
  | 'OVERSTOCK'
  | 'IMMOBILE_STOCK'
  | 'STOCKOUT_PROJECTION'
  | 'REPLENISHMENT_SUGGESTED';

export interface InventoryIntelligenceSignal {
  readonly kind: InventoryIntelligenceSignalKind;
  readonly severity: IntelligenceSeverity;
  readonly title: string;
  readonly explanation: string;
  readonly rationale: readonly string[];
}

export interface InventoryIntelligenceMetrics {
  readonly averageDailyDemand: number | null;
  readonly daysOfCover: number | null;
  readonly daysSinceLastMovement: number | null;
  readonly projectedStockoutDays: number | null;
  readonly suggestedReplenishmentQuantity: number | null;
}

export interface InventoryIntelligenceInput {
  readonly correlationId: CorrelationId;
  readonly productId: string;
  readonly balance: InventoryBalanceReadModel;
  readonly movements: readonly InventoryMovementReadModel[];
  readonly demand?: InventoryDemandObservation;
  readonly policy: InventoryIntelligencePolicy;
  readonly asOf: Date | string;
  readonly createdAt: string;
}

export interface InventoryIntelligenceReport {
  readonly productId: string;
  readonly context: IntelligenceContext;
  readonly metrics: InventoryIntelligenceMetrics;
  readonly signals: readonly InventoryIntelligenceSignal[];
  readonly evidence: readonly IntelligenceEvidence[];
  readonly recommendations: readonly IntelligenceRecommendation[];
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

function requirePositive(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a finite positive number.`);
  }
  return value;
}

function parseDate(value: Date | string, label: string): Date {
  const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`${label} must be a valid date.`);
  return parsed;
}

function validatePolicy(policy: InventoryIntelligencePolicy): InventoryIntelligencePolicy {
  return Object.freeze({
    criticalAvailableThreshold: requireFiniteNonNegative(
      policy.criticalAvailableThreshold,
      'criticalAvailableThreshold',
    ),
    overstockDaysOfCoverThreshold: requirePositive(
      policy.overstockDaysOfCoverThreshold,
      'overstockDaysOfCoverThreshold',
    ),
    immobileDaysThreshold: requirePositive(
      policy.immobileDaysThreshold,
      'immobileDaysThreshold',
    ),
    replenishmentTargetDaysOfCover: requirePositive(
      policy.replenishmentTargetDaysOfCover,
      'replenishmentTargetDaysOfCover',
    ),
  });
}

function confidenceFor(hasDemand: boolean, hasMovements: boolean): Confidence {
  const score = hasDemand && hasMovements ? 0.95 : hasDemand || hasMovements ? 0.9 : 0.85;
  return Object.freeze({
    score,
    band: score >= 0.9 ? 'VERY_HIGH' : 'HIGH',
    rationale: Object.freeze([
      'Inventory balance comes from the governed Inventory read model.',
      hasDemand
        ? 'Demand observation is present for rotation and projection.'
        : 'Demand observation is absent; demand-based signals are not inferred.',
      hasMovements
        ? 'Movement history is present for recency analysis.'
        : 'Movement history is empty; immobility is not inferred.',
    ]),
  });
}

function riskFor(kind: InventoryIntelligenceSignalKind): IntelligenceRisk {
  if (kind === 'INTEGRITY_ANOMALY') {
    return Object.freeze({
      level: 'R4',
      reasons: Object.freeze([
        'Correcting an inventory anomaly may require a governed inventory mutation.',
        'Intelligence must not create or repair inventory movements automatically.',
      ]),
      requiresHumanReview: true,
    });
  }

  if (kind === 'REPLENISHMENT_SUGGESTED') {
    return Object.freeze({
      level: 'R3',
      reasons: Object.freeze([
        'A replenishment decision may create economic or procurement commitments.',
        'The recommendation is advisory and requires governed human execution.',
      ]),
      requiresHumanReview: true,
    });
  }

  return Object.freeze({
    level: 'R1',
    reasons: Object.freeze([
      'This is a read-only analytical signal and does not mutate Inventory.',
    ]),
    requiresHumanReview: false,
  });
}

function actionTypeFor(kind: InventoryIntelligenceSignalKind): string {
  switch (kind) {
    case 'INTEGRITY_ANOMALY':
      return 'REVIEW_INVENTORY_INTEGRITY';
    case 'CRITICAL_STOCK':
      return 'REVIEW_CRITICAL_STOCK';
    case 'ROTATION_OBSERVED':
      return 'REVIEW_INVENTORY_ROTATION';
    case 'OVERSTOCK':
      return 'REVIEW_OVERSTOCK';
    case 'IMMOBILE_STOCK':
      return 'REVIEW_IMMOBILE_STOCK';
    case 'STOCKOUT_PROJECTION':
      return 'REVIEW_STOCKOUT_PROJECTION';
    case 'REPLENISHMENT_SUGGESTED':
      return 'REVIEW_REPLENISHMENT_SUGGESTION';
  }
}

function priorityFor(
  kind: InventoryIntelligenceSignalKind,
): IntelligenceRecommendation['priority'] {
  switch (kind) {
    case 'INTEGRITY_ANOMALY':
      return 'P1';
    case 'CRITICAL_STOCK':
    case 'REPLENISHMENT_SUGGESTED':
      return 'P2';
    case 'OVERSTOCK':
    case 'IMMOBILE_STOCK':
    case 'STOCKOUT_PROJECTION':
      return 'P3';
    case 'ROTATION_OBSERVED':
      return 'P4';
  }
}

function canonicalSignalOrder(kind: InventoryIntelligenceSignalKind): number {
  return [
    'INTEGRITY_ANOMALY',
    'CRITICAL_STOCK',
    'REPLENISHMENT_SUGGESTED',
    'STOCKOUT_PROJECTION',
    'OVERSTOCK',
    'IMMOBILE_STOCK',
    'ROTATION_OBSERVED',
  ].indexOf(kind);
}

function daysBetween(later: Date, earlier: Date): number {
  return Math.max(0, (later.getTime() - earlier.getTime()) / 86_400_000);
}

export function analyzeInventoryIntelligence(
  input: InventoryIntelligenceInput,
): InventoryIntelligenceReport {
  const productId = requireText(input.productId, 'productId');
  const correlationId = requireText(input.correlationId, 'correlationId');
  const createdAt = requireText(input.createdAt, 'createdAt');
  parseDate(createdAt, 'createdAt');
  const asOf = parseDate(input.asOf, 'asOf');
  const policy = validatePolicy(input.policy);

  if (input.balance.productId !== productId) {
    throw new Error('Inventory balance productId must match the requested productId.');
  }

  const stockOnHand = requireFiniteNonNegative(input.balance.stockOnHand, 'stockOnHand');
  const stockReserved = requireFiniteNonNegative(input.balance.stockReserved, 'stockReserved');
  const stockPending = requireFiniteNonNegative(input.balance.stockPending, 'stockPending');
  const stockAvailable = requireFiniteNonNegative(
    input.balance.stockAvailable,
    'stockAvailable',
  );

  for (const movement of input.movements) {
    if (movement.productId !== productId) {
      throw new Error('Every Inventory movement must belong to the requested productId.');
    }
    if (!Number.isFinite(movement.quantityDelta)) {
      throw new Error('Inventory movement quantityDelta must be finite.');
    }
    parseDate(movement.occurredAt, 'movement.occurredAt');
  }

  let averageDailyDemand: number | null = null;
  if (input.demand) {
    const unitsSold = requireFiniteNonNegative(input.demand.unitsSold, 'demand.unitsSold');
    const windowDays = requirePositive(input.demand.windowDays, 'demand.windowDays');
    averageDailyDemand = unitsSold / windowDays;
  }

  const latestMovement = input.movements
    .map((movement) => parseDate(movement.occurredAt, 'movement.occurredAt'))
    .sort((left, right) => right.getTime() - left.getTime())[0];

  const daysSinceLastMovement = latestMovement
    ? daysBetween(asOf, latestMovement)
    : null;

  const daysOfCover =
    averageDailyDemand !== null && averageDailyDemand > 0
      ? stockAvailable / averageDailyDemand
      : null;

  const projectedStockoutDays = daysOfCover;

  const replenishmentBase =
    averageDailyDemand !== null && averageDailyDemand > 0
      ? Math.ceil(averageDailyDemand * policy.replenishmentTargetDaysOfCover)
      : null;

  const suggestedReplenishmentQuantity =
    replenishmentBase === null
      ? null
      : Math.max(0, replenishmentBase - stockAvailable - stockPending);

  const signals: InventoryIntelligenceSignal[] = [];
  const expectedAvailable = stockOnHand - stockReserved;

  if (stockReserved > stockOnHand || stockAvailable !== expectedAvailable) {
    signals.push({
      kind: 'INTEGRITY_ANOMALY',
      severity: 'CRITICAL',
      title: 'Inventory balance requires integrity review',
      explanation:
        'The governed balance is internally inconsistent and must be reviewed before any corrective inventory action.',
      rationale: Object.freeze([
        `ON_HAND=${stockOnHand}.`,
        `RESERVED=${stockReserved}.`,
        `AVAILABLE=${stockAvailable}.`,
        `Expected AVAILABLE from ON_HAND - RESERVED=${expectedAvailable}.`,
      ]),
    });
  }

  if (stockAvailable <= policy.criticalAvailableThreshold) {
    signals.push({
      kind: 'CRITICAL_STOCK',
      severity: 'WARNING',
      title: 'Critical available stock detected',
      explanation:
        'Available stock is at or below the explicit critical-stock policy threshold.',
      rationale: Object.freeze([
        `AVAILABLE=${stockAvailable}.`,
        `Critical threshold=${policy.criticalAvailableThreshold}.`,
      ]),
    });
  }

  if (averageDailyDemand !== null) {
    signals.push({
      kind: 'ROTATION_OBSERVED',
      severity: 'INFO',
      title: 'Inventory rotation observed',
      explanation:
        'Rotation is derived only from the supplied demand observation; no demand is invented from Inventory movements.',
      rationale: Object.freeze([
        `Average daily demand=${averageDailyDemand.toFixed(4)}.`,
        `Observation window=${input.demand!.windowDays} days.`,
        `Units sold=${input.demand!.unitsSold}.`,
      ]),
    });
  }

  if (
    daysOfCover !== null
    && daysOfCover >= policy.overstockDaysOfCoverThreshold
    && stockAvailable > policy.criticalAvailableThreshold
  ) {
    signals.push({
      kind: 'OVERSTOCK',
      severity: 'WARNING',
      title: 'Potential overstock detected',
      explanation:
        'Days of cover meet or exceed the explicit overstock policy threshold.',
      rationale: Object.freeze([
        `Days of cover=${daysOfCover.toFixed(2)}.`,
        `Overstock threshold=${policy.overstockDaysOfCoverThreshold} days.`,
      ]),
    });
  }

  if (
    stockOnHand > 0
    && daysSinceLastMovement !== null
    && daysSinceLastMovement >= policy.immobileDaysThreshold
  ) {
    signals.push({
      kind: 'IMMOBILE_STOCK',
      severity: 'WARNING',
      title: 'Potential immobile inventory detected',
      explanation:
        'Stock exists and the last governed inventory movement is older than the explicit immobility threshold.',
      rationale: Object.freeze([
        `Days since last movement=${daysSinceLastMovement.toFixed(2)}.`,
        `Immobility threshold=${policy.immobileDaysThreshold} days.`,
      ]),
    });
  }

  if (projectedStockoutDays !== null) {
    signals.push({
      kind: 'STOCKOUT_PROJECTION',
      severity:
        projectedStockoutDays <= policy.replenishmentTargetDaysOfCover
          ? 'WARNING'
          : 'INFO',
      title: 'Stockout projection available',
      explanation:
        'Projected cover is derived from available stock and the supplied demand observation.',
      rationale: Object.freeze([
        `Projected stockout in ${projectedStockoutDays.toFixed(2)} days at observed demand.`,
      ]),
    });
  }

  if (
    suggestedReplenishmentQuantity !== null
    && suggestedReplenishmentQuantity > 0
  ) {
    signals.push({
      kind: 'REPLENISHMENT_SUGGESTED',
      severity: 'WARNING',
      title: 'Replenishment review suggested',
      explanation:
        'The suggested quantity restores the explicit target days of cover after considering available and pending stock. It is advisory only.',
      rationale: Object.freeze([
        `Suggested quantity=${suggestedReplenishmentQuantity}.`,
        `Target cover=${policy.replenishmentTargetDaysOfCover} days.`,
        `AVAILABLE=${stockAvailable}.`,
        `PENDING_IN=${stockPending}.`,
      ]),
    });
  }

  signals.sort(
    (left, right) =>
      canonicalSignalOrder(left.kind) - canonicalSignalOrder(right.kind),
  );

  const context: IntelligenceContext = Object.freeze({
    contextId: `inventory:${productId}`,
    type: 'INVENTORY',
    entityId: productId,
    attributes: Object.freeze({
      productId,
      asOf: asOf.toISOString(),
    }),
  });

  const confidence = confidenceFor(Boolean(input.demand), input.movements.length > 0);

  const evidence = signals.map<IntelligenceEvidence>((signal, index) =>
    Object.freeze({
      evidenceId: `inventory:${productId}:${signal.kind.toLowerCase()}:${index + 1}`,
      correlationId,
      context,
      capability: 'ANALYTICS',
      sourceAuthority: Object.freeze({
        level: 'FIRST_PARTY',
        sourceName: 'LIHEN Inventory Read Model',
        rationale: Object.freeze([
          'Balance and movement inputs originate from the governed Inventory read boundary.',
          'The capability is persistence-neutral and does not acquire write authority.',
        ]),
      }),
      observation: signal.explanation,
      payload: Object.freeze({
        signalKind: signal.kind,
        metrics: Object.freeze({
          averageDailyDemand,
          daysOfCover,
          daysSinceLastMovement,
          projectedStockoutDays,
          suggestedReplenishmentQuantity,
        }),
      }),
      confidence,
      fingerprint: [
        productId,
        signal.kind,
        stockOnHand,
        stockReserved,
        stockPending,
        stockAvailable,
        asOf.toISOString(),
      ].join('|'),
      createdAt,
    }),
  );

  const recommendations = signals.map<IntelligenceRecommendation>(
    (signal, index) =>
      Object.freeze({
        recommendationId: `inventory:${productId}:${signal.kind.toLowerCase()}:recommendation:${index + 1}`,
        correlationId,
        context,
        actionType: actionTypeFor(signal.kind),
        title: signal.title,
        explanation: signal.explanation,
        priority: priorityFor(signal.kind),
        severity: signal.severity,
        source: 'LIHEN Inventory Intelligence',
        rationale: signal.rationale,
        evidenceIds: Object.freeze([evidence[index]!.evidenceId]),
        confidence,
        risk: riskFor(signal.kind),
        status: 'OPEN',
        createdAt,
      }),
  );

  return Object.freeze({
    productId,
    context,
    metrics: Object.freeze({
      averageDailyDemand,
      daysOfCover,
      daysSinceLastMovement,
      projectedStockoutDays,
      suggestedReplenishmentQuantity,
    }),
    signals: Object.freeze(signals),
    evidence: Object.freeze(evidence),
    recommendations: Object.freeze(recommendations),
  });
}
