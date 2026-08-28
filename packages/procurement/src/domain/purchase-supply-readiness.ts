import type { Purchase } from './purchase';
import type { PurchaseItem } from './purchase-item';

export type PurchaseSupplyReadinessStatus =
  | 'DRAFT'
  | 'AWAITING_RECEIPT'
  | 'PARTIAL_RECEIPT'
  | 'RECEIVED'
  | 'CANCELLED';

export interface PurchaseSupplyReadiness {
  readonly status: PurchaseSupplyReadinessStatus;
  readonly requestedUnits: number;
  readonly receivedUnits: number;
  readonly remainingUnits: number;
  readonly receiptProgressPercent: number;
  readonly overdue: boolean;
  readonly canConfirm: boolean;
  readonly canReceive: boolean;
  readonly blockers: readonly string[];
}

function toDay(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function evaluatePurchaseSupplyReadiness(
  purchase: Purchase,
  items: readonly PurchaseItem[],
  now: Date = new Date(),
): PurchaseSupplyReadiness {
  const requestedUnits = items.reduce((sum, item) => sum + item.quantityRequested, 0);
  const receivedUnits = items.reduce((sum, item) => sum + item.quantityReceived, 0);
  const remainingUnits = Math.max(0, requestedUnits - receivedUnits);
  const receiptProgressPercent = requestedUnits === 0
    ? 0
    : Math.min(100, Math.round((receivedUnits / requestedUnits) * 100));

  const blockers: string[] = [];
  if (items.length === 0) blockers.push('La compra no tiene líneas de producto.');
  if (items.some((item) => item.quantityRequested <= 0)) blockers.push('Hay líneas con cantidad solicitada no válida.');
  if (items.some((item) => item.quantityReceived < 0 || item.quantityReceived > item.quantityRequested)) {
    blockers.push('La recepción acumulada no es consistente con la cantidad solicitada.');
  }

  const canConfirm = purchase.status === 'DRAFT' && blockers.length === 0;
  const canReceive = ['CONFIRMED', 'PARTIALLY_RECEIVED'].includes(purchase.status)
    && remainingUnits > 0
    && blockers.length === 0;

  const overdue = Boolean(
    purchase.expectedDate
      && ['CONFIRMED', 'PARTIALLY_RECEIVED'].includes(purchase.status)
      && remainingUnits > 0
      && purchase.expectedDate < toDay(now),
  );

  let status: PurchaseSupplyReadinessStatus;
  if (purchase.status === 'CANCELLED') status = 'CANCELLED';
  else if (purchase.status === 'RECEIVED' || remainingUnits === 0 && receivedUnits > 0) status = 'RECEIVED';
  else if (purchase.status === 'PARTIALLY_RECEIVED' || receivedUnits > 0) status = 'PARTIAL_RECEIPT';
  else if (purchase.status === 'CONFIRMED') status = 'AWAITING_RECEIPT';
  else status = 'DRAFT';

  return {
    status,
    requestedUnits,
    receivedUnits,
    remainingUnits,
    receiptProgressPercent,
    overdue,
    canConfirm,
    canReceive,
    blockers,
  };
}
