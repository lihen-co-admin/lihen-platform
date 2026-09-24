import {
  readFileSync,
} from 'node:fs';

import {
  describe,
  expect,
  it,
} from 'vitest';


const page = readFileSync(
  new URL(
    '../src/pages/OrdersPage.tsx',
    import.meta.url,
  ),
  'utf8',
);


const customersComposition =
  readFileSync(
    new URL(
      '../src/composition/customers.ts',
      import.meta.url,
    ),
    'utf8',
  );


const ordersComposition =
  readFileSync(
    new URL(
      '../src/composition/orders.ts',
      import.meta.url,
    ),
    'utf8',
  );


describe(
  'Orders Customer Master selector',
  () => {

    it(
      'loads customers',
      () => {
        expect(page).toContain(
          'customersComposition.getCustomers.execute()',
        );

        expect(page).toContain(
          'setCustomers(customerRows)',
        );
      },
    );


    it(
      'shows canonical customer identity',
      () => {
        expect(page).toContain(
          'customer.customerCode',
        );

        expect(page).toContain(
          'customer.fullName',
        );

        expect(page).toContain(
          'customer.phoneNormalized',
        );
      },
    );


    it(
      'keeps manual fallback',
      () => {
        expect(page).toContain(
          'Sin cliente registrado · ingreso manual',
        );

        expect(page).toContain(
          'customerName.trim() || null',
        );

        expect(page).toContain(
          'customerPhone.trim() || null',
        );
      },
    );


    it(
      'creates draft before customer assignment',
      () => {
        const createIndex =
          page.indexOf(
            'ordersComposition.createDraft.execute',
          );

        const assignIndex =
          page.indexOf(
            'ordersComposition.assignCustomer.execute',
          );

        expect(
          createIndex,
        ).toBeGreaterThan(-1);

        expect(
          assignIndex,
        ).toBeGreaterThan(
          createIndex,
        );
      },
    );


    it(
      'uses stable order identity',
      () => {
        expect(page).toContain(
          'const orderId =',
        );

        expect(page).toContain(
          'customerId: selectedCustomerId',
        );
      },
    );


    it(
      'locks snapshots when registered customer is selected',
      () => {
        expect(page).toContain(
          'readOnly={Boolean(selectedCustomerId)}',
        );
      },
    );


    it(
      'uses canonical Customer composition',
      () => {
        expect(
          customersComposition,
        ).toContain(
          'GetCustomersHandler',
        );

        expect(
          customersComposition,
        ).toContain(
          'SupabaseCustomerRepository',
        );
      },
    );


    it(
      'uses existing Order assignment handler',
      () => {
        expect(
          ordersComposition,
        ).toContain(
          'AssignOrderCustomerHandler',
        );

        expect(
          ordersComposition,
        ).toContain(
          'assignCustomer',
        );
      },
    );
  },
);
