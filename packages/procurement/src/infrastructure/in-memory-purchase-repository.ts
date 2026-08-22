import type { ConfirmPurchaseCommand } from '../application/commands/confirm-purchase.command';
import type { CreatePurchaseDraftCommand } from '../application/commands/create-purchase-draft.command';
import type { ReceivePurchaseCommand } from '../application/commands/receive-purchase.command';
import type { Purchase } from '../domain/purchase';
import type { PurchaseItem } from '../domain/purchase-item';
import type { PurchaseRepository } from '../ports/purchase-repository';

export class InMemoryPurchaseRepository implements PurchaseRepository {
  private readonly purchases = new Map<string, Purchase>();
  private readonly items = new Map<string, PurchaseItem[]>();

  public async list() { return [...this.purchases.values()]; }
  public async getById(id: string) { return this.purchases.get(id) ?? null; }
  public async listItems(id: string) { return this.items.get(id) ?? []; }

  public async createDraft(c: CreatePurchaseDraftCommand) {
    const now = new Date();
    const purchase: Purchase = {
      id: c.purchaseId,
      purchaseNumber: c.purchaseNumber.trim(),
      supplierId: c.supplierId,
      status: 'DRAFT',
      purchaseDate: c.purchaseDate,
      expectedDate: c.expectedDate,
      receivedAt: null,
      notes: c.notes,
      historical: false,
      createdAt: now,
      updatedAt: now,
    };
    this.purchases.set(purchase.id, purchase);
    this.items.set(purchase.id, c.items.map((i) => ({
      id: i.id,
      purchaseId: purchase.id,
      productId: i.productId,
      quantityRequested: i.quantityRequested,
      quantityReceived: 0,
      quotedUnitCost: i.quotedUnitCost,
      finalUnitCost: null,
      createdAt: now,
      updatedAt: now,
    })));
    return purchase;
  }

  public async confirm(command: ConfirmPurchaseCommand) {
    const current = this.purchases.get(command.purchaseId);
    if (!current) throw new Error('PURCHASE_NOT_FOUND');
    if (current.status !== 'DRAFT') throw new Error('PURCHASE_CONFIRM_REQUIRES_DRAFT');
    const updated: Purchase = { ...current, status: 'CONFIRMED', updatedAt: new Date() };
    this.purchases.set(updated.id, updated);
    return updated;
  }

  public async receive(command: ReceivePurchaseCommand) {
    const current = this.purchases.get(command.purchaseId);
    if (!current) throw new Error('PURCHASE_NOT_FOUND');
    if (!['CONFIRMED', 'PARTIALLY_RECEIVED'].includes(current.status)) throw new Error('PURCHASE_RECEIVE_REQUIRES_CONFIRMED');
    const currentItems = this.items.get(command.purchaseId) ?? [];
    const receivedById = new Map(command.lines.map((line) => [line.purchaseItemId, line]));
    const nextItems = currentItems.map((item) => {
      const line = receivedById.get(item.id);
      if (!line) return item;
      if (item.quantityReceived + line.quantityReceived > item.quantityRequested) throw new Error('PURCHASE_OVER_RECEIPT');
      return { ...item, quantityReceived: item.quantityReceived + line.quantityReceived, finalUnitCost: line.finalUnitCost, updatedAt: new Date() };
    });
    this.items.set(command.purchaseId, nextItems);
    const remaining = nextItems.reduce((sum, item) => sum + item.quantityRequested - item.quantityReceived, 0);
    const updated: Purchase = {
      ...current,
      status: remaining === 0 ? 'RECEIVED' : 'PARTIALLY_RECEIVED',
      receivedAt: remaining === 0 ? command.receivedAt : current.receivedAt,
      updatedAt: new Date(),
    };
    this.purchases.set(updated.id, updated);
    return updated;
  }
}
