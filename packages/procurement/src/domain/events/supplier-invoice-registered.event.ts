export const SUPPLIER_INVOICE_REGISTERED_EVENT = 'SUPPLIER_INVOICE_REGISTERED' as const;

export interface SupplierInvoiceRegisteredEvent {
  readonly eventId: string;
  readonly eventType: typeof SUPPLIER_INVOICE_REGISTERED_EVENT;
  readonly aggregateId: string;
  readonly occurredAt: Date;
  readonly payload: {
    readonly supplierId: string;
    readonly invoiceNumber: string | null;
    readonly totalAmount: number;
    readonly currency: string;
  };
}
