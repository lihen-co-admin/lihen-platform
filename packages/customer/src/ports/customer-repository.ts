import type { CreateCustomerCommand } from '../application/commands/create-customer.command';
import type { Customer } from '../domain/customer';

export interface CustomerRepository {
  list(): Promise<readonly Customer[]>;
  getById(id: string): Promise<Customer | null>;
  create(command: CreateCustomerCommand): Promise<Customer>;
}
