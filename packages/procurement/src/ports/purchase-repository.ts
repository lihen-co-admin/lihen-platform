import type { Purchase } from '../domain/purchase';
import type { PurchaseItem } from '../domain/purchase-item';

export interface PurchaseRepository {
  list(): Promise<readonly Purchase[]>;
  getById(id: string): Promise<Purchase | null>;
  listItems(purchaseId: string): Promise<readonly PurchaseItem[]>;
}
