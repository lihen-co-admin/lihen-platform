import type { InvoicePaymentStatus } from './invoice-payment-status';

export interface SupplierInvoice {
  readonly id: string;
  readonly supplierId: string;
  readonly purchaseId: string | null;
  readonly invoiceNumber: string;
  readonly invoiceDate: string | null;
  readonly dueDate: string | null;
  readonly paymentStatus: InvoicePaymentStatus;
  readonly subtotal: number;
  readonly discountAmount: number;
  readonly taxAmount: number;
  readonly freightAmount: number;
  readonly totalAmount: number;
  readonly amountPaid: number;
  readonly balanceDue: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
