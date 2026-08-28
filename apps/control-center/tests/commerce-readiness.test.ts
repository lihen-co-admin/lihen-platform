import { describe, expect, it } from 'vitest';
import { evaluateCommerceReadiness } from '../src/domain/commerce-readiness';

function saleResult(status: 'PASS' | 'REVIEW' | 'BLOCKED') {
  return {
    status,
    blockers: status === 'BLOCKED' ? ['X'] : [],
    warnings: status === 'REVIEW' ? ['Y'] : [],
    inventoryExpectedUnits: 1,
    inventoryOnHandUnits: 1,
    inventoryReservedUnits: 1,
    financeIncomeAmount: 1000,
    financeMovementCount: 1,
  } as const;
}

function cancellationResult(status: 'PASS' | 'REVIEW' | 'BLOCKED') {
  return {
    status,
    blockers: status === 'BLOCKED' ? ['X'] : [],
    warnings: status === 'REVIEW' ? ['Y'] : [],
    expectedUnits: 1,
    reservedUnitsCreated: 1,
    reservedUnitsReleased: 1,
  } as const;
}

describe('evaluateCommerceReadiness', () => {
  it('is ready when reconciliations pass and a financial account is active', () => {
    expect(evaluateCommerceReadiness({
      saleReconciliations: [saleResult('PASS')],
      cancellationReconciliations: [cancellationResult('PASS')],
      reversedSaleCount: 0,
      activeFinancialAccountCount: 1,
    }).status).toBe('READY');
  });

  it('blocks when any commerce reconciliation is blocked', () => {
    const result = evaluateCommerceReadiness({
      saleReconciliations: [saleResult('BLOCKED')],
      cancellationReconciliations: [],
      reversedSaleCount: 0,
      activeFinancialAccountCount: 1,
    });

    expect(result.status).toBe('BLOCKED');
    expect(result.blockers).toContain('SALE_RECONCILIATION_BLOCKED:1');
  });

  it('blocks operational readiness when no active financial account exists', () => {
    const result = evaluateCommerceReadiness({
      saleReconciliations: [],
      cancellationReconciliations: [],
      reversedSaleCount: 0,
      activeFinancialAccountCount: 0,
    });

    expect(result.status).toBe('BLOCKED');
    expect(result.blockers).toContain('NO_ACTIVE_FINANCIAL_ACCOUNT');
  });

  it('reviews historical reversed sales because reversal needs domain audit', () => {
    const result = evaluateCommerceReadiness({
      saleReconciliations: [saleResult('PASS')],
      cancellationReconciliations: [],
      reversedSaleCount: 2,
      activeFinancialAccountCount: 1,
    });

    expect(result.status).toBe('REVIEW');
    expect(result.warnings).toContain('REVERSED_SALES_REQUIRE_DOMAIN_AUDIT:2');
  });
});
