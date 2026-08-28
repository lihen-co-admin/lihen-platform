import type { InventoryMovement } from '@lihen/inventory';
import type { Purchase, PurchaseItem } from '@lihen/procurement';

export type SupplyInventoryReconciliationStatus = 'PASS' | 'MISMATCH' | 'NOT_APPLICABLE';

export interface SupplyInventoryLineReconciliation {
  readonly purchaseItemId: string;
  readonly productId: string;
  readonly requestedUnits: number;
  readonly receivedUnits: number;
  readonly expectedPendingUnits: number;
  readonly ledgerPendingUnits: number;
  readonly ledgerReceivedOnHandUnits: number;
  readonly pendingDifference: number;
  readonly receivedDifference: number;
  readonly status: SupplyInventoryReconciliationStatus;
}

export interface SupplyInventoryReconciliation {
  readonly purchaseId: string;
  readonly purchaseNumber: string;
  readonly status: SupplyInventoryReconciliationStatus;
  readonly expectedPendingUnits: number;
  readonly ledgerPendingUnits: number;
  readonly expectedReceivedUnits: number;
  readonly ledgerReceivedOnHandUnits: number;
  readonly mismatchedLines: number;
  readonly lines: readonly SupplyInventoryLineReconciliation[];
}

function sumMovement(
  movements: readonly InventoryMovement[],
  purchaseNumber: string,
  bucket: InventoryMovement['bucket'],
  reason?: string,
): number {
  return movements
    .filter((movement) => movement.externalReference === purchaseNumber)
    .filter((movement) => movement.bucket === bucket)
    .filter((movement) => reason === undefined || movement.reason === reason)
    .reduce((sum, movement) => sum + movement.quantityDelta, 0);
}

export function reconcilePurchaseWithInventory(
  purchase: Purchase,
  items: readonly PurchaseItem[],
  movementsByProduct: ReadonlyMap<string, readonly InventoryMovement[]>,
): SupplyInventoryReconciliation {
  const applicable = ['CONFIRMED', 'PARTIALLY_RECEIVED', 'RECEIVED'].includes(purchase.status);

  const lines = items.map<SupplyInventoryLineReconciliation>((item) => {
    const movements = movementsByProduct.get(item.productId) ?? [];
    const expectedPendingUnits = Math.max(0, item.quantityRequested - item.quantityReceived);
    const ledgerPendingUnits = sumMovement(movements, purchase.purchaseNumber, 'PENDING_IN');
    const ledgerReceivedOnHandUnits = sumMovement(movements, purchase.purchaseNumber, 'ON_HAND', 'PURCHASE_RECEIVED');
    const pendingDifference = ledgerPendingUnits - expectedPendingUnits;
    const receivedDifference = ledgerReceivedOnHandUnits - item.quantityReceived;
    const status: SupplyInventoryReconciliationStatus = !applicable
      ? 'NOT_APPLICABLE'
      : pendingDifference === 0 && receivedDifference === 0
        ? 'PASS'
        : 'MISMATCH';

    return {
      purchaseItemId: item.id,
      productId: item.productId,
      requestedUnits: item.quantityRequested,
      receivedUnits: item.quantityReceived,
      expectedPendingUnits,
      ledgerPendingUnits,
      ledgerReceivedOnHandUnits,
      pendingDifference,
      receivedDifference,
      status,
    };
  });

  const expectedPendingUnits = lines.reduce((sum, line) => sum + line.expectedPendingUnits, 0);
  const ledgerPendingUnits = lines.reduce((sum, line) => sum + line.ledgerPendingUnits, 0);
  const expectedReceivedUnits = lines.reduce((sum, line) => sum + line.receivedUnits, 0);
  const ledgerReceivedOnHandUnits = lines.reduce((sum, line) => sum + line.ledgerReceivedOnHandUnits, 0);
  const mismatchedLines = lines.filter((line) => line.status === 'MISMATCH').length;
  const status: SupplyInventoryReconciliationStatus = !applicable
    ? 'NOT_APPLICABLE'
    : mismatchedLines === 0
      ? 'PASS'
      : 'MISMATCH';

  return {
    purchaseId: purchase.id,
    purchaseNumber: purchase.purchaseNumber,
    status,
    expectedPendingUnits,
    ledgerPendingUnits,
    expectedReceivedUnits,
    ledgerReceivedOnHandUnits,
    mismatchedLines,
    lines,
  };
}
