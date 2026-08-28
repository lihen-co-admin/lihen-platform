import { describe, expect, it } from 'vitest';
import type { InventoryMovement } from '@lihen/inventory';
import type { Purchase, PurchaseItem } from '@lihen/procurement';
import { reconcilePurchaseWithInventory } from '../src/domain/supply-inventory-reconciliation';

const purchaseBase: Purchase = {
  id: 'purchase-1',
  purchaseNumber: 'PO-001',
  supplierId: 'supplier-1',
  status: 'CONFIRMED',
  purchaseDate: '2026-08-27',
  expectedDate: null,
  receivedAt: null,
  notes: null,
  historical: false,
  createdAt: new Date('2026-08-27T00:00:00Z'),
  updatedAt: new Date('2026-08-27T00:00:00Z'),
};

const item: PurchaseItem = {
  id: 'item-1', purchaseId: 'purchase-1', productId: 'product-1', quantityRequested: 10,
  quantityReceived: 0, quotedUnitCost: 1000, finalUnitCost: null,
  createdAt: new Date('2026-08-27T00:00:00Z'), updatedAt: new Date('2026-08-27T00:00:00Z'),
};

function movement(overrides: Partial<InventoryMovement>): InventoryMovement {
  return {
    id: crypto.randomUUID(), productId: 'product-1', bucket: 'PENDING_IN', quantityDelta: 10,
    reason: 'PURCHASE_CONFIRMED', occurredAt: new Date('2026-08-27T00:01:00Z'),
    recordedAt: new Date('2026-08-27T00:01:00Z'), externalReference: 'PO-001', notes: null,
    ...overrides,
  };
}

describe('reconcilePurchaseWithInventory', () => {
  it('passes when confirmed purchase matches PENDING_IN', () => {
    const result = reconcilePurchaseWithInventory(purchaseBase, [item], new Map([
      ['product-1', [movement({})]],
    ]));
    expect(result.status).toBe('PASS');
    expect(result.ledgerPendingUnits).toBe(10);
    expect(result.ledgerReceivedOnHandUnits).toBe(0);
  });

  it('passes after partial receipt when pending and ON_HAND match the purchase', () => {
    const purchase: Purchase = { ...purchaseBase, status: 'PARTIALLY_RECEIVED' };
    const partialItem: PurchaseItem = { ...item, quantityReceived: 4 };
    const movements = [
      movement({ quantityDelta: 10, bucket: 'PENDING_IN', reason: 'PURCHASE_CONFIRMED' }),
      movement({ quantityDelta: -4, bucket: 'PENDING_IN', reason: 'PURCHASE_RECEIVED' }),
      movement({ quantityDelta: 4, bucket: 'ON_HAND', reason: 'PURCHASE_RECEIVED' }),
    ];
    const result = reconcilePurchaseWithInventory(purchase, [partialItem], new Map([['product-1', movements]]));
    expect(result.status).toBe('PASS');
    expect(result.expectedPendingUnits).toBe(6);
    expect(result.ledgerPendingUnits).toBe(6);
    expect(result.ledgerReceivedOnHandUnits).toBe(4);
  });

  it('detects a pending mismatch without mutating data', () => {
    const result = reconcilePurchaseWithInventory(purchaseBase, [item], new Map([
      ['product-1', [movement({ quantityDelta: 8 })]],
    ]));
    expect(result.status).toBe('MISMATCH');
    expect(result.mismatchedLines).toBe(1);
    expect(result.lines[0]?.pendingDifference).toBe(-2);
  });

  it('ignores movements belonging to another purchase reference', () => {
    const result = reconcilePurchaseWithInventory(purchaseBase, [item], new Map([
      ['product-1', [movement({ externalReference: 'PO-OTHER' })]],
    ]));
    expect(result.status).toBe('MISMATCH');
    expect(result.ledgerPendingUnits).toBe(0);
  });

  it('marks drafts as not applicable because they must not have supply ledger effects', () => {
    const draft: Purchase = { ...purchaseBase, status: 'DRAFT' };
    const result = reconcilePurchaseWithInventory(draft, [item], new Map());
    expect(result.status).toBe('NOT_APPLICABLE');
  });
});
