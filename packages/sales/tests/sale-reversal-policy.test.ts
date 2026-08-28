import { describe, expect, it } from 'vitest';
import type { Sale } from '../src/domain/sale';
import { evaluateSaleReversalPolicy } from '../src/domain/sale-reversal-policy';

function sale(status: Sale['status']): Sale {
  return {
    id: 'sale-1',
    saleNumber: 'V-001',
    orderId: null,
    channel: 'IN_PERSON',
    status,
    customerName: null,
    occurredAt: new Date('2026-08-27T10:00:00Z'),
    totalAmount: 10000,
    financialAccountId: 'account-1',
    notes: null,
  };
}

describe('evaluateSaleReversalPolicy', () => {
  it('does not allow a completed sale to be reversed from generic Finance or the Sales UI', () => {
    const result = evaluateSaleReversalPolicy(sale('COMPLETED'));

    expect(result.capability).toBe('DOMAIN_WORKFLOW_REQUIRED');
    expect(result.canReverseFromGenericFinance).toBe(false);
    expect(result.canReverseFromSalesUi).toBe(false);
  });

  it('treats REVERSED as historical evidence, not as an action to repeat', () => {
    const result = evaluateSaleReversalPolicy(sale('REVERSED'));

    expect(result.capability).toBe('HISTORICAL_REVERSED');
    expect(result.canReverseFromSalesUi).toBe(false);
  });
});
