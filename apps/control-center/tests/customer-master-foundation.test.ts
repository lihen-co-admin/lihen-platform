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
    '../../../database/migrations/20260924030000_customer_master_foundation.sql',
    import.meta.url,
  ),
  'utf8',
);

describe(
  'Customer Master phase 1 foundation migration',
  () => {
    it(
      'creates the canonical customers table',
      () => {
        expect(migration).toContain(
          'create table if not exists public.customers',
        );

        expect(migration).toContain(
          'id uuid',
        );

        expect(migration).toContain(
          'default gen_random_uuid()',
        );

        expect(migration).toContain(
          'customer_code text',
        );

        expect(migration).toContain(
          'full_name text',
        );

        expect(migration).toContain(
          'phone_normalized text',
        );
      },
    );

    it(
      'generates a human CLI customer code inside the database',
      () => {
        expect(migration).toContain(
          'lihen_private.customer_code_seq',
        );

        expect(migration).toContain(
          "'CLI-' ||",
        );

        expect(migration).toContain(
          'lpad(',
        );

        expect(migration).toContain(
          'lihen_private.next_customer_code()',
        );
      },
    );

    it(
      'keeps the customer id independent from phone',
      () => {
        expect(migration).toContain(
          'id uuid',
        );

        expect(migration).toContain(
          'phone_normalized text',
        );

        expect(migration).not.toContain(
          'primary key (phone',
        );

        expect(migration).not.toContain(
          'phone text primary key',
        );
      },
    );

    it(
      'normalizes Colombian mobile numbers without accepting corrupt data blindly',
      () => {
        expect(migration).toContain(
          "v_digits ~ '^3[0-9]{9}$'",
        );

        expect(migration).toContain(
          "return '57' || v_digits",
        );

        expect(migration).toContain(
          "v_digits ~ '^573[0-9]{9}$'",
        );

        expect(migration).toContain(
          'LIHEN_CUSTOMER_PHONE_INVALID',
        );
      },
    );

    it(
      'detects potential duplicate customers by normalized phone',
      () => {
        expect(migration).toContain(
          'customers_phone_normalized_idx',
        );

        expect(migration).toContain(
          'pg_advisory_xact_lock',
        );

        expect(migration).toContain(
          'LIHEN_CUSTOMER_PHONE_ALREADY_EXISTS',
        );
      },
    );

    it(
      'blocks duplicate phones by default but supports an explicit audited override',
      () => {
        expect(migration).toContain(
          'p_allow_shared_phone boolean default false',
        );

        expect(migration).toContain(
          'if not coalesce(',
        );

        expect(migration).toContain(
          'LIHEN_CUSTOMER_PHONE_ALREADY_EXISTS',
        );

        expect(migration).toContain(
          "'shared_phone_override'",
        );

        expect(migration).toContain(
          'p_allow_shared_phone',
        );
      },
    );

    it(
      'uses only approved canonical business line values',
      () => {
        expect(migration).toContain(
          "'BEAUTY_CARE'",
        );

        expect(migration).toContain(
          "'STYLE'",
        );

        expect(migration).toContain(
          "'MIXED'",
        );

        expect(migration).toContain(
          "'UNKNOWN'",
        );

        expect(migration).not.toContain(
          "'BEAUTY_CURE'",
        );
      },
    );

    it(
      'uses active and inactive instead of hard delete semantics',
      () => {
        expect(migration).toContain(
          "'ACTIVE'",
        );

        expect(migration).toContain(
          "'INACTIVE'",
        );

        expect(migration).not.toMatch(
          /\bdelete\s+from\s+public\.customers\b/i,
        );

        expect(migration).not.toMatch(
          /\bdrop\s+table\s+.*customers\b/i,
        );
      },
    );

    it(
      'enables RLS and keeps direct customer writes denied',
      () => {
        expect(migration).toContain(
          'alter table public.customers',
        );

        expect(migration).toContain(
          'enable row level security',
        );

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
      'limits customer reading to active OWNER or ADMIN profiles',
      () => {
        expect(migration).toContain(
          'customers_owner_admin_read',
        );

        expect(migration).toContain(
          "p.authorization_status = 'ACTIVE'",
        );

        expect(migration).toContain(
          "'OWNER'",
        );

        expect(migration).toContain(
          "'ADMIN'",
        );
      },
    );

    it(
      'creates controlled customer create and update RPCs',
      () => {
        expect(migration).toContain(
          'public.create_customer_controlled(',
        );

        expect(migration).toContain(
          'public.update_customer_controlled(',
        );

        expect(migration).toContain(
          'security definer',
        );

        expect(migration).toContain(
          'auth.uid()',
        );
      },
    );

    it(
      'uses an idempotent private operation ledger',
      () => {
        expect(migration).toContain(
          'lihen_private.customer_write_operations',
        );

        expect(migration).toContain(
          'operation_key text',
        );

        expect(migration).toContain(
          'request_fingerprint text',
        );

        expect(migration).toContain(
          'result_snapshot jsonb',
        );

        expect(migration).toContain(
          'LIHEN_CUSTOMER_OPERATION_CONFLICT',
        );
      },
    );

    it(
      'does not modify orders or sales in phase 1',
      () => {
        expect(migration).not.toMatch(
          /alter\s+table\s+public\.orders/i,
        );

        expect(migration).not.toMatch(
          /alter\s+table\s+public\.sales/i,
        );

        expect(migration).not.toContain(
          'customer_id uuid references public.customers',
        );
      },
    );

    it(
      'does not mutate inventory or finance',
      () => {
        expect(migration).not.toContain(
          'insert into public.inventory_movements',
        );

        expect(migration).not.toContain(
          'insert into public.financial_movements',
        );

        expect(migration).not.toContain(
          'SALE_INCOME',
        );
      },
    );

    it(
      'explicitly defers audit timeline integration',
      () => {
        expect(migration).toContain(
          'Audit timeline integration is intentionally deferred',
        );

        expect(migration).not.toContain(
          'create or replace view lihen_private.control_center_operation_audit_timeline',
        );
      },
    );
  },
);
