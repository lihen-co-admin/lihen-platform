export interface SupplierProduct {
  readonly id: string;
  readonly supplierId: string;
  readonly productId: string;
  readonly supplierReference: string | null;
  readonly lastCost: number | null;
  readonly lastConfirmedAt: Date | null;
  readonly usualDeliveryDays: number | null;
  readonly preferred: boolean;
  readonly active: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
