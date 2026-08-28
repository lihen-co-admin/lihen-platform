import type { InventoryBalance } from '@lihen/inventory';
import type { Purchase, PurchaseItem } from '@lihen/procurement';

export type SupplyInventoryReadinessStatus = 'READY' | 'REVIEW' | 'BLOCKED';

export interface SupplyInventoryPendingLine {
  readonly productId: string;
  readonly expectedPendingUnits: number;
  readonly ledgerPendingUnits: number;
  readonly difference: number;
}

export interface SupplyInventoryReadiness {
  readonly status: SupplyInventoryReadinessStatus;
  readonly negativeBalanceProducts: number;
  readonly overdueOpenPurchases: number;
  readonly pendingMismatchProducts: number;
  readonly expectedPendingUnits: number;
  readonly ledgerPendingUnits: number;
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
  readonly pendingLines: readonly SupplyInventoryPendingLine[];
}

function isOpenSupplyPurchase(purchase: Purchase): boolean {
  return purchase.status === 'CONFIRMED' || purchase.status === 'PARTIALLY_RECEIVED';
}

export function evaluateSupplyInventoryReadiness(
  balances: readonly InventoryBalance[],
  purchases: readonly Purchase[],
  itemsByPurchase: ReadonlyMap<string, readonly PurchaseItem[]>,
  todayIso: string,
): SupplyInventoryReadiness {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const expectedByProduct = new Map<string, number>();

  for (const purchase of purchases.filter(isOpenSupplyPurchase)) {
    for (const item of itemsByPurchase.get(purchase.id) ?? []) {
      const remaining = Math.max(0, item.quantityRequested - item.quantityReceived);
      expectedByProduct.set(item.productId, (expectedByProduct.get(item.productId) ?? 0) + remaining);
    }
  }

  const balanceByProduct = new Map(balances.map((balance) => [balance.productId, balance]));
  const productIds = new Set([...expectedByProduct.keys(), ...balanceByProduct.keys()]);
  const pendingLines = [...productIds].map<SupplyInventoryPendingLine>((productId) => {
    const expectedPendingUnits = expectedByProduct.get(productId) ?? 0;
    const ledgerPendingUnits = balanceByProduct.get(productId)?.stockPending ?? 0;
    return { productId, expectedPendingUnits, ledgerPendingUnits, difference: ledgerPendingUnits - expectedPendingUnits };
  }).filter((line) => line.expectedPendingUnits !== 0 || line.ledgerPendingUnits !== 0);

  const negativeBalanceProducts = balances.filter((balance) =>
    balance.stockOnHand < 0 || balance.stockReserved < 0 || balance.stockPending < 0 || balance.stockAvailable < 0,
  ).length;
  const pendingMismatchProducts = pendingLines.filter((line) => line.difference !== 0).length;
  const overdueOpenPurchases = purchases.filter((purchase) =>
    isOpenSupplyPurchase(purchase) && purchase.expectedDate !== null && purchase.expectedDate < todayIso,
  ).length;

  if (negativeBalanceProducts > 0) blockers.push(`${negativeBalanceProducts} producto(s) presentan buckets negativos.`);
  if (pendingMismatchProducts > 0) blockers.push(`${pendingMismatchProducts} producto(s) no concilian entre compras abiertas y PENDING_IN.`);
  if (overdueOpenPurchases > 0) warnings.push(`${overdueOpenPurchases} compra(s) abierta(s) superaron su fecha esperada.`);

  return {
    status: blockers.length > 0 ? 'BLOCKED' : warnings.length > 0 ? 'REVIEW' : 'READY',
    negativeBalanceProducts,
    overdueOpenPurchases,
    pendingMismatchProducts,
    expectedPendingUnits: pendingLines.reduce((sum, line) => sum + line.expectedPendingUnits, 0),
    ledgerPendingUnits: pendingLines.reduce((sum, line) => sum + line.ledgerPendingUnits, 0),
    blockers,
    warnings,
    pendingLines,
  };
}
