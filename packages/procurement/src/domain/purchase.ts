import type { PurchaseStatus } from './purchase-status';

export interface Purchase {
  readonly id: string;
  readonly purchaseNumber: string;
  readonly supplierId: string;
  readonly status: PurchaseStatus;
  readonly purchaseDate: string | null;
  readonly expectedDate: string | null;
  readonly receivedAt: Date | null;
  readonly notes: string | null;
  readonly historical: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
