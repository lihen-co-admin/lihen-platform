import type { PurchaseRepository } from '../../ports/purchase-repository';
import type { ConfirmPurchaseCommand } from './confirm-purchase.command';
export class ConfirmPurchaseHandler {
  public constructor(private readonly repository: PurchaseRepository) {}
  public execute(command: ConfirmPurchaseCommand) { return this.repository.confirm(command); }
}
