import type { InventoryRepository } from '../../ports/inventory-repository';

export class GetInventoryHandler {
  public constructor(private readonly repository: InventoryRepository) {}
  public execute() { return this.repository.listBalances(); }
}
