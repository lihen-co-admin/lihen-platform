import type {
  CustomerPreferredLine,
} from '../../domain/customer';


export interface CreateCustomerCommand {
  readonly operationKey: string;

  readonly customerId: string;

  readonly fullName: string;

  readonly phone: string;

  readonly whatsappPhone: string | null;

  readonly address: string | null;

  readonly city: string | null;

  readonly neighborhood: string | null;

  readonly email: string | null;

  readonly notes: string | null;

  readonly preferredLine: CustomerPreferredLine;

  readonly allowSharedPhone?: boolean;
}
