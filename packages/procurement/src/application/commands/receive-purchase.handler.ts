import type { PurchaseRepository } from '../../ports/purchase-repository';
import type { ReceivePurchaseCommand } from './receive-purchase.command';
export class ReceivePurchaseHandler {
  public constructor(private readonly repository: PurchaseRepository) {}
  public execute(command: ReceivePurchaseCommand) { return this.repository.receive(command); }
}
