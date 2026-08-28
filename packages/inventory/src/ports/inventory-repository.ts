import type { RecordInventoryAdjustmentCommand } from '../application/commands/record-inventory-adjustment.command';
import type { InventoryBalance } from '../domain/inventory-balance';
import type { InventoryMovement } from '../domain/inventory-movement';

export interface InventoryRepository {
  listBalances(): Promise<readonly InventoryBalance[]>;
  getBalance(productId: string): Promise<InventoryBalance>;
  listMovements(productId: string): Promise<readonly InventoryMovement[]>;
  listMovementsByExternalReferences(externalReferences: readonly string[]): Promise<readonly InventoryMovement[]>;
  recordOnHandAdjustment(command: RecordInventoryAdjustmentCommand): Promise<InventoryBalance>;
}
