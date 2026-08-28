import type { OperationalDashboardSummary } from '../composition/operations';

export type DashboardMetricIntegrityStatus = 'PASS' | 'BLOCKED';

export type DashboardMetricIntegrityIssueCode =
  | 'NON_FINITE_METRIC'
  | 'NEGATIVE_COUNT_METRIC'
  | 'ACTIVE_PRODUCTS_EXCEED_TOTAL'
  | 'STOCK_AVAILABLE_MISMATCH';

export interface DashboardMetricIntegrityIssue {
  readonly code: DashboardMetricIntegrityIssueCode;
  readonly metric: string;
  readonly message: string;
}

export interface DashboardMetricIntegrityResult {
  readonly status: DashboardMetricIntegrityStatus;
  readonly checkedMetricCount: number;
  readonly issueCount: number;
  readonly issues: readonly DashboardMetricIntegrityIssue[];
  readonly explanation: string;
}

const nonNegativeCountMetrics = [
  'productsTotal',
  'productsActive',
  'stockOnHandTotal',
  'stockReservedTotal',
  'stockPendingTotal',
  'stockAvailableTotal',
  'suppliersActive',
  'purchasesOpen',
  'ordersOpen',
  'salesCompleted',
  'financialAccountsActive',
  'integrityIssueCount',
  'auditedOperations',
] as const;

export function evaluateDashboardMetricIntegrity(
  summary: OperationalDashboardSummary,
): DashboardMetricIntegrityResult {
  const issues: DashboardMetricIntegrityIssue[] = [];

  for (const metric of nonNegativeCountMetrics) {
    const value = summary[metric];

    if (!Number.isFinite(value)) {
      issues.push({
        code: 'NON_FINITE_METRIC',
        metric,
        message: `${metric} no contiene un número finito.`,
      });
      continue;
    }

    if (value < 0) {
      issues.push({
        code: 'NEGATIVE_COUNT_METRIC',
        metric,
        message: `${metric} no puede ser negativo en el read model del Dashboard.`,
      });
    }
  }

  for (const metric of ['salesTotalCop', 'financialBalanceTotalCop'] as const) {
    if (!Number.isFinite(summary[metric])) {
      issues.push({
        code: 'NON_FINITE_METRIC',
        metric,
        message: `${metric} no contiene un número finito.`,
      });
    }
  }

  if (summary.productsActive > summary.productsTotal) {
    issues.push({
      code: 'ACTIVE_PRODUCTS_EXCEED_TOTAL',
      metric: 'productsActive',
      message: 'Los productos activos no pueden superar el total de productos.',
    });
  }

  const expectedAvailable = summary.stockOnHandTotal - summary.stockReservedTotal;
  if (summary.stockAvailableTotal !== expectedAvailable) {
    issues.push({
      code: 'STOCK_AVAILABLE_MISMATCH',
      metric: 'stockAvailableTotal',
      message:
        `stockAvailableTotal (${summary.stockAvailableTotal}) no coincide con ` +
        `stockOnHandTotal - stockReservedTotal (${expectedAvailable}).`,
    });
  }

  return {
    status: issues.length === 0 ? 'PASS' : 'BLOCKED',
    checkedMetricCount: nonNegativeCountMetrics.length + 2,
    issueCount: issues.length,
    issues,
    explanation:
      issues.length === 0
        ? 'Las métricas del Dashboard son internamente coherentes con el read model canónico.'
        : 'El Dashboard presenta inconsistencias matemáticas o estructurales en su propio resumen y no debe tratarse como una lectura confiable hasta revisarlas.',
  };
}
