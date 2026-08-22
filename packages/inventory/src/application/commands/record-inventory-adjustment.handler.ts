import type { InventoryRepository } from '../../ports/inventory-repository';
import type { RecordInventoryAdjustmentCommand } from './record-inventory-adjustment.command';

export class RecordInventoryAdjustmentHandler {
  public constructor(private readonly repository: InventoryRepository) {}

  public execute(command: RecordInventoryAdjustmentCommand) {
    if (!Number.isInteger(command.quantityDelta) || command.quantityDelta === 0) {
      throw new Error('Inventory adjustment quantity must be a non-zero integer.');
    }
    return this.repository.recordOnHandAdjustment(command);
  }
}
