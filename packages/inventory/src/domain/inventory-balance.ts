export interface InventoryBalance {
  readonly productId: string;
  readonly stockOnHand: number;
  readonly stockReserved: number;
  readonly stockPending: number;
  readonly stockAvailable: number;
}
