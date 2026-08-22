export const SUPPLIER_STATUSES = ['ACTIVE', 'INACTIVE'] as const;

export type SupplierStatus = (typeof SUPPLIER_STATUSES)[number];

export function isSupplierStatus(value: string): value is SupplierStatus {
  return SUPPLIER_STATUSES.includes(value as SupplierStatus);
}
