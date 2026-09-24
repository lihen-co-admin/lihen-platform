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
    '../../../database/migrations/20260924033000_customer_master_audit_timeline_integration.sql',
    import.meta.url,
  ),
  'utf8',
);

describe(
  'Customer Master institutional audit timeline integration',
  () => {
    it(
      'reuses the existing institutional timeline',
      () => {
        expect(migration).toContain(
          'lihen_private.control_center_operation_audit_timeline',
        );

        expect(migration).not.toContain(
          'create table public.customer_audit',
        );

        expect(migration).not.toContain(
          'create table if not exists public.customer_audit',
        );
      },
    );

    it(
      'adds CUSTOMERS as a first-class audit domain',
      () => {
        expect(migration).toContain(
          "'CUSTOMERS'::text",
        );

        expect(migration).toContain(
          'from lihen_private.customer_write_operations',
        );

        expect(migration).toContain(
          'customer_id',
        );
      },
    );

    it(
      'preserves existing domains',
      () => {
        for (const domain of [
          'PRODUCTS',
          'INVENTORY',
          'ORDERS',
          'PROCUREMENT',
          'FINANCE',
          'SUPPLIERS',
        ]) {
          expect(migration).toContain(
            `'${domain}'::text`,
          );
        }
      },
    );

    it(
      'keeps the audit timeline read only',
      () => {
        expect(migration).toContain(
          'revoke all',
        );

        expect(migration).toContain(
          'grant select',
        );

        expect(migration).not.toContain(
          'grant insert',
        );

        expect(migration).not.toContain(
          'grant update',
        );

        expect(migration).not.toContain(
          'grant delete',
        );
      },
    );

    it(
      'does not introduce business mutations',
      () => {
        expect(migration).not.toContain(
          'insert into public.orders',
        );

        expect(migration).not.toContain(
          'insert into public.sales',
        );

        expect(migration).not.toContain(
          'insert into public.inventory_movements',
        );

        expect(migration).not.toContain(
          'insert into public.financial_movements',
        );
      },
    );

    it(
      'provides explicit readiness evidence',
      () => {
        expect(migration).toContain(
          'customer_master_audit_timeline_readiness',
        );

        expect(migration).toContain(
          "'CUSTOMERS_DOMAIN_INCLUDED'",
        );

        expect(migration).toContain(
          "'NO_SECOND_AUDIT_SYSTEM'",
        );

        expect(migration).toContain(
          "'NO_BUSINESS_MUTATION'",
        );
      },
    );
  },
);
