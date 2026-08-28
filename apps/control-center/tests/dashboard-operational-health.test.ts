import { describe, expect, it } from 'vitest';
import { evaluateDashboardOperationalHealth } from '../src/domain/dashboard-operational-health';

const base = {
  integrityIssueCount: 0,
  dashboardMetricIntegrityStatus: 'PASS' as const,
  intelligenceAssuranceStatus: 'PASS' as const,
  intelligenceApprovableCount: 0,
  intelligenceReviewCount: 0,
  intelligenceBlockedCount: 0,
  ordersOpen: 0,
  purchasesOpen: 0,
  stockPendingTotal: 0,
};

describe('evaluateDashboardOperationalHealth', () => {
  it('returns STABLE when there are no blockers or queues', () => {
    const result = evaluateDashboardOperationalHealth(base);

    expect(result.status).toBe('STABLE');
    expect(result.nextFocus).toBe('MONITOR');
    expect(result.workQueueTotal).toBe(0);
  });

  it('blocks and prioritizes integrity findings', () => {
    const result = evaluateDashboardOperationalHealth({
      ...base,
      integrityIssueCount: 2,
      ordersOpen: 5,
    });

    expect(result.status).toBe('BLOCKED');
    expect(result.nextFocus).toBe('INTEGRITY');
    expect(result.blockers).toContain('2 hallazgos de integridad');
  });

  it('blocks when Intelligence assurance is BLOCKED', () => {
    const result = evaluateDashboardOperationalHealth({
      ...base,
      intelligenceAssuranceStatus: 'BLOCKED',
    });

    expect(result.status).toBe('BLOCKED');
    expect(result.nextFocus).toBe('INTELLIGENCE_ASSURANCE');
  });

  it('keeps REVIEW assurance as attention instead of inventing a blocker', () => {
    const result = evaluateDashboardOperationalHealth({
      ...base,
      intelligenceAssuranceStatus: 'REVIEW',
    });

    expect(result.status).toBe('ATTENTION');
    expect(result.nextFocus).toBe('INTELLIGENCE_ASSURANCE');
  });

  it('prioritizes the human-decision queue before ordinary workload', () => {
    const result = evaluateDashboardOperationalHealth({
      ...base,
      intelligenceApprovableCount: 2,
      ordersOpen: 3,
      purchasesOpen: 1,
    });

    expect(result.status).toBe('ATTENTION');
    expect(result.nextFocus).toBe('HUMAN_DECISION');
    expect(result.humanDecisionQueue).toBe(2);
    expect(result.workQueueTotal).toBe(6);
  });

  it('uses deterministic operational precedence without arbitrary thresholds', () => {
    const orders = evaluateDashboardOperationalHealth({ ...base, ordersOpen: 1, purchasesOpen: 4 });
    const purchases = evaluateDashboardOperationalHealth({ ...base, purchasesOpen: 1, stockPendingTotal: 8 });
    const inventory = evaluateDashboardOperationalHealth({ ...base, stockPendingTotal: 1 });

    expect(orders.nextFocus).toBe('ORDERS');
    expect(purchases.nextFocus).toBe('PURCHASES');
    expect(inventory.nextFocus).toBe('INVENTORY');
  });
});
