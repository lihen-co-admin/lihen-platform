import type { CustomerStatus } from '../../domain/customer';

export interface CreateCustomerCommand {
  readonly operationKey: string;
  readonly customerId: string;
  readonly fullName: string;
  readonly whatsapp: string | null;
  readonly email: string | null;
  readonly documentNumber: string | null;
  readonly notes: string | null;
  readonly status: CustomerStatus;
}
