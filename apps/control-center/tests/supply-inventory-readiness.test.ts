import { expect, it } from 'vitest';
import type { InventoryBalance } from '@lihen/inventory';
import type { Purchase, PurchaseItem } from '@lihen/procurement';
import { evaluateSupplyInventoryReadiness } from '../src/domain/supply-inventory-readiness';

const purchase: Purchase = {
  id: 'purchase-1', purchaseNumber: 'PO-1', supplierId: 'supplier-1', status: 'CONFIRMED',
  purchaseDate: '2026-08-20', expectedDate: '2026-08-30', receivedAt: null, notes: null,
  historical: false, createdAt: new Date(), updatedAt: new Date(),
};
const item: PurchaseItem = {
  id: 'item-1', purchaseId: 'purchase-1', productId: 'product-1', quantityRequested: 10,
  quantityReceived: 2, quotedUnitCost: 1000, finalUnitCost: null, createdAt: new Date(), updatedAt: new Date(),
};
const balance: InventoryBalance = { productId: 'product-1', stockOnHand: 2, stockReserved: 0, stockPending: 8, stockAvailable: 2 };

it('is ready when open purchases and pending stock reconcile', () => {
  const result = evaluateSupplyInventoryReadiness([balance], [purchase], new Map([[purchase.id, [item]]]), '2026-08-27');
  expect(result.status).toBe('READY');
  expect(result.pendingMismatchProducts).toBe(0);
});

it('blocks when PENDING_IN differs from open purchase remaining units', () => {
  const result = evaluateSupplyInventoryReadiness([{ ...balance, stockPending: 7 }], [purchase], new Map([[purchase.id, [item]]]), '2026-08-27');
  expect(result.status).toBe('BLOCKED');
  expect(result.pendingMismatchProducts).toBe(1);
});

it('blocks negative buckets even if supply pending reconciles', () => {
  const result = evaluateSupplyInventoryReadiness([{ ...balance, stockAvailable: -1 }], [purchase], new Map([[purchase.id, [item]]]), '2026-08-27');
  expect(result.status).toBe('BLOCKED');
});

it('requires review for overdue open purchases without integrity mismatches', () => {
  const overdue = { ...purchase, expectedDate: '2026-08-26' };
  const result = evaluateSupplyInventoryReadiness([balance], [overdue], new Map([[purchase.id, [item]]]), '2026-08-27');
  expect(result.status).toBe('REVIEW');
  expect(result.overdueOpenPurchases).toBe(1);
});
