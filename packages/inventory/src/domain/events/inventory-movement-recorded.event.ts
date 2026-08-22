export const INVENTORY_MOVEMENT_RECORDED_EVENT = 'INVENTORY_MOVEMENT_RECORDED' as const;

export interface InventoryMovementRecordedEvent {
  readonly eventId: string;
  readonly eventType: typeof INVENTORY_MOVEMENT_RECORDED_EVENT;
  readonly aggregateId: string;
  readonly occurredAt: Date;
  readonly payload: {
    readonly productId: string;
    readonly bucket: string;
    readonly quantityDelta: number;
    readonly reason: string;
  };
}
