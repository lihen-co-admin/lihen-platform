import type { InventoryAdjustmentReason } from '../../domain/inventory-adjustment-reason';

export interface RecordInventoryAdjustmentCommand {
  readonly operationKey: string;
  readonly movementId: string;
  readonly productId: string;
  readonly quantityDelta: number;
  readonly reason: InventoryAdjustmentReason;
  readonly occurredAt: Date;
  readonly notes: string | null;
}
