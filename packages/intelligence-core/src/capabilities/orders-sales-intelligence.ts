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
 * WAVE 8 / GAP-029 — Orders & Sales Intelligence.
 *
 * Pure ANALYTICS over governed Order/Sale read models and existing commerce
 * reconciliation observations. It does not create/confirm/cancel orders,
 * complete/reverse sales, move inventory, post finance, or call persistence/RPC.
 */
export type OrdersSalesOrderStatus =
  | 'DRAFT'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY'
  | 'COMPLETED'
  | 'CANCELLED';

export type OrdersSalesSaleStatus = 'COMPLETED' | 'REVERSED';

export interface OrdersSalesOrderReadModel {
  readonly id: string;
  readonly orderNumber: string;
  readonly status: OrdersSalesOrderStatus;
  readonly updatedAt: Date | string;
}

export interface OrdersSalesSaleReadModel {
  readonly id: string;
  readonly saleNumber: string;
  readonly orderId: string | null;
  readonly status: OrdersSalesSaleStatus;
  readonly occurredAt: Date | string;
  readonly totalAmount: number;
}

export type OrdersSalesReconciliationStatus = 'PASS' | 'REVIEW' | 'BLOCKED';

export interface CommerceReconciliationObservation {
  readonly saleId: string;
  readonly status: OrdersSalesReconciliationStatus;
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
}

export interface OrderCancellationReconciliationObservation {
  readonly orderId: string;
  readonly status: OrdersSalesReconciliationStatus;
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
}

export interface OrdersSalesIntelligencePolicy {
  readonly activeOrderAttentionHours: number;
  readonly readyOrderAttentionHours: number;
}

export type OrdersSalesIntelligenceSignalKind =
  | 'ORDER_INTEGRITY_ANOMALY'
  | 'ORDER_ATTENTION_REQUIRED'
  | 'ORDER_READY_FOR_SALE'
  | 'COMMERCE_RECONCILIATION_BLOCKED'
  | 'COMMERCE_RECONCILIATION_REVIEW'
  | 'CANCELLATION_RECONCILIATION_BLOCKED'
  | 'REVERSED_SALE_AUDIT';

export interface OrdersSalesIntelligenceSignal {
  readonly kind: OrdersSalesIntelligenceSignalKind;
  readonly severity: IntelligenceSeverity;
  readonly entityId: string;
  readonly title: string;
  readonly explanation: string;
  readonly rationale: readonly string[];
}

export interface OrdersSalesIntelligenceMetrics {
  readonly totalOrders: number;
  readonly draftOrders: number;
  readonly activeOrders: number;
  readonly saleEligibleOrders: number;
  readonly completedOrders: number;
  readonly cancelledOrders: number;
  readonly staleActiveOrders: number;
  readonly totalSales: number;
  readonly completedSales: number;
  readonly reversedSales: number;
  readonly observedCompletedSalesAmount: number;
  readonly blockedCommerceReconciliations: number;
  readonly reviewCommerceReconciliations: number;
  readonly blockedCancellationReconciliations: number;
}

export interface OrdersSalesIntelligenceGovernance {
  readonly canAutoCreateOrder: false;
  readonly canAutoConfirmOrder: false;
  readonly canAutoCancelOrder: false;
  readonly canAutoCompleteSale: false;
  readonly canAutoReverseSale: false;
  readonly canAutoMoveInventory: false;
  readonly canAutoPostFinance: false;
}

export interface OrdersSalesIntelligenceInput {
  readonly correlationId: CorrelationId;
  readonly orders: readonly OrdersSalesOrderReadModel[];
  readonly sales: readonly OrdersSalesSaleReadModel[];
  readonly commerceReconciliations?: readonly CommerceReconciliationObservation[];
  readonly cancellationReconciliations?: readonly OrderCancellationReconciliationObservation[];
  readonly policy: OrdersSalesIntelligencePolicy;
  readonly asOf: Date | string;
  readonly createdAt: string;
}

export interface OrdersSalesIntelligenceReport {
  readonly context: IntelligenceContext;
  readonly metrics: OrdersSalesIntelligenceMetrics;
  readonly signals: readonly OrdersSalesIntelligenceSignal[];
  readonly evidence: readonly IntelligenceEvidence[];
  readonly recommendations: readonly IntelligenceRecommendation[];
  readonly governance: OrdersSalesIntelligenceGovernance;
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

function stableFingerprint(parts: readonly (string | number | null)[]): string {
  const text = parts.map((part) => String(part ?? '')).join('|');
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function canonicalSignalOrder(kind: OrdersSalesIntelligenceSignalKind): number {
  return [
    'ORDER_INTEGRITY_ANOMALY',
    'COMMERCE_RECONCILIATION_BLOCKED',
    'CANCELLATION_RECONCILIATION_BLOCKED',
    'REVERSED_SALE_AUDIT',
    'ORDER_ATTENTION_REQUIRED',
    'COMMERCE_RECONCILIATION_REVIEW',
    'ORDER_READY_FOR_SALE',
  ].indexOf(kind);
}

function priorityFor(
  kind: OrdersSalesIntelligenceSignalKind,
): IntelligenceRecommendation['priority'] {
  switch (kind) {
    case 'ORDER_INTEGRITY_ANOMALY':
    case 'COMMERCE_RECONCILIATION_BLOCKED':
    case 'CANCELLATION_RECONCILIATION_BLOCKED':
      return 'P1';
    case 'REVERSED_SALE_AUDIT':
    case 'ORDER_ATTENTION_REQUIRED':
      return 'P2';
    case 'COMMERCE_RECONCILIATION_REVIEW':
      return 'P3';
    case 'ORDER_READY_FOR_SALE':
      return 'P4';
  }
}

function actionTypeFor(kind: OrdersSalesIntelligenceSignalKind): string {
  switch (kind) {
    case 'ORDER_INTEGRITY_ANOMALY':
      return 'REVIEW_ORDER_SALE_INTEGRITY';
    case 'ORDER_ATTENTION_REQUIRED':
      return 'REVIEW_ORDER_AGING';
    case 'ORDER_READY_FOR_SALE':
      return 'REVIEW_ORDER_NEXT_SALE_STEP';
    case 'COMMERCE_RECONCILIATION_BLOCKED':
      return 'REVIEW_COMMERCE_RECONCILIATION';
    case 'COMMERCE_RECONCILIATION_REVIEW':
      return 'REVIEW_COMMERCE_WARNINGS';
    case 'CANCELLATION_RECONCILIATION_BLOCKED':
      return 'REVIEW_ORDER_CANCELLATION_INTEGRITY';
    case 'REVERSED_SALE_AUDIT':
      return 'REVIEW_REVERSED_SALE_AUDIT';
  }
}

function riskFor(kind: OrdersSalesIntelligenceSignalKind): IntelligenceRisk {
  if (
    kind === 'ORDER_INTEGRITY_ANOMALY'
    || kind === 'COMMERCE_RECONCILIATION_BLOCKED'
    || kind === 'CANCELLATION_RECONCILIATION_BLOCKED'
  ) {
    return Object.freeze({
      level: 'R4',
      reasons: Object.freeze([
        'Correcting commerce integrity can affect Order, Sale, Inventory, or Finance state.',
        'Intelligence must not repair transactional history or ledgers automatically.',
      ]),
      requiresHumanReview: true,
    });
  }

  if (kind === 'REVERSED_SALE_AUDIT') {
    return Object.freeze({
      level: 'R3',
      reasons: Object.freeze([
        'Sale reversal is a governed domain workflow with historical consequences.',
        'The current intelligence signal is advisory and cannot reverse a sale.',
      ]),
      requiresHumanReview: true,
    });
  }

  if (
    kind === 'ORDER_ATTENTION_REQUIRED'
    || kind === 'COMMERCE_RECONCILIATION_REVIEW'
  ) {
    return Object.freeze({
      level: 'R2',
      reasons: Object.freeze([
        'The finding can influence an operational next action.',
        'The recommendation remains advisory until a human chooses a governed action.',
      ]),
      requiresHumanReview: true,
    });
  }

  return Object.freeze({
    level: 'R1',
    reasons: Object.freeze([
      'This is a read-only operational observation and does not mutate commerce state.',
    ]),
    requiresHumanReview: false,
  });
}

function confidenceFor(
  hasCommerceReconciliation: boolean,
  hasCancellationReconciliation: boolean,
): Confidence {
  const score = hasCommerceReconciliation && hasCancellationReconciliation
    ? 0.95
    : hasCommerceReconciliation || hasCancellationReconciliation
      ? 0.9
      : 0.85;

  return Object.freeze({
    score,
    band: score >= 0.9 ? 'VERY_HIGH' : 'HIGH',
    rationale: Object.freeze([
      'Order and Sale snapshots come from governed domain read boundaries.',
      hasCommerceReconciliation
        ? 'Commerce reconciliation observations are explicitly supplied.'
        : 'Commerce reconciliation observations are absent; cross-ledger PASS is not inferred.',
      hasCancellationReconciliation
        ? 'Order cancellation reconciliation observations are explicitly supplied.'
        : 'Cancellation reconciliation observations are absent; reservation release integrity is not inferred.',
    ]),
  });
}

function validatePolicy(
  policy: OrdersSalesIntelligencePolicy,
): OrdersSalesIntelligencePolicy {
  return Object.freeze({
    activeOrderAttentionHours: requirePositive(
      policy.activeOrderAttentionHours,
      'activeOrderAttentionHours',
    ),
    readyOrderAttentionHours: requirePositive(
      policy.readyOrderAttentionHours,
      'readyOrderAttentionHours',
    ),
  });
}

function ageHours(asOf: Date, value: Date | string): number {
  const date = parseDate(value, 'order.updatedAt');
  return Math.max(0, (asOf.getTime() - date.getTime()) / 3_600_000);
}

function isActiveOrder(status: OrdersSalesOrderStatus): boolean {
  return ['CONFIRMED', 'PREPARING', 'READY'].includes(status);
}

function isSaleEligibleOrder(status: OrdersSalesOrderStatus): boolean {
  return ['CONFIRMED', 'PREPARING', 'READY'].includes(status);
}

export function analyzeOrdersSalesIntelligence(
  input: OrdersSalesIntelligenceInput,
): OrdersSalesIntelligenceReport {
  const correlationId = requireText(input.correlationId, 'correlationId');
  const asOf = parseDate(input.asOf, 'asOf');
  const createdAt = requireText(input.createdAt, 'createdAt');
  parseDate(createdAt, 'createdAt');
  const policy = validatePolicy(input.policy);

  const orders = input.orders.map((order) => {
    const id = requireText(order.id, 'order.id');
    const orderNumber = requireText(order.orderNumber, 'order.orderNumber');
    parseDate(order.updatedAt, 'order.updatedAt');
    return Object.freeze({ ...order, id, orderNumber });
  });

  const sales = input.sales.map((sale) => {
    const id = requireText(sale.id, 'sale.id');
    const saleNumber = requireText(sale.saleNumber, 'sale.saleNumber');
    parseDate(sale.occurredAt, 'sale.occurredAt');
    requireFiniteNonNegative(sale.totalAmount, 'sale.totalAmount');
    return Object.freeze({ ...sale, id, saleNumber });
  });

  const seenOrderIds = new Set<string>();
  for (const order of orders) {
    if (seenOrderIds.has(order.id)) throw new Error('Order IDs must be unique.');
    seenOrderIds.add(order.id);
  }

  const seenSaleIds = new Set<string>();
  for (const sale of sales) {
    if (seenSaleIds.has(sale.id)) throw new Error('Sale IDs must be unique.');
    seenSaleIds.add(sale.id);
  }

  const commerceReconciliations = input.commerceReconciliations ?? [];
  const cancellationReconciliations = input.cancellationReconciliations ?? [];

  const seenCommerceSaleIds = new Set<string>();
  for (const observation of commerceReconciliations) {
    requireText(observation.saleId, 'commerceReconciliation.saleId');
    if (seenCommerceSaleIds.has(observation.saleId)) {
      throw new Error('Commerce reconciliation sale IDs must be unique.');
    }
    seenCommerceSaleIds.add(observation.saleId);
  }

  const seenCancellationOrderIds = new Set<string>();
  for (const observation of cancellationReconciliations) {
    requireText(observation.orderId, 'cancellationReconciliation.orderId');
    if (seenCancellationOrderIds.has(observation.orderId)) {
      throw new Error('Cancellation reconciliation order IDs must be unique.');
    }
    seenCancellationOrderIds.add(observation.orderId);
  }

  const context: IntelligenceContext = Object.freeze({
    contextId: `orders-sales:${correlationId}`,
    type: 'GLOBAL',
    attributes: Object.freeze({
      domain: 'ORDERS_SALES',
      orderCount: orders.length,
      saleCount: sales.length,
      asOf: asOf.toISOString(),
    }),
  });

  const signals: OrdersSalesIntelligenceSignal[] = [];

  const salesByOrderId = new Map<string, OrdersSalesSaleReadModel[]>();
  for (const sale of sales) {
    if (sale.orderId === null) continue;
    const current = salesByOrderId.get(sale.orderId) ?? [];
    current.push(sale);
    salesByOrderId.set(sale.orderId, current);
  }

  let staleActiveOrders = 0;

  for (const order of orders) {
    const linkedSales = salesByOrderId.get(order.id) ?? [];

    if (
      (order.status === 'COMPLETED' && linkedSales.length !== 1)
      || (order.status === 'CANCELLED' && linkedSales.length > 0)
      || (!['COMPLETED', 'CANCELLED'].includes(order.status) && linkedSales.length > 0)
      || linkedSales.length > 1
    ) {
      signals.push({
        kind: 'ORDER_INTEGRITY_ANOMALY',
        severity: 'CRITICAL',
        entityId: order.id,
        title: `Order ${order.orderNumber} requires commerce integrity review`,
        explanation:
          'Order lifecycle and linked Sale history are inconsistent with the governed commerce flow.',
        rationale: Object.freeze([
          `Order status=${order.status}.`,
          `Linked sales=${linkedSales.length}.`,
          'Order/Sale history must be corrected only through governed domain workflows.',
        ]),
      });
    }

    if (isActiveOrder(order.status)) {
      const hours = ageHours(asOf, order.updatedAt);
      const threshold = order.status === 'READY'
        ? policy.readyOrderAttentionHours
        : policy.activeOrderAttentionHours;

      if (hours >= threshold) {
        staleActiveOrders += 1;
        signals.push({
          kind: 'ORDER_ATTENTION_REQUIRED',
          severity: order.status === 'READY' ? 'WARNING' : 'INFO',
          entityId: order.id,
          title: `Order ${order.orderNumber} needs operational follow-up`,
          explanation:
            'The order has remained in an active state beyond the explicit attention threshold.',
          rationale: Object.freeze([
            `Status=${order.status}.`,
            `Age since last update=${hours.toFixed(1)}h.`,
            `Attention threshold=${threshold}h.`,
          ]),
        });
      }
    }

    if (order.status === 'READY' && linkedSales.length === 0) {
      signals.push({
        kind: 'ORDER_READY_FOR_SALE',
        severity: 'SUCCESS',
        entityId: order.id,
        title: `Order ${order.orderNumber} is ready for the governed sale step`,
        explanation:
          'The order is READY and no linked Sale is present in the supplied snapshot.',
        rationale: Object.freeze([
          'READY is sale-eligible under the current Order commerce policy.',
          'Completing the sale must remain behind the existing controlled Sales workflow.',
        ]),
      });
    }
  }

  for (const sale of sales) {
    if (sale.orderId !== null && !seenOrderIds.has(sale.orderId)) {
      signals.push({
        kind: 'ORDER_INTEGRITY_ANOMALY',
        severity: 'CRITICAL',
        entityId: sale.id,
        title: `Sale ${sale.saleNumber} references an order outside the supplied Order snapshot`,
        explanation:
          'A Sale with orderId must be traceable to its Order before cross-domain integrity can be considered complete.',
        rationale: Object.freeze([
          `sale.orderId=${sale.orderId}.`,
          'Missing Order context is treated as an integrity anomaly, not silently ignored.',
        ]),
      });
    }

    if (sale.status === 'REVERSED') {
      signals.push({
        kind: 'REVERSED_SALE_AUDIT',
        severity: 'WARNING',
        entityId: sale.id,
        title: `Sale ${sale.saleNumber} is historical REVERSED evidence`,
        explanation:
          'The reversed Sale must remain historical evidence and cannot be reprocessed by a generic finance or UI action.',
        rationale: Object.freeze([
          'Current Sale reversal policy requires a dedicated governed domain workflow.',
          'Intelligence can surface the record for audit but cannot reverse or rewrite it.',
        ]),
      });
    }
  }

  for (const observation of commerceReconciliations) {
    if (observation.status === 'BLOCKED') {
      signals.push({
        kind: 'COMMERCE_RECONCILIATION_BLOCKED',
        severity: 'CRITICAL',
        entityId: observation.saleId,
        title: 'Commerce reconciliation is blocked',
        explanation:
          'Sale, Order, Inventory, or Finance evidence does not reconcile and requires investigation before corrective action.',
        rationale: Object.freeze([
          ...observation.blockers.map((blocker) => `BLOCKER:${blocker}`),
          ...observation.warnings.map((warning) => `WARNING:${warning}`),
        ]),
      });
    } else if (observation.status === 'REVIEW') {
      signals.push({
        kind: 'COMMERCE_RECONCILIATION_REVIEW',
        severity: 'WARNING',
        entityId: observation.saleId,
        title: 'Commerce reconciliation requires review',
        explanation:
          'The supplied reconciliation contains warnings that should be reviewed without rewriting transactional history.',
        rationale: Object.freeze(
          observation.warnings.map((warning) => `WARNING:${warning}`),
        ),
      });
    }
  }

  for (const observation of cancellationReconciliations) {
    if (observation.status === 'BLOCKED') {
      signals.push({
        kind: 'CANCELLATION_RECONCILIATION_BLOCKED',
        severity: 'CRITICAL',
        entityId: observation.orderId,
        title: 'Order cancellation reconciliation is blocked',
        explanation:
          'Reservation release or linked Sale evidence is inconsistent with the cancelled Order.',
        rationale: Object.freeze([
          ...observation.blockers.map((blocker) => `BLOCKER:${blocker}`),
          ...observation.warnings.map((warning) => `WARNING:${warning}`),
        ]),
      });
    }
  }

  signals.sort(
    (left, right) =>
      canonicalSignalOrder(left.kind) - canonicalSignalOrder(right.kind)
      || left.entityId.localeCompare(right.entityId),
  );

  const confidence = confidenceFor(
    commerceReconciliations.length > 0,
    cancellationReconciliations.length > 0,
  );

  const evidence: IntelligenceEvidence[] = signals.map((signal, index) =>
    Object.freeze({
      evidenceId: `orders-sales-evidence:${correlationId}:${index + 1}`,
      correlationId,
      context,
      capability: 'ANALYTICS',
      sourceAuthority: Object.freeze({
        level: 'FIRST_PARTY',
        sourceName: 'LIHEN governed Order/Sale read models',
        rationale: Object.freeze([
          'Evidence is derived only from supplied first-party domain snapshots and reconciliation observations.',
        ]),
      }),
      observation: signal.explanation,
      payload: Object.freeze({
        kind: signal.kind,
        entityId: signal.entityId,
        severity: signal.severity,
        rationale: signal.rationale,
      }),
      confidence,
      fingerprint: stableFingerprint([
        signal.kind,
        signal.entityId,
        signal.title,
        ...signal.rationale,
      ]),
      createdAt,
    }),
  );

  const recommendations: IntelligenceRecommendation[] = signals.map(
    (signal, index) =>
      Object.freeze({
        recommendationId: `orders-sales-recommendation:${correlationId}:${index + 1}`,
        correlationId,
        context,
        actionType: actionTypeFor(signal.kind),
        title: signal.title,
        explanation: signal.explanation,
        priority: priorityFor(signal.kind),
        severity: signal.severity,
        source: 'Orders & Sales Intelligence',
        rationale: signal.rationale,
        evidenceIds: Object.freeze([evidence[index]!.evidenceId]),
        confidence,
        risk: riskFor(signal.kind),
        status: 'OPEN',
        createdAt,
      }),
  );

  const metrics: OrdersSalesIntelligenceMetrics = Object.freeze({
    totalOrders: orders.length,
    draftOrders: orders.filter((order) => order.status === 'DRAFT').length,
    activeOrders: orders.filter((order) => isActiveOrder(order.status)).length,
    saleEligibleOrders: orders.filter((order) => isSaleEligibleOrder(order.status)).length,
    completedOrders: orders.filter((order) => order.status === 'COMPLETED').length,
    cancelledOrders: orders.filter((order) => order.status === 'CANCELLED').length,
    staleActiveOrders,
    totalSales: sales.length,
    completedSales: sales.filter((sale) => sale.status === 'COMPLETED').length,
    reversedSales: sales.filter((sale) => sale.status === 'REVERSED').length,
    observedCompletedSalesAmount: sales
      .filter((sale) => sale.status === 'COMPLETED')
      .reduce((sum, sale) => sum + sale.totalAmount, 0),
    blockedCommerceReconciliations: commerceReconciliations.filter(
      (observation) => observation.status === 'BLOCKED',
    ).length,
    reviewCommerceReconciliations: commerceReconciliations.filter(
      (observation) => observation.status === 'REVIEW',
    ).length,
    blockedCancellationReconciliations: cancellationReconciliations.filter(
      (observation) => observation.status === 'BLOCKED',
    ).length,
  });

  return Object.freeze({
    context,
    metrics,
    signals: Object.freeze(signals),
    evidence: Object.freeze(evidence),
    recommendations: Object.freeze(recommendations),
    governance: Object.freeze({
      canAutoCreateOrder: false,
      canAutoConfirmOrder: false,
      canAutoCancelOrder: false,
      canAutoCompleteSale: false,
      canAutoReverseSale: false,
      canAutoMoveInventory: false,
      canAutoPostFinance: false,
    }),
  });
}
