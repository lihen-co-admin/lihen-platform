import type { CustomerRepository } from '../../ports/customer-repository';

export class GetCustomersHandler {
  public constructor(
    private readonly repository: CustomerRepository,
  ) {}

  public execute() {
    return this.repository.list();
  }
}
