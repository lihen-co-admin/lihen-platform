import type { SupplierStatus } from './supplier-status';

export interface Supplier {
  readonly id: string;
  readonly businessName: string;
  readonly normalizedName: string;
  readonly contactName: string | null;
  readonly whatsapp: string | null;
  readonly email: string | null;
  readonly city: string | null;
  readonly averageDeliveryDays: number | null;
  readonly notes: string | null;
  readonly status: SupplierStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateSupplierInput {
  readonly id: string;
  readonly businessName: string;
  readonly contactName?: string | null;
  readonly whatsapp?: string | null;
  readonly email?: string | null;
  readonly city?: string | null;
  readonly averageDeliveryDays?: number | null;
  readonly notes?: string | null;
  readonly status?: SupplierStatus;
  readonly now?: Date;
}

function nullableText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function normalizeSupplierName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es');
}

export function createSupplier(input: CreateSupplierInput): Supplier {
  const businessName = input.businessName.trim().replace(/\s+/g, ' ');
  if (!businessName) throw new Error('SUPPLIER_BUSINESS_NAME_REQUIRED');

  const averageDeliveryDays = input.averageDeliveryDays ?? null;
  if (
    averageDeliveryDays !== null &&
    (!Number.isInteger(averageDeliveryDays) || averageDeliveryDays < 0)
  ) {
    throw new Error('SUPPLIER_AVERAGE_DELIVERY_DAYS_INVALID');
  }

  const now = input.now ?? new Date();

  return {
    id: input.id,
    businessName,
    normalizedName: normalizeSupplierName(businessName),
    contactName: nullableText(input.contactName),
    whatsapp: nullableText(input.whatsapp),
    email: nullableText(input.email),
    city: nullableText(input.city),
    averageDeliveryDays,
    notes: nullableText(input.notes),
    status: input.status ?? 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };
}
