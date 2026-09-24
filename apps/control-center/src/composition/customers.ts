import {
  GetCustomersHandler,
  InMemoryCustomerRepository,
  SupabaseCustomerRepository,
  type CustomerRepository,
} from '@lihen/customer';

import {
  getBrowserSupabaseClient,
  parseBrowserEnv,
} from '@lihen/database';


export interface CustomersComposition {
  readonly repository: CustomerRepository;

  readonly getCustomers: GetCustomersHandler;
}


export function createCustomersComposition(
  env: Record<string, unknown> =
    import.meta.env,
): CustomersComposition {

  const parsed =
    parseBrowserEnv(env);


  const repository:
    CustomerRepository =
      parsed.VITE_PRODUCT_READ_SOURCE ===
      'supabase'

        ? new SupabaseCustomerRepository(
            getBrowserSupabaseClient(env),
          )

        : new InMemoryCustomerRepository();


  return {
    repository,

    getCustomers:
      new GetCustomersHandler(
        repository,
      ),
  };
}


export const customersComposition =
  createCustomersComposition();
