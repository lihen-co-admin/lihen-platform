import type { InventoryRepository } from '../../ports/inventory-repository';

export class GetInventoryMovementsHandler {
  public constructor(private readonly repository: InventoryRepository) {}
  public execute(productId: string) { return this.repository.listMovements(productId); }
}
