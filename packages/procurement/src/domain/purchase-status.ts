export const PURCHASE_STATUSES = [
  'DRAFT',
  'CONFIRMED',
  'PARTIALLY_RECEIVED',
  'RECEIVED',
  'CANCELLED',
] as const;

export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];
