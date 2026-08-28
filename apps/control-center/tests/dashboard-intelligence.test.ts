import { describe, expect, it } from 'vitest';
import { evaluateDashboardIntelligence } from '../src/domain/dashboard-intelligence';

const baseInput = {
  integrityIssueCount: 0,
  auditedOperations: 20,
  stockPendingTotal: 0,
  ordersOpen: 0,
  purchasesOpen: 0,
  stockAvailableTotal: 30,
  financialAccountsActive: 1,
};

describe('evaluateDashboardIntelligence', () => {
  it('prioritizes integrity findings above every operational signal', () => {
    const result = evaluateDashboardIntelligence({
      ...baseInput,
      integrityIssueCount: 3,
      stockPendingTotal: 50,
      ordersOpen: 20,
    });

    expect(result[0]?.id).toBe('integrity-review');
    expect(result[0]?.priority).toBe('P1');
    expect(result[0]?.severity).toBe('CRITICAL');
  });

  it('keeps a stable integrity signal when there are no findings', () => {
    const result = evaluateDashboardIntelligence(baseInput);
    const integrity = result.find((item) => item.id === 'integrity-stable');

    expect(integrity?.severity).toBe('SUCCESS');
    expect(integrity?.priority).toBe('P4');
  });

  it('categorizes pending stock without numeric score thresholds', () => {
    const result = evaluateDashboardIntelligence({
      ...baseInput,
      stockPendingTotal: 25,
      purchasesOpen: 2,
    });
    const stock = result.find((item) => item.id === 'pending-stock');

    expect(stock?.priority).toBe('P2');
    expect(stock?.severity).toBe('WARNING');
    expect(stock?.rationale).toContain('2 compras abiertas');
    expect(stock).not.toHaveProperty('score');
  });

  it('flags missing active financial accounts without inventing a write', () => {
    const result = evaluateDashboardIntelligence({
      ...baseInput,
      financialAccountsActive: 0,
    });
    const finance = result.find((item) => item.id === 'finance-account-missing');

    expect(finance?.priority).toBe('P2');
    expect(finance?.targetRoute).toBe('/finance');
  });

  it('sorts recommendations by categorical priority deterministically', () => {
    const result = evaluateDashboardIntelligence({
      ...baseInput,
      integrityIssueCount: 1,
      stockPendingTotal: 3,
      ordersOpen: 15,
      financialAccountsActive: 0,
    });

    expect(result.map((item) => item.priority)).toEqual(['P1', 'P2', 'P2', 'P3', 'P4']);
    expect(result.filter((item) => item.priority === 'P2').map((item) => item.id)).toEqual([
      'finance-account-missing',
      'pending-stock',
    ]);
  });

  it('always preserves the read-only execution-held recommendation', () => {
    const result = evaluateDashboardIntelligence(baseInput);

    expect(result.some((item) => item.id === 'execution-held')).toBe(true);
  });
});
