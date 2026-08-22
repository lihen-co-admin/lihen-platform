export const INVOICE_PAYMENT_STATUSES = [
  'PENDING',
  'PARTIAL',
  'PAID',
  'CANCELLED',
] as const;

export type InvoicePaymentStatus = (typeof INVOICE_PAYMENT_STATUSES)[number];
