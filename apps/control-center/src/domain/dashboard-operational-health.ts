import type { IntelligenceAssuranceStatus } from './intelligence-assurance';
import type { DashboardMetricIntegrityStatus } from './dashboard-metric-integrity';

export type DashboardOperationalHealthStatus = 'STABLE' | 'ATTENTION' | 'BLOCKED';

export type DashboardOperationalFocus =
  | 'INTEGRITY'
  | 'INTELLIGENCE_ASSURANCE'
  | 'HUMAN_DECISION'
  | 'ORDERS'
  | 'PURCHASES'
  | 'INVENTORY'
  | 'MONITOR';

export interface DashboardOperationalHealthInput {
  readonly integrityIssueCount: number;
  readonly dashboardMetricIntegrityStatus: DashboardMetricIntegrityStatus;
  readonly intelligenceAssuranceStatus: IntelligenceAssuranceStatus;
  readonly intelligenceApprovableCount: number;
  readonly intelligenceReviewCount: number;
  readonly intelligenceBlockedCount: number;
  readonly ordersOpen: number;
  readonly purchasesOpen: number;
  readonly stockPendingTotal: number;
}

export interface DashboardOperationalHealth {
  readonly status: DashboardOperationalHealthStatus;
  readonly nextFocus: DashboardOperationalFocus;
  readonly workQueueTotal: number;
  readonly humanDecisionQueue: number;
  readonly blockers: readonly string[];
  readonly attentionItems: readonly string[];
  readonly explanation: string;
}

function safeCount(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

export function evaluateDashboardOperationalHealth(
  input: DashboardOperationalHealthInput,
): DashboardOperationalHealth {
  const integrityIssueCount = safeCount(input.integrityIssueCount);
  const approvableCount = safeCount(input.intelligenceApprovableCount);
  const reviewCount = safeCount(input.intelligenceReviewCount);
  const blockedCount = safeCount(input.intelligenceBlockedCount);
  const ordersOpen = safeCount(input.ordersOpen);
  const purchasesOpen = safeCount(input.purchasesOpen);
  const stockPendingTotal = safeCount(input.stockPendingTotal);

  const blockers: string[] = [];
  const attentionItems: string[] = [];

  if (integrityIssueCount > 0) {
    blockers.push(`${integrityIssueCount} hallazgos de integridad`);
  }

  if (input.dashboardMetricIntegrityStatus === 'BLOCKED') {
    blockers.push('Dashboard metric integrity BLOCKED');
  }

  if (input.intelligenceAssuranceStatus === 'BLOCKED') {
    blockers.push('Intelligence assurance BLOCKED');
  } else if (input.intelligenceAssuranceStatus === 'REVIEW') {
    attentionItems.push('Intelligence assurance requiere revisión');
  }

  if (blockedCount > 0) {
    blockers.push(`${blockedCount} recomendaciones bloqueadas`);
  }

  if (reviewCount > 0) {
    attentionItems.push(`${reviewCount} recomendaciones en revisión`);
  }

  if (approvableCount > 0) {
    attentionItems.push(`${approvableCount} recomendaciones listas para decisión humana`);
  }

  if (ordersOpen > 0) {
    attentionItems.push(`${ordersOpen} pedidos abiertos`);
  }

  if (purchasesOpen > 0) {
    attentionItems.push(`${purchasesOpen} compras abiertas`);
  }

  if (stockPendingTotal > 0) {
    attentionItems.push(`${stockPendingTotal} unidades pendientes de ingreso`);
  }

  const status: DashboardOperationalHealthStatus =
    blockers.length > 0 ? 'BLOCKED' : attentionItems.length > 0 ? 'ATTENTION' : 'STABLE';

  let nextFocus: DashboardOperationalFocus = 'MONITOR';

  if (integrityIssueCount > 0 || input.dashboardMetricIntegrityStatus === 'BLOCKED') {
    nextFocus = 'INTEGRITY';
  } else if (input.intelligenceAssuranceStatus !== 'PASS') {
    nextFocus = 'INTELLIGENCE_ASSURANCE';
  } else if (blockedCount > 0 || reviewCount > 0 || approvableCount > 0) {
    nextFocus = 'HUMAN_DECISION';
  } else if (ordersOpen > 0) {
    nextFocus = 'ORDERS';
  } else if (purchasesOpen > 0) {
    nextFocus = 'PURCHASES';
  } else if (stockPendingTotal > 0) {
    nextFocus = 'INVENTORY';
  }

  const workQueueTotal =
    approvableCount +
    reviewCount +
    blockedCount +
    ordersOpen +
    purchasesOpen +
    stockPendingTotal;

  return {
    status,
    nextFocus,
    workQueueTotal,
    humanDecisionQueue: approvableCount + reviewCount + blockedCount,
    blockers,
    attentionItems,
    explanation:
      status === 'BLOCKED'
        ? 'El dashboard detecta bloqueos que deben resolverse antes de tratar la operación como estable.'
        : status === 'ATTENTION'
          ? 'No hay bloqueos críticos en el resumen, pero existen elementos operativos o decisiones humanas pendientes.'
          : 'El resumen no reporta bloqueos ni colas pendientes; el foco puede mantenerse en monitoreo.',
  };
}
