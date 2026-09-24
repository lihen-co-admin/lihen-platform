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
    '../../../database/migrations/20260924025000_customer_master_legacy_upgrade_bridge.sql',
    import.meta.url,
  ),
  'utf8',
);

describe(
  'Customer Master legacy upgrade bridge',
  () => {
    it(
      'runs before the canonical Customer Master foundation',
      () => {
        expect(
          Number('20260924025000'),
        ).toBeLessThan(
          Number('20260924030000'),
        );
      },
    );

    it(
      'adds the canonical fields missing from legacy customers',
      () => {
        for (const field of [
          'customer_code',
          'phone',
          'phone_normalized',
          'whatsapp_phone',
          'address',
          'city',
          'neighborhood',
          'preferred_line',
        ]) {
          expect(migration).toContain(
            `add column if not exists ${field}`,
          );
        }
      },
    );

    it(
      'does not invent missing phone data',
      () => {
        expect(migration).toContain(
          'LIHEN_LEGACY_CUSTOMER_PHONE_REVIEW_REQUIRED',
        );

        expect(migration).toContain(
          'normalize_customer_phone',
        );
      },
    );

    it(
      'preserves legacy source columns',
      () => {
        expect(migration).not.toMatch(
          /drop\s+column\s+(if\s+exists\s+)?whatsapp/i,
        );

        expect(migration).not.toMatch(
          /drop\s+column\s+(if\s+exists\s+)?document_number/i,
        );

        expect(migration).toContain(
          'Legacy CRM source field',
        );
      },
    );

    it(
      'reconciles the private ledger for create update and assignment',
      () => {
        expect(migration).toContain(
          "'CREATE_CUSTOMER'",
        );

        expect(migration).toContain(
          "'UPDATE_CUSTOMER'",
        );

        expect(migration).toContain(
          "'ASSIGN_ORDER_CUSTOMER'",
        );
      },
    );

    it(
      'keeps the order linkage field in the existing ledger',
      () => {
        expect(migration).toContain(
          'add column if not exists order_id uuid',
        );
      },
    );

    it(
      'revokes the legacy customer create overload',
      () => {
        expect(migration).toContain(
          'create_customer_controlled(text,uuid,text,text,text,text,text,text)',
        );

        expect(migration).toContain(
          'from public, anon, authenticated, service_role',
        );
      },
    );

    it(
      'does not mutate commercial domains',
      () => {
        expect(migration).not.toMatch(
          /insert\s+into\s+public\.orders/i,
        );

        expect(migration).not.toMatch(
          /update\s+public\.orders/i,
        );

        expect(migration).not.toMatch(
          /insert\s+into\s+public\.sales/i,
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
