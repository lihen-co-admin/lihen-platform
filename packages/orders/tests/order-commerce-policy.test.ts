import { describe, expect, it } from 'vitest';
import { evaluateOrderCommercePolicy, isOrderEligibleForSale } from '../src/domain/order-commerce-policy';

describe('order commerce policy', () => {
  it('keeps draft orders outside sale eligibility and without reservation', () => {
    expect(evaluateOrderCommercePolicy({ status: 'DRAFT' })).toEqual({
      reservationState: 'NONE',
      saleEligibility: 'NOT_READY',
      blockers: [],
      warnings: [],
    });
  });

  it('treats confirmed, preparing and ready orders as sale eligible with active reservation', () => {
    for (const status of ['CONFIRMED', 'PREPARING', 'READY'] as const) {
      expect(isOrderEligibleForSale(status)).toBe(true);
      expect(evaluateOrderCommercePolicy({ status })).toMatchObject({
        reservationState: 'ACTIVE',
        saleEligibility: 'ELIGIBLE',
        blockers: [],
      });
    }
  });

  it('requires completed orders to have a completed sale', () => {
    expect(evaluateOrderCommercePolicy({ status: 'COMPLETED', hasCompletedSale: false })).toMatchObject({
      saleEligibility: 'INVALID',
      blockers: ['COMPLETED_ORDER_WITHOUT_SALE'],
    });
  });

  it('closes a completed order only when the sale exists', () => {
    expect(evaluateOrderCommercePolicy({ status: 'COMPLETED', hasCompletedSale: true })).toEqual({
      reservationState: 'CONSUMED',
      saleEligibility: 'CLOSED',
      blockers: [],
      warnings: [],
    });
  });

  it('rejects sale/order status mismatches', () => {
    expect(evaluateOrderCommercePolicy({ status: 'CONFIRMED', hasCompletedSale: true })).toMatchObject({
      saleEligibility: 'INVALID',
      blockers: ['SALE_ORDER_STATUS_MISMATCH'],
    });
  });
});
