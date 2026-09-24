import {
  readFileSync,
} from 'node:fs';

import {
  describe,
  expect,
  it,
} from 'vitest';

const migration = readFileSync(
  new URL(
    '../../../database/migrations/20260924040000_customer_order_assignment_reconciliation.sql',
    import.meta.url,
  ),
  'utf8',
);

describe(
  'Customer ↔ Orders canonical assignment reconciliation',
  () => {
    it(
      'reuses orders.customer_id instead of creating a parallel relation',
      () => {
        expect(migration).toContain(
          'orders_customer_id_fkey',
        );

        expect(migration).toContain(
          'references public.customers(id)',
        );

        expect(migration).toContain(
          'on delete restrict',
        );
      },
    );

    it(
      'adds a historical delivery address snapshot',
      () => {
        expect(migration).toContain(
          'delivery_address_snapshot',
        );

        expect(migration).toContain(
          'Historical delivery address',
        );
      },
    );

    it(
      'reconciles the existing controlled assignment RPC',
      () => {
        expect(migration).toContain(
          'public.assign_order_customer_controlled',
        );

        expect(migration).toContain(
          "'ASSIGN_ORDER_CUSTOMER'",
        );
      },
    );

    it(
      'uses canonical Customer Master fields rather than legacy whatsapp',
      () => {
        expect(migration).toContain(
          'v_customer.whatsapp_phone',
        );

        expect(migration).toContain(
          'v_customer.phone_normalized',
        );

        expect(migration).not.toContain(
          'v_customer.whatsapp,',
        );
      },
    );

    it(
      'preserves name phone and address as order snapshots',
      () => {
        expect(migration).toContain(
          'customer_name =',
        );

        expect(migration).toContain(
          'customer_phone =',
        );

        expect(migration).toContain(
          'delivery_address_snapshot =',
        );
      },
    );

    it(
      'requires an active canonical customer',
      () => {
        expect(migration).toContain(
          "c.status = 'ACTIVE'",
        );

        expect(migration).toContain(
          'LIHEN_ACTIVE_CUSTOMER_REQUIRED',
        );
      },
    );

    it(
      'only allows assignment while the order is a draft',
      () => {
        expect(migration).toContain(
          "v_order.status <> 'DRAFT'",
        );

        expect(migration).toContain(
          'LIHEN_ORDER_CUSTOMER_ASSIGN_REQUIRES_DRAFT',
        );
      },
    );

    it(
      'keeps assignment idempotent and audited',
      () => {
        expect(migration).toContain(
          'request_fingerprint',
        );

        expect(migration).toContain(
          'result_snapshot',
        );

        expect(migration).toContain(
          'LIHEN_CUSTOMER_WRITE_OPERATION_CONFLICT',
        );
      },
    );

    it(
      'does not mutate Sales Inventory or Finance',
      () => {
        expect(migration).not.toMatch(
          /insert\s+into\s+public\.sales/i,
        );

        expect(migration).not.toMatch(
          /update\s+public\.sales/i,
        );

        expect(migration).not.toMatch(
          /inventory_movements/i,
        );

        expect(migration).not.toMatch(
          /financial_movements/i,
        );
      },
    );
  },
);
