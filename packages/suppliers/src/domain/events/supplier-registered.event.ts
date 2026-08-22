export const SUPPLIER_REGISTERED_EVENT = 'SUPPLIER_REGISTERED' as const;

export interface SupplierRegisteredEvent {
  readonly eventId: string;
  readonly eventType: typeof SUPPLIER_REGISTERED_EVENT;
  readonly aggregateId: string;
  readonly occurredAt: Date;
  readonly payload: {
    readonly name: string;
    readonly status: string;
  };
}
