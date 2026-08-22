import type { SupplierInvoice } from '../domain/supplier-invoice';

export interface SupplierInvoiceRepository {
  list(): Promise<readonly SupplierInvoice[]>;
  getById(id: string): Promise<SupplierInvoice | null>;
  listBySupplierId(supplierId: string): Promise<readonly SupplierInvoice[]>;
}
