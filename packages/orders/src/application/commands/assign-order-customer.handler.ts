import type { OrderRepository } from '../../ports/order-repository';
import type { AssignOrderCustomerCommand } from './assign-order-customer.command';

export class AssignOrderCustomerHandler {
  public constructor(
    private readonly repository: OrderRepository,
  ) {}

  public execute(command: AssignOrderCustomerCommand) {
    return this.repository.assignCustomer(command);
  }
}
