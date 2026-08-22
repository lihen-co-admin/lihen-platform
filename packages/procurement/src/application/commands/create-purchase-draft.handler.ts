import type { PurchaseRepository } from '../../ports/purchase-repository';
import type { CreatePurchaseDraftCommand } from './create-purchase-draft.command';

export class CreatePurchaseDraftHandler {
  public constructor(private readonly repository: PurchaseRepository) {}
  public execute(command: CreatePurchaseDraftCommand) {
    if (!command.purchaseNumber.trim()) throw new Error('PURCHASE_NUMBER_REQUIRED');
    if (!command.supplierId) throw new Error('PURCHASE_SUPPLIER_REQUIRED');
    if (command.items.length === 0) throw new Error('PURCHASE_ITEMS_REQUIRED');
    const seen = new Set<string>();
    for (const item of command.items) {
      if (!Number.isInteger(item.quantityRequested) || item.quantityRequested <= 0) throw new Error('PURCHASE_QUANTITY_INVALID');
      if (item.quotedUnitCost !== null && (!Number.isFinite(item.quotedUnitCost) || item.quotedUnitCost < 0)) throw new Error('PURCHASE_COST_INVALID');
      if (seen.has(item.productId)) throw new Error('PURCHASE_DUPLICATE_PRODUCT');
      seen.add(item.productId);
    }
    return this.repository.createDraft(command);
  }
}
