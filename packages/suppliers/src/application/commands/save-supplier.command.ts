import type { SupplierStatus } from '../../domain/supplier-status';

export interface SaveSupplierCommand {
  readonly operationKey: string;
  readonly supplierId: string;
  readonly businessName: string;
  readonly contactName: string | null;
  readonly whatsapp: string | null;
  readonly email: string | null;
  readonly city: string | null;
  readonly averageDeliveryDays: number | null;
  readonly notes: string | null;
  readonly status: SupplierStatus;
}
