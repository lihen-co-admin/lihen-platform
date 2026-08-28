import type { CommerceReconciliationResult } from './commerce-reconciliation';
import type { OrderCancellationReconciliationResult } from './order-cancellation-reconciliation';

export type CommerceReadinessStatus = 'READY' | 'REVIEW' | 'BLOCKED';

export interface CommerceReadinessInput {
  readonly saleReconciliations: readonly CommerceReconciliationResult[];
  readonly cancellationReconciliations: readonly OrderCancellationReconciliationResult[];
  readonly reversedSaleCount: number;
  readonly activeFinancialAccountCount: number;
}

export interface CommerceReadinessResult {
  readonly status: CommerceReadinessStatus;
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
}

export function evaluateCommerceReadiness(input: CommerceReadinessInput): CommerceReadinessResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  const blockedSales = input.saleReconciliations.filter((result) => result.status === 'BLOCKED').length;
  const blockedCancellations = input.cancellationReconciliations.filter((result) => result.status === 'BLOCKED').length;
  const reviewSales = input.saleReconciliations.filter((result) => result.status === 'REVIEW').length;
  const reviewCancellations = input.cancellationReconciliations.filter((result) => result.status === 'REVIEW').length;

  if (blockedSales > 0) blockers.push(`SALE_RECONCILIATION_BLOCKED:${blockedSales}`);
  if (blockedCancellations > 0) blockers.push(`CANCELLATION_RECONCILIATION_BLOCKED:${blockedCancellations}`);
  if (input.activeFinancialAccountCount === 0) blockers.push('NO_ACTIVE_FINANCIAL_ACCOUNT');

  if (reviewSales > 0) warnings.push(`SALE_RECONCILIATION_REVIEW:${reviewSales}`);
  if (reviewCancellations > 0) warnings.push(`CANCELLATION_RECONCILIATION_REVIEW:${reviewCancellations}`);
  if (input.reversedSaleCount > 0) warnings.push(`REVERSED_SALES_REQUIRE_DOMAIN_AUDIT:${input.reversedSaleCount}`);

  return {
    status: blockers.length > 0 ? 'BLOCKED' : warnings.length > 0 ? 'REVIEW' : 'READY',
    blockers,
    warnings,
  };
}
