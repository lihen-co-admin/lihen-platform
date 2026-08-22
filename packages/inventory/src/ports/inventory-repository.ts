import type { InventoryBalance } from '../domain/inventory-balance';
import type { InventoryMovement } from '../domain/inventory-movement';

export interface InventoryRepository {
  getBalance(productId: string): Promise<InventoryBalance>;
  listMovements(productId: string): Promise<readonly InventoryMovement[]>;
}
