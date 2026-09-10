import type { SupabaseClient } from '@Supabase/supabase-js';
import type { CreateCustomerCommand } from '../application/commands/create-customer.command';
import type { Customer } from '../domain/customer';
import type { CustomerRepository } from '../ports/customer-repository';

interface SupabaseCustomerRepositoryOptions {
  readonly controlledWriteEnabled?: boolean;
}

function mapCustomer(row: Record<string, unknown>): Customer {
  return {
    id: String(row.id),
    fullName: String(row.full_name),
    whatsapp: row.whatsapp ? String(row.whatsapp) : null,
    email: row.email ? String(row.email) : null,
    documentNumber: row.document_number ? String(row.document_number) : null,
    notes: row.notes ? String(row.notes) : null,
    status: String(row.status) as Customer['status'],
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

export class SupabaseCustomerRepository implements CustomerRepository {
  private readonly controlledWriteEnabled: boolean;

  public constructor(
    private readonly client: SupabaseClient,
    options: SupabaseCustomerRepositoryOptions = {},
  ) {
    this.controlledWriteEnabled =
      options.controlledWriteEnabled ?? false;
  }

  public async list(): Promise<readonly Customer[]> {
    const { data, error } = await this.client
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Unable to read customers: ${error.message}`);
    }

    return ((data ?? []) as Record<string, unknown>[]).map(mapCustomer);
  }

  public async getById(id: string): Promise<Customer | null> {
    const { data, error } = await this.client
      .from('customers')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Unable to read customer: ${error.message}`);
    }

    return data ? mapCustomer(data as Record<string, unknown>) : null;
  }

  public async create(command: CreateCustomerCommand): Promise<Customer> {
    if (!this.controlledWriteEnabled) {
      throw new Error('CUSTOMER_WRITE_BLOCKED');
    }

    const { error } = await this.client.rpc(
      'create_customer_controlled',
      {
        p_operation_key: command.operationKey,
        p_customer_id: command.customerId,
        p_full_name: command.fullName,
        p_whatsapp: command.whatsapp,
        p_email: command.email,
        p_document_number: command.documentNumber,
        p_notes: command.notes,
        p_status: command.status,
      },
    );

    if (error) {
      throw new Error(`Unable to create customer: ${error.message}`);
    }

    const customer = await this.getById(command.customerId);

    if (!customer) {
      throw new Error('Created customer could not be read.');
    }

    return customer;
  }
}
