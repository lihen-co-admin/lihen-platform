import type { InventoryBucket } from './inventory-bucket';

export interface InventoryMovement {
  readonly id: string;
  readonly productId: string;
  readonly bucket: InventoryBucket;
  readonly quantityDelta: number;
  readonly reason: string;
  readonly occurredAt: Date;
  readonly recordedAt: Date;
  readonly externalReference: string | null;
  readonly notes: string | null;
}
