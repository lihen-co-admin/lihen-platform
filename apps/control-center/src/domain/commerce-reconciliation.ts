import type { FinancialMovement } from '@lihen/finance';
import type { InventoryMovement } from '@lihen/inventory';
import type { Order } from '@lihen/orders';
import type { Sale, SaleItem } from '@lihen/sales';

export type CommerceReconciliationStatus = 'PASS' | 'REVIEW' | 'BLOCKED';

export interface CommerceReconciliationInput {
  readonly sale: Sale;
  readonly order: Order | null;
  readonly saleItems: readonly SaleItem[];
  readonly inventoryMovements: readonly InventoryMovement[];
  readonly financialMovements: readonly FinancialMovement[];
}

export interface CommerceReconciliationResult {
  readonly status: CommerceReconciliationStatus;
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
  readonly inventoryExpectedUnits: number;
  readonly inventoryOnHandUnits: number;
  readonly inventoryReservedUnits: number;
  readonly financeIncomeAmount: number;
  readonly financeMovementCount: number;
}

export function reconcileCommerceFlow(input: CommerceReconciliationInput): CommerceReconciliationResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (input.sale.status !== 'COMPLETED') {
    warnings.push('SALE_NOT_COMPLETED');
  }

  if (input.sale.orderId) {
    if (!input.order) blockers.push('ORDER_REFERENCE_NOT_FOUND');
    else if (input.order.status !== 'COMPLETED') blockers.push('ORDER_NOT_COMPLETED_AFTER_SALE');
  } else if (input.order) {
    warnings.push('UNEXPECTED_ORDER_CONTEXT_FOR_POS_SALE');
  }

  const expectedByProduct = new Map<string, number>();
  for (const item of input.saleItems) {
    expectedByProduct.set(item.productId, (expectedByProduct.get(item.productId) ?? 0) + item.quantity);
  }

  if (input.sale.status === 'COMPLETED' && input.saleItems.length === 0) {
    blockers.push('SALE_ITEMS_MISSING');
  }

  let inventoryExpectedUnits = 0;
  let inventoryOnHandUnits = 0;
  let inventoryReservedUnits = 0;

  for (const [productId, expectedQuantity] of expectedByProduct) {
    inventoryExpectedUnits += expectedQuantity;
    const related = input.inventoryMovements.filter((movement) => movement.productId === productId);
    const onHandDelta = related
      .filter((movement) => movement.bucket === 'ON_HAND')
      .reduce((sum, movement) => sum + movement.quantityDelta, 0);
    const reservedDelta = related
      .filter((movement) => movement.bucket === 'RESERVED')
      .reduce((sum, movement) => sum + movement.quantityDelta, 0);

    inventoryOnHandUnits += Math.abs(Math.min(onHandDelta, 0));
    inventoryReservedUnits += Math.abs(Math.min(reservedDelta, 0));

    if (onHandDelta !== -expectedQuantity) blockers.push(`ON_HAND_MISMATCH:${productId}`);

    if (input.sale.orderId) {
      if (reservedDelta !== -expectedQuantity) blockers.push(`RESERVED_MISMATCH:${productId}`);
    } else if (reservedDelta !== 0) {
      blockers.push(`POS_RESERVED_MOVEMENT_UNEXPECTED:${productId}`);
    }
  }

  const saleIncomeMovements = input.financialMovements.filter(
    (movement) => movement.movementType === 'SALE_INCOME' && movement.referenceType === 'SALE' && movement.referenceId === input.sale.id,
  );
  const financeIncomeAmount = saleIncomeMovements.reduce((sum, movement) => sum + movement.amountSigned, 0);

  if (input.sale.status === 'COMPLETED') {
    if (saleIncomeMovements.length === 0) blockers.push('SALE_INCOME_MISSING');
    if (saleIncomeMovements.length > 1) blockers.push('MULTIPLE_SALE_INCOME_MOVEMENTS');
    if (financeIncomeAmount !== input.sale.totalAmount) blockers.push('SALE_FINANCE_AMOUNT_MISMATCH');
    if (saleIncomeMovements.some((movement) => movement.accountId !== input.sale.financialAccountId)) {
      blockers.push('SALE_FINANCE_ACCOUNT_MISMATCH');
    }
  }

  return {
    status: blockers.length > 0 ? 'BLOCKED' : warnings.length > 0 ? 'REVIEW' : 'PASS',
    blockers,
    warnings,
    inventoryExpectedUnits,
    inventoryOnHandUnits,
    inventoryReservedUnits,
    financeIncomeAmount,
    financeMovementCount: saleIncomeMovements.length,
  };
}
