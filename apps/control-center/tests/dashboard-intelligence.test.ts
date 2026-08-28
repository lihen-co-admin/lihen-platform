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

  it('raises stock pending as a deterministic operational recommendation', () => {
    const result = evaluateDashboardIntelligence({
      ...baseInput,
      stockPendingTotal: 25,
      purchasesOpen: 2,
    });
    const stock = result.find((item) => item.id === 'pending-stock');

    expect(stock?.severity).toBe('WARNING');
    expect(stock?.score).toBeGreaterThanOrEqual(60);
    expect(stock?.rationale).toContain('2 compras abiertas');
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

  it('sorts recommendations by score deterministically', () => {
    const result = evaluateDashboardIntelligence({
      ...baseInput,
      stockPendingTotal: 3,
      ordersOpen: 15,
    });
    const scores = result.map((item) => item.score);

    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('always preserves the read-only execution-held recommendation', () => {
    const result = evaluateDashboardIntelligence(baseInput);

    expect(result.some((item) => item.id === 'execution-held')).toBe(true);
  });
});
