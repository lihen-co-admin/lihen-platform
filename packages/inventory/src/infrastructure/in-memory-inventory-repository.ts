import type { RecordInventoryAdjustmentCommand } from '../application/commands/record-inventory-adjustment.command';
import type { InventoryBalance } from '../domain/inventory-balance';
import type { InventoryMovement } from '../domain/inventory-movement';
import type { InventoryRepository } from '../ports/inventory-repository';

export class InMemoryInventoryRepository implements InventoryRepository {
  private readonly balances = new Map<string, InventoryBalance>();
  private readonly movements: InventoryMovement[] = [];
  public async listBalances() { return [...this.balances.values()]; }
  public async getBalance(productId: string) {
    return this.balances.get(productId) ?? { productId, stockOnHand: 0, stockReserved: 0, stockPending: 0, stockAvailable: 0 };
  }
  public async listMovements(productId: string) { return this.movements.filter((item) => item.productId === productId); }
  public async listMovementsByExternalReferences(externalReferences: readonly string[]) {
    const refs = new Set(externalReferences);
    return this.movements.filter((item) => item.externalReference !== null && refs.has(item.externalReference));
  }
  public async recordOnHandAdjustment(command: RecordInventoryAdjustmentCommand) {
    const current = await this.getBalance(command.productId);
    const stockOnHand = current.stockOnHand + command.quantityDelta;
    const stockAvailable = stockOnHand - current.stockReserved;
    if (stockOnHand < 0 || stockAvailable < 0) throw new Error('Inventory balance invariant would be violated.');
    const next = { ...current, stockOnHand, stockAvailable };
    this.balances.set(command.productId, next);
    this.movements.push({ id: command.movementId, productId: command.productId, bucket: 'ON_HAND', quantityDelta: command.quantityDelta, reason: command.reason, occurredAt: command.occurredAt, recordedAt: new Date(), externalReference: null, notes: command.notes });
    return next;
  }
}
