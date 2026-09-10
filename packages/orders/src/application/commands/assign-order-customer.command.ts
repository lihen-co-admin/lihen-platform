export interface AssignOrderCustomerCommand {
  readonly operationKey: string;
  readonly orderId: string;
  readonly customerId: string;
}
