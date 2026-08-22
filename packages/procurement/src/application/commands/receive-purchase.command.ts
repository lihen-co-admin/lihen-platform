export interface ReceivePurchaseLine {
  readonly purchaseItemId: string;
  readonly quantityReceived: number;
  readonly finalUnitCost: number;
}
export interface ReceivePurchaseCommand {
  readonly operationKey: string;
  readonly purchaseId: string;
  readonly receivedAt: Date;
  readonly lines: readonly ReceivePurchaseLine[];
  readonly notes: string | null;
}
