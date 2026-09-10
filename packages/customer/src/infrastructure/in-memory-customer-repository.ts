import type { CreateCustomerCommand } from '../application/commands/create-customer.command';
import type { Customer } from '../domain/customer';
import type { CustomerRepository } from '../ports/customer-repository';

export class InMemoryCustomerRepository implements CustomerRepository {
  private readonly customers = new Map<string, Customer>();

  public constructor(initialCustomers: readonly Customer[] = []) {
    for (const customer of initialCustomers) {
      this.customers.set(customer.id, customer);
    }
  }

  public async list(): Promise<readonly Customer[]> {
    return [...this.customers.values()];
  }

  public async getById(id: string): Promise<Customer | null> {
    return this.customers.get(id) ?? null;
  }

  public async create(command: CreateCustomerCommand): Promise<Customer> {
    if (this.customers.has(command.customerId)) {
      throw new Error('CUSTOMER_ALREADY_EXISTS');
    }

    const now = new Date();

    const customer: Customer = {
      id: command.customerId,
      fullName: command.fullName.trim(),
      whatsapp: command.whatsapp,
      email: command.email,
      documentNumber: command.documentNumber,
      notes: command.notes,
      status: command.status,
      createdAt: now,
      updatedAt: now,
    };

    this.customers.set(customer.id, customer);

    return customer;
  }
}
