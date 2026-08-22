export interface PurchaseItem {
  readonly id: string;
  readonly purchaseId: string;
  readonly productId: string;
  readonly quantityRequested: number;
  readonly quantityReceived: number;
  readonly quotedUnitCost: number | null;
  readonly finalUnitCost: number | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
