import type {
  SupabaseClient,
} from '@supabase/supabase-js';

import type {
  CreateCustomerCommand,
} from '../application/commands/create-customer.command';

import type {
  Customer,
} from '../domain/customer';

import type {
  CustomerRepository,
} from '../ports/customer-repository';


interface SupabaseCustomerRepositoryOptions {
  readonly controlledWriteEnabled?:
    boolean;
}


function nullableText(
  value: unknown,
): string | null {
  return (
    value === null ||
    value === undefined
  )
    ? null
    : String(value);
}


function mapCustomer(
  row: Record<string, unknown>,
): Customer {

  return {
    id:
      String(row.id),

    customerCode:
      String(row.customer_code),

    fullName:
      String(row.full_name),

    phone:
      String(row.phone),

    phoneNormalized:
      String(row.phone_normalized),

    whatsappPhone:
      nullableText(
        row.whatsapp_phone,
      ),

    address:
      nullableText(
        row.address,
      ),

    city:
      nullableText(
        row.city,
      ),

    neighborhood:
      nullableText(
        row.neighborhood,
      ),

    email:
      nullableText(
        row.email,
      ),

    notes:
      nullableText(
        row.notes,
      ),

    preferredLine:
      String(
        row.preferred_line ??
        'UNKNOWN',
      ) as Customer['preferredLine'],

    status:
      String(
        row.status,
      ) as Customer['status'],

    createdAt:
      new Date(
        String(row.created_at),
      ),

    updatedAt:
      new Date(
        String(row.updated_at),
      ),
  };
}


export class SupabaseCustomerRepository
implements CustomerRepository {

  private readonly controlledWriteEnabled: boolean;


  public constructor(
    private readonly client: SupabaseClient,
    options: SupabaseCustomerRepositoryOptions = {},
  ) {
    this.controlledWriteEnabled =
      options
        .controlledWriteEnabled ??
      false;
  }


  public async list():
  Promise<readonly Customer[]> {

    const {
      data,
      error,
    } =
      await this.client
        .from('customers')
        .select('*')
        .eq(
          'status',
          'ACTIVE',
        )
        .order(
          'full_name',
          {
            ascending: true,
          },
        );


    if (error) {
      throw new Error(
        `Unable to read customers: ${error.message}`,
      );
    }


    return (
      (
        data ?? []
      ) as Record<
        string,
        unknown
      >[]
    ).map(mapCustomer);
  }


  public async getById(
    id: string,
  ): Promise<Customer | null> {

    const {
      data,
      error,
    } =
      await this.client
        .from('customers')
        .select('*')
        .eq(
          'id',
          id,
        )
        .maybeSingle();


    if (error) {
      throw new Error(
        `Unable to read customer: ${error.message}`,
      );
    }


    return data
      ? mapCustomer(
          data as Record<
            string,
            unknown
          >,
        )
      : null;
  }


  public async create(
    command:
      CreateCustomerCommand,
  ): Promise<Customer> {

    if (
      !this
        .controlledWriteEnabled
    ) {
      throw new Error(
        'CUSTOMER_WRITE_BLOCKED',
      );
    }


    const {
      error,
    } =
      await this.client.rpc(
        'create_customer_controlled',
        {
          p_operation_key:
            command.operationKey,

          p_customer_id:
            command.customerId,

          p_full_name:
            command.fullName,

          p_phone:
            command.phone,

          p_whatsapp_phone:
            command.whatsappPhone,

          p_address:
            command.address,

          p_city:
            command.city,

          p_neighborhood:
            command.neighborhood,

          p_email:
            command.email,

          p_notes:
            command.notes,

          p_preferred_line:
            command.preferredLine,

          p_allow_shared_phone:
            command.allowSharedPhone ??
            false,
        },
      );


    if (error) {
      throw new Error(
        `Unable to create customer: ${error.message}`,
      );
    }


    const customer =
      await this.getById(
        command.customerId,
      );


    if (!customer) {
      throw new Error(
        'Created customer could not be read.',
      );
    }


    return customer;
  }
}
