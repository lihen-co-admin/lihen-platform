export const INVENTORY_BUCKETS = ['ON_HAND', 'RESERVED', 'PENDING_IN'] as const;
export type InventoryBucket = (typeof INVENTORY_BUCKETS)[number];
