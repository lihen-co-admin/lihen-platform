import type { InventoryMovement } from '@lihen/inventory';
import type { Order, OrderItem } from '@lihen/orders';
import type { Sale } from '@lihen/sales';

export type OrderCancellationReconciliationStatus = 'PASS' | 'REVIEW' | 'BLOCKED';

export interface OrderCancellationReconciliationInput {
  readonly order: Order;
  readonly orderItems: readonly OrderItem[];
  readonly inventoryMovements: readonly InventoryMovement[];
  readonly sale: Sale | null;
}

export interface OrderCancellationReconciliationResult {
  readonly status: OrderCancellationReconciliationStatus;
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
  readonly expectedUnits: number;
  readonly reservedUnitsCreated: number;
  readonly reservedUnitsReleased: number;
}

export function reconcileCancelledOrder(
  input: OrderCancellationReconciliationInput,
): OrderCancellationReconciliationResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (input.order.status !== 'CANCELLED') {
    return {
      status: 'REVIEW',
      blockers,
      warnings: ['ORDER_NOT_CANCELLED'],
      expectedUnits: input.orderItems.reduce((sum, item) => sum + item.quantity, 0),
      reservedUnitsCreated: 0,
      reservedUnitsReleased: 0,
    };
  }

  if (input.sale) blockers.push('CANCELLED_ORDER_WITH_SALE');

  const expectedByProduct = new Map<string, number>();
  for (const item of input.orderItems) {
    expectedByProduct.set(item.productId, (expectedByProduct.get(item.productId) ?? 0) + item.quantity);
  }

  if (input.orderItems.length === 0) warnings.push('CANCELLED_ORDER_WITHOUT_ITEMS');

  let expectedUnits = 0;
  let reservedUnitsCreated = 0;
  let reservedUnitsReleased = 0;

  for (const [productId, expectedQuantity] of expectedByProduct) {
    expectedUnits += expectedQuantity;
    const related = input.inventoryMovements.filter((movement) => movement.productId === productId && movement.bucket === 'RESERVED');
    const created = related
      .filter((movement) => movement.reason === 'ORDER_CONFIRMED' && movement.quantityDelta > 0)
      .reduce((sum, movement) => sum + movement.quantityDelta, 0);
    const released = related
      .filter((movement) => movement.reason === 'ORDER_CANCELLED' && movement.quantityDelta < 0)
      .reduce((sum, movement) => sum + Math.abs(movement.quantityDelta), 0);

    reservedUnitsCreated += created;
    reservedUnitsReleased += released;

    if (created > 0 && created !== expectedQuantity) blockers.push(`CONFIRMED_RESERVATION_MISMATCH:${productId}`);
    if (created > 0 && released !== created) blockers.push(`CANCELLED_RESERVATION_RELEASE_MISMATCH:${productId}`);
    if (created === 0 && released > 0) blockers.push(`RESERVATION_RELEASE_WITHOUT_CONFIRMATION:${productId}`);
  }

  if (reservedUnitsCreated === 0 && reservedUnitsReleased === 0) {
    warnings.push('CANCELLED_FROM_DRAFT_NO_RESERVATION');
  }

  return {
    status: blockers.length > 0 ? 'BLOCKED' : warnings.length > 0 ? 'REVIEW' : 'PASS',
    blockers,
    warnings,
    expectedUnits,
    reservedUnitsCreated,
    reservedUnitsReleased,
  };
}
