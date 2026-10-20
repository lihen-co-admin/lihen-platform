import { describe, expect, it } from 'vitest';
import { purchaseLinesHaveChanges, type PurchaseFormLine } from '../src/drafts/purchase-form';

const empty: PurchaseFormLine = { key: 'line-a', productId: '', quantity: '1', cost: '' };

describe('purchase form protection', () => {
  it('does not warn for the initial empty line or its regenerated identity', () => {
    expect(purchaseLinesHaveChanges([empty])).toBe(false);
    expect(purchaseLinesHaveChanges([{ ...empty, key: 'line-b' }])).toBe(false);
  });
  it('warns when only cost has been edited, including a zero cost', () => {
    expect(purchaseLinesHaveChanges([{ ...empty, cost: '1500' }])).toBe(true);
    expect(purchaseLinesHaveChanges([{ ...empty, cost: '0' }])).toBe(true);
  });
  it('keeps quantity, product and additional lines protected', () => {
    expect(purchaseLinesHaveChanges([{ ...empty, quantity: '2' }])).toBe(true);
    expect(purchaseLinesHaveChanges([{ ...empty, productId: 'product-a' }])).toBe(true);
    expect(purchaseLinesHaveChanges([empty, { ...empty, key: 'line-b' }])).toBe(true);
  });
});
