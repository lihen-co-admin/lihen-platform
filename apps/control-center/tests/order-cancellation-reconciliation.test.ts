import { describe, expect, it } from 'vitest';
import type { InventoryMovement } from '@lihen/inventory';
import type { Order, OrderItem } from '@lihen/orders';
import type { Sale } from '@lihen/sales';
import { reconcileCancelledOrder } from '../src/domain/order-cancellation-reconciliation';

const order: Order = {
  id: 'order-1',
  orderNumber: 'ORD-001',
  status: 'CANCELLED',
  channel: 'WHATSAPP',
  customerName: 'Cliente',
  customerPhone: null,
  notes: null,
  requestedAt: new Date('2026-08-27T10:00:00Z'),
  createdAt: new Date('2026-08-27T10:00:00Z'),
  updatedAt: new Date('2026-08-27T11:00:00Z'),
};

const items: readonly OrderItem[] = [
  { id: 'item-1', orderId: order.id, productId: 'product-1', quantity: 2, unitPrice: 10000, notes: null },
];

function movement(id: string, quantityDelta: number, reason: string): InventoryMovement {
  return {
    id,
    productId: 'product-1',
    bucket: 'RESERVED',
    quantityDelta,
    reason,
    occurredAt: new Date('2026-08-27T10:30:00Z'),
    recordedAt: new Date('2026-08-27T10:30:00Z'),
    externalReference: order.orderNumber,
    notes: null,
  };
}

describe('reconcileCancelledOrder', () => {
  it('passes when a confirmed reservation is fully released', () => {
    const result = reconcileCancelledOrder({
      order,
      orderItems: items,
      inventoryMovements: [movement('m1', 2, 'ORDER_CONFIRMED'), movement('m2', -2, 'ORDER_CANCELLED')],
      sale: null,
    });

    expect(result.status).toBe('PASS');
    expect(result.reservedUnitsCreated).toBe(2);
    expect(result.reservedUnitsReleased).toBe(2);
  });

  it('reviews a cancellation made directly from draft because no reservation existed', () => {
    const result = reconcileCancelledOrder({ order, orderItems: items, inventoryMovements: [], sale: null });

    expect(result.status).toBe('REVIEW');
    expect(result.warnings).toContain('CANCELLED_FROM_DRAFT_NO_RESERVATION');
  });

  it('blocks when a reservation was not fully released', () => {
    const result = reconcileCancelledOrder({
      order,
      orderItems: items,
      inventoryMovements: [movement('m1', 2, 'ORDER_CONFIRMED'), movement('m2', -1, 'ORDER_CANCELLED')],
      sale: null,
    });

    expect(result.status).toBe('BLOCKED');
    expect(result.blockers).toContain('CANCELLED_RESERVATION_RELEASE_MISMATCH:product-1');
  });

  it('blocks a cancelled order that already has a sale', () => {
    const sale: Sale = {
      id: 'sale-1',
      saleNumber: 'V-001',
      orderId: order.id,
      channel: 'WHATSAPP',
      status: 'COMPLETED',
      customerName: 'Cliente',
      occurredAt: new Date('2026-08-27T11:00:00Z'),
      totalAmount: 20000,
      financialAccountId: 'account-1',
      notes: null,
    };

    const result = reconcileCancelledOrder({ order, orderItems: items, inventoryMovements: [], sale });

    expect(result.status).toBe('BLOCKED');
    expect(result.blockers).toContain('CANCELLED_ORDER_WITH_SALE');
  });
});
