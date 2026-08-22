export const PURCHASE_CREATED_EVENT = 'PURCHASE_CREATED' as const;

export interface PurchaseCreatedEvent {
  readonly eventId: string;
  readonly eventType: typeof PURCHASE_CREATED_EVENT;
  readonly aggregateId: string;
  readonly occurredAt: Date;
  readonly payload: {
    readonly supplierId: string;
    readonly currency: string;
    readonly status: string;
  };
}
