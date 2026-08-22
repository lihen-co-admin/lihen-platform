export class InventoryWriteBlockedError extends Error {
  public constructor() { super('Inventory writes are blocked.'); }
}
export class InventoryAdjustmentForbiddenError extends Error {
  public constructor() { super('Inventory adjustment is forbidden.'); }
}
export class InventoryBalanceViolationError extends Error {
  public constructor(message = 'Inventory balance invariant would be violated.') { super(message); }
}
export class InventoryWriteOperationConflictError extends Error {
  public constructor() { super('Inventory operation key conflicts with a previous request.'); }
}
