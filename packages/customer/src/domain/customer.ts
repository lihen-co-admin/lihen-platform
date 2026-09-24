export const customerStatuses = [
  'ACTIVE',
  'INACTIVE',
] as const;

export type CustomerStatus =
  (typeof customerStatuses)[number];


export const customerPreferredLines = [
  'BEAUTY_CARE',
  'STYLE',
  'MIXED',
  'UNKNOWN',
] as const;

export type CustomerPreferredLine =
  (typeof customerPreferredLines)[number];


export interface Customer {
  readonly id: string;

  readonly customerCode: string;

  readonly fullName: string;

  readonly phone: string;

  readonly phoneNormalized: string;

  readonly whatsappPhone: string | null;

  readonly address: string | null;

  readonly city: string | null;

  readonly neighborhood: string | null;

  readonly email: string | null;

  readonly notes: string | null;

  readonly preferredLine: CustomerPreferredLine;

  readonly status: CustomerStatus;

  readonly createdAt: Date;

  readonly updatedAt: Date;
}
