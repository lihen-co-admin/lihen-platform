import { evaluateInventoryAdjustmentPolicy } from '../../domain/inventory-adjustment-policy';
import type { InventoryRepository } from '../../ports/inventory-repository';
import type { RecordInventoryAdjustmentCommand } from './record-inventory-adjustment.command';

export class RecordInventoryAdjustmentHandler {
  public constructor(private readonly repository: InventoryRepository) {}

  public execute(command: RecordInventoryAdjustmentCommand) {
    const policy = evaluateInventoryAdjustmentPolicy(command);
    if (!policy.allowed) {
      throw new Error(`Inventory adjustment blocked: ${policy.blockers.join(' ')}`);
    }
    return this.repository.recordOnHandAdjustment(command);
  }
}
