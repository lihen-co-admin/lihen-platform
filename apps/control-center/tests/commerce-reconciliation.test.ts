import { describe, expect, it } from 'vitest';
import type { FinancialMovement } from '@lihen/finance';
import type { InventoryMovement } from '@lihen/inventory';
import type { Order } from '@lihen/orders';
import type { Sale, SaleItem } from '@lihen/sales';
import { reconcileCommerceFlow } from '../src/domain/commerce-reconciliation';

const sale: Sale = { id: 'sale-1', saleNumber: 'V-1', orderId: 'order-1', channel: 'WHATSAPP', status: 'COMPLETED', customerName: 'Cliente', occurredAt: new Date('2026-08-27T12:00:00Z'), totalAmount: 30000, financialAccountId: 'account-1', notes: null };
const order: Order = { id: 'order-1', orderNumber: 'P-1', status: 'COMPLETED', channel: 'WHATSAPP', customerName: 'Cliente', customerPhone: null, notes: null, requestedAt: null, createdAt: new Date('2026-08-27T11:00:00Z'), updatedAt: new Date('2026-08-27T12:00:00Z') };
const items: SaleItem[] = [{ id: 'item-1', saleId: sale.id, productId: 'product-1', quantity: 2, unitPrice: 15000 }];
const movement = (bucket: 'ON_HAND' | 'RESERVED', quantityDelta: number): InventoryMovement => ({ id: `${bucket}-${quantityDelta}`, productId: 'product-1', bucket, quantityDelta, reason: 'SALE_COMPLETED', occurredAt: sale.occurredAt, recordedAt: sale.occurredAt, externalReference: sale.id, notes: null });
const finance = (amountSigned = 30000, accountId = 'account-1'): FinancialMovement => ({ id: 'finance-1', accountId, movementType: 'SALE_INCOME', amountSigned, currency: 'COP', occurredAt: sale.occurredAt, description: 'Ingreso venta', referenceType: 'SALE', referenceId: sale.id, reversalOfId: null });

describe('commerce reconciliation', () => {
  it('passes when order, inventory and finance agree with the sale', () => {
    const result = reconcileCommerceFlow({ sale, order, saleItems: items, inventoryMovements: [movement('RESERVED', -2), movement('ON_HAND', -2)], financialMovements: [finance()] });
    expect(result.status).toBe('PASS');
    expect(result.blockers).toEqual([]);
  });

  it('blocks when finance income is missing', () => {
    const result = reconcileCommerceFlow({ sale, order, saleItems: items, inventoryMovements: [movement('RESERVED', -2), movement('ON_HAND', -2)], financialMovements: [] });
    expect(result.blockers).toContain('SALE_INCOME_MISSING');
  });

  it('blocks when the order was not closed after sale completion', () => {
    const result = reconcileCommerceFlow({ sale, order: { ...order, status: 'READY' }, saleItems: items, inventoryMovements: [movement('RESERVED', -2), movement('ON_HAND', -2)], financialMovements: [finance()] });
    expect(result.blockers).toContain('ORDER_NOT_COMPLETED_AFTER_SALE');
  });

  it('blocks an ON_HAND mismatch', () => {
    const result = reconcileCommerceFlow({ sale, order, saleItems: items, inventoryMovements: [movement('RESERVED', -2), movement('ON_HAND', -1)], financialMovements: [finance()] });
    expect(result.blockers).toContain('ON_HAND_MISMATCH:product-1');
  });

  it('does not require RESERVED consumption for POS sales', () => {
    const posSale = { ...sale, orderId: null, channel: 'IN_PERSON' };
    const result = reconcileCommerceFlow({ sale: posSale, order: null, saleItems: items.map((item) => ({ ...item, saleId: posSale.id })), inventoryMovements: [movement('ON_HAND', -2)], financialMovements: [finance()] });
    expect(result.status).toBe('PASS');
  });

  it('blocks finance amount/account mismatches', () => {
    const result = reconcileCommerceFlow({ sale, order, saleItems: items, inventoryMovements: [movement('RESERVED', -2), movement('ON_HAND', -2)], financialMovements: [finance(25000, 'account-2')] });
    expect(result.blockers).toContain('SALE_FINANCE_AMOUNT_MISMATCH');
    expect(result.blockers).toContain('SALE_FINANCE_ACCOUNT_MISMATCH');
  });
});
