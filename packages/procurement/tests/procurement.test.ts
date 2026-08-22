import { describe, expect, it } from 'vitest';
import { INVOICE_PAYMENT_STATUSES, PURCHASE_STATUSES } from '../src';

describe('procurement states', () => {
  it('keeps purchase lifecycle explicit', () => {
    expect(PURCHASE_STATUSES).toEqual([
      'DRAFT',
      'CONFIRMED',
      'PARTIALLY_RECEIVED',
      'RECEIVED',
      'CANCELLED',
    ]);
  });

  it('keeps invoice payment lifecycle explicit', () => {
    expect(INVOICE_PAYMENT_STATUSES).toEqual([
      'PENDING',
      'PARTIAL',
      'PAID',
      'CANCELLED',
    ]);
  });
});
