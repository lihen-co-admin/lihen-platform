import type { CustomerRepository } from '../../ports/customer-repository';
import type { CreateCustomerCommand } from './create-customer.command';

export class CreateCustomerHandler {
  public constructor(
    private readonly repository: CustomerRepository,
  ) {}

  public execute(command: CreateCustomerCommand) {
    return this.repository.create(command);
  }
}
