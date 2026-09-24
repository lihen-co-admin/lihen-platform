import type {
  CreateCustomerCommand,
} from '../application/commands/create-customer.command';

import type {
  Customer,
} from '../domain/customer';

import type {
  CustomerRepository,
} from '../ports/customer-repository';


function normalizeMemoryPhone(
  value: string,
): string {
  const raw = value.trim();

  const digits = raw.replace(
    /[^0-9]/g,
    '',
  );

  if (/^3[0-9]{9}$/.test(digits)) {
    return `57${digits}`;
  }

  if (/^573[0-9]{9}$/.test(digits)) {
    return digits;
  }

  if (
    raw.startsWith('+') &&
    /^[0-9]{8,15}$/.test(digits)
  ) {
    return digits;
  }

  throw new Error(
    'CUSTOMER_PHONE_INVALID',
  );
}


export class InMemoryCustomerRepository
implements CustomerRepository {

  private readonly customers =
    new Map<string, Customer>();


  public constructor(
    initialCustomers:
      readonly Customer[] = [],
  ) {
    for (
      const customer
      of initialCustomers
    ) {
      this.customers.set(
        customer.id,
        customer,
      );
    }
  }


  public async list():
  Promise<readonly Customer[]> {

    return [
      ...this.customers.values(),
    ];
  }


  public async getById(
    id: string,
  ): Promise<Customer | null> {

    return (
      this.customers.get(id) ??
      null
    );
  }


  public async create(
    command: CreateCustomerCommand,
  ): Promise<Customer> {

    if (
      this.customers.has(
        command.customerId,
      )
    ) {
      throw new Error(
        'CUSTOMER_ALREADY_EXISTS',
      );
    }


    const fullName =
      command.fullName.trim();

    const phone =
      command.phone.trim();

    if (
      fullName.length === 0 ||
      phone.length === 0
    ) {
      throw new Error(
        'CUSTOMER_REQUIRED_FIELDS_MISSING',
      );
    }


    const phoneNormalized =
      normalizeMemoryPhone(phone);


    if (
      !command.allowSharedPhone &&
      [
        ...this.customers.values(),
      ].some(
        (customer) =>
          customer.phoneNormalized ===
          phoneNormalized,
      )
    ) {
      throw new Error(
        'CUSTOMER_PHONE_ALREADY_EXISTS',
      );
    }


    const now =
      new Date();


    const customerCode =
      `CLI-${String(
        this.customers.size + 1,
      ).padStart(6, '0')}`;


    const customer: Customer = {
      id:
        command.customerId,

      customerCode,

      fullName,

      phone,

      phoneNormalized,

      whatsappPhone:
        command.whatsappPhone
          ? normalizeMemoryPhone(
              command.whatsappPhone,
            )
          : null,

      address:
        command.address?.trim() ||
        null,

      city:
        command.city?.trim() ||
        null,

      neighborhood:
        command.neighborhood?.trim() ||
        null,

      email:
        command.email
          ?.trim()
          .toLowerCase() ||
        null,

      notes:
        command.notes?.trim() ||
        null,

      preferredLine:
        command.preferredLine,

      status:
        'ACTIVE',

      createdAt:
        now,

      updatedAt:
        now,
    };


    this.customers.set(
      customer.id,
      customer,
    );


    return customer;
  }
}
