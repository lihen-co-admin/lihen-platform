import type { OrderStatus } from './order';

export const orderStatusesEligibleForSale = ['CONFIRMED', 'PREPARING', 'READY'] as const satisfies readonly OrderStatus[];

export type OrderReservationState = 'NONE' | 'ACTIVE' | 'CONSUMED' | 'RELEASED';
export type OrderSaleEligibility = 'NOT_READY' | 'ELIGIBLE' | 'CLOSED' | 'INVALID';

export interface OrderCommercePolicyInput {
  readonly status: OrderStatus;
  readonly hasCompletedSale?: boolean;
}

export interface OrderCommercePolicyResult {
  readonly reservationState: OrderReservationState;
  readonly saleEligibility: OrderSaleEligibility;
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
}

export function isOrderEligibleForSale(status: OrderStatus): boolean {
  return orderStatusesEligibleForSale.some((candidate) => candidate === status);
}

export function evaluateOrderCommercePolicy(input: OrderCommercePolicyInput): OrderCommercePolicyResult {
  const hasCompletedSale = input.hasCompletedSale ?? false;
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (hasCompletedSale && input.status !== 'COMPLETED') {
    blockers.push('SALE_ORDER_STATUS_MISMATCH');
  }

  if (!hasCompletedSale && input.status === 'COMPLETED') {
    blockers.push('COMPLETED_ORDER_WITHOUT_SALE');
  }

  if (input.status === 'CANCELLED' && hasCompletedSale) {
    blockers.push('CANCELLED_ORDER_WITH_SALE');
  }

  if (blockers.length > 0) {
    return {
      reservationState: input.status === 'CANCELLED' ? 'RELEASED' : input.status === 'COMPLETED' ? 'CONSUMED' : isOrderEligibleForSale(input.status) ? 'ACTIVE' : 'NONE',
      saleEligibility: 'INVALID',
      blockers,
      warnings,
    };
  }

  switch (input.status) {
    case 'DRAFT':
      return { reservationState: 'NONE', saleEligibility: 'NOT_READY', blockers, warnings };
    case 'CONFIRMED':
    case 'PREPARING':
    case 'READY':
      return { reservationState: 'ACTIVE', saleEligibility: 'ELIGIBLE', blockers, warnings };
    case 'COMPLETED':
      return { reservationState: 'CONSUMED', saleEligibility: 'CLOSED', blockers, warnings };
    case 'CANCELLED':
      return { reservationState: 'RELEASED', saleEligibility: 'CLOSED', blockers, warnings };
  }
}
