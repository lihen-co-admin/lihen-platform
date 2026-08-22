export interface ConfirmPurchaseCommand {
  readonly operationKey: string;
  readonly purchaseId: string;
  readonly occurredAt: Date;
}
