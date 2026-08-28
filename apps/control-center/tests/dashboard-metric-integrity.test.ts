import { describe, expect, it } from 'vitest';
import type { OperationalDashboardSummary } from '../src/composition/operations';
import { evaluateDashboardMetricIntegrity } from '../src/domain/dashboard-metric-integrity';

function summary(
  overrides: Partial<OperationalDashboardSummary> = {},
): OperationalDashboardSummary {
  return {
    productsTotal: 100,
    productsActive: 90,
    stockOnHandTotal: 50,
    stockReservedTotal: 10,
    stockPendingTotal: 8,
    stockAvailableTotal: 40,
    suppliersActive: 4,
    purchasesOpen: 2,
    ordersOpen: 3,
    salesCompleted: 12,
    salesTotalCop: 500000,
    financialAccountsActive: 2,
    financialBalanceTotalCop: 320000,
    integrityIssueCount: 0,
    auditedOperations: 25,
    ...overrides,
  };
}

describe('evaluateDashboardMetricIntegrity', () => {
  it('returns PASS for a coherent canonical summary', () => {
    const result = evaluateDashboardMetricIntegrity(summary());

    expect(result.status).toBe('PASS');
    expect(result.issueCount).toBe(0);
  });

  it('blocks non-finite metrics', () => {
    const result = evaluateDashboardMetricIntegrity(
      summary({ salesTotalCop: Number.NaN }),
    );

    expect(result.status).toBe('BLOCKED');
    expect(result.issues.some((issue) => issue.code === 'NON_FINITE_METRIC')).toBe(true);
  });

  it('blocks negative count metrics', () => {
    const result = evaluateDashboardMetricIntegrity(
      summary({ ordersOpen: -1 }),
    );

    expect(result.status).toBe('BLOCKED');
    expect(result.issues.some((issue) => issue.code === 'NEGATIVE_COUNT_METRIC')).toBe(true);
  });

  it('blocks when active products exceed total products', () => {
    const result = evaluateDashboardMetricIntegrity(
      summary({ productsTotal: 10, productsActive: 11 }),
    );

    expect(result.status).toBe('BLOCKED');
    expect(result.issues.some((issue) => issue.code === 'ACTIVE_PRODUCTS_EXCEED_TOTAL')).toBe(true);
  });

  it('blocks when stock available does not match ON_HAND minus RESERVED', () => {
    const result = evaluateDashboardMetricIntegrity(
      summary({ stockAvailableTotal: 41 }),
    );

    expect(result.status).toBe('BLOCKED');
    expect(result.issues.some((issue) => issue.code === 'STOCK_AVAILABLE_MISMATCH')).toBe(true);
  });

  it('does not reject a finite negative financial balance because account balance semantics are domain-owned', () => {
    const result = evaluateDashboardMetricIntegrity(
      summary({ financialBalanceTotalCop: -50000 }),
    );

    expect(result.status).toBe('PASS');
  });
});
