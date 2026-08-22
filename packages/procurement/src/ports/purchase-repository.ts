import type { CreatePurchaseDraftCommand } from '../application/commands/create-purchase-draft.command';
import type { ConfirmPurchaseCommand } from '../application/commands/confirm-purchase.command';
import type { ReceivePurchaseCommand } from '../application/commands/receive-purchase.command';
import type { Purchase } from '../domain/purchase';
import type { PurchaseItem } from '../domain/purchase-item';

export interface PurchaseRepository {
  list(): Promise<readonly Purchase[]>;
  getById(id: string): Promise<Purchase | null>;
  listItems(purchaseId: string): Promise<readonly PurchaseItem[]>;
  createDraft(command: CreatePurchaseDraftCommand): Promise<Purchase>;
  confirm(command: ConfirmPurchaseCommand): Promise<Purchase>;
  receive(command: ReceivePurchaseCommand): Promise<Purchase>;
}
