import type { Sale } from './sale';

export type SaleReversalCapability = 'DOMAIN_WORKFLOW_REQUIRED' | 'HISTORICAL_REVERSED';

export interface SaleReversalPolicyResult {
  readonly capability: SaleReversalCapability;
  readonly canReverseFromGenericFinance: false;
  readonly canReverseFromSalesUi: false;
  readonly reason: string;
}

export function evaluateSaleReversalPolicy(sale: Sale): SaleReversalPolicyResult {
  if (sale.status === 'REVERSED') {
    return {
      capability: 'HISTORICAL_REVERSED',
      canReverseFromGenericFinance: false,
      canReverseFromSalesUi: false,
      reason: 'SALE_ALREADY_REVERSED_REQUIRES_AUDIT_EVIDENCE',
    };
  }

  return {
    capability: 'DOMAIN_WORKFLOW_REQUIRED',
    canReverseFromGenericFinance: false,
    canReverseFromSalesUi: false,
    reason: 'SALE_REVERSAL_CONTROLLED_WORKFLOW_NOT_IMPLEMENTED',
  };
}
