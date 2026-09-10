export const customerStatuses = ['ACTIVE', 'INACTIVE'] as const;

export type CustomerStatus = (typeof customerStatuses)[number];

export interface Customer {
  readonly id: string;
  readonly fullName: string;
  readonly whatsapp: string | null;
  readonly email: string | null;
  readonly documentNumber: string | null;
  readonly notes: string | null;
  readonly status: CustomerStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
