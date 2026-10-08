import {
  readFileSync,
} from 'node:fs';

import {
  resolve,
} from 'node:path';

import {
  describe,
  expect,
  it,
} from 'vitest';


const page =
  readFileSync(
    resolve(
      process.cwd(),
      'apps/control-center/src/pages/CustomerBenefitsPage.tsx',
    ),
    'utf8',
  );


const benefitsAdapter =
  readFileSync(
    resolve(
      process.cwd(),
      'apps/control-center/src/composition/customer-benefits.ts',
    ),
    'utf8',
  );


describe(
  'Customer Benefits operator lookup UX',
  () => {
    it(
      'reuses existing read compositions instead of parallel repositories',
      () => {
        expect(page)
          .toMatch(
            /from\s+['"]\.\.\/composition\/customers['"]/,
          );

        expect(page)
          .toMatch(
            /from\s+['"]\.\.\/composition\/orders['"]/,
          );

        expect(page)
          .toMatch(
            /from\s+['"]\.\.\/composition\/sales['"]/,
          );

        expect(page)
          .toMatch(
            /customersComposition[\s\S]*?\.repository[\s\S]*?\.list\s*\(\s*\)/,
          );

        expect(page)
          .toMatch(
            /ordersComposition[\s\S]*?\.repository[\s\S]*?\.list\s*\(\s*\)/,
          );

        expect(page)
          .toMatch(
            /salesComposition[\s\S]*?\.repository[\s\S]*?\.list\s*\(\s*\)/,
          );
      },
    );


    it(
      'keeps lookup loading read-only',
      () => {
        expect(page)
          .not.toMatch(
            /\.repository[\s\S]{0,80}\.(create|update|delete|upsert)\s*\(/,
          );

        expect(page)
          .not.toMatch(
            /\.rpc\s*\(/,
          );
      },
    );


    it(
      'provides human-readable customer sale and order lookup',
      () => {
        expect(page)
          .toContain(
            'Buscar cliente',
          );

        expect(page)
          .toContain(
            'Buscar venta',
          );

        expect(page)
          .toContain(
            'Buscar pedido',
          );

        expect(page)
          .toContain(
            'Cliente seleccionado',
          );

        expect(page)
          .toContain(
            'Venta seleccionada',
          );

        expect(page)
          .toContain(
            'Pedido seleccionado',
          );
      },
    );


    it(
      'removes durable UUID fields as primary operator inputs',
      () => {
        expect(page)
          .not.toContain(
            'Customer ID (vacío: todos)',
          );

        expect(page)
          .not.toContain(
            'Venta durable ID',
          );

        expect(page)
          .not.toContain(
            'Pedido durable ID',
          );
      },
    );


    it(
      'passes selected durable IDs to the unchanged benefit adapter',
      () => {
        expect(page)
          .toMatch(
            /benefitId\s*:\s*selected/,
          );

        expect(page)
          .toMatch(
            /saleId\s*:\s*sale/,
          );

        expect(page)
          .toMatch(
            /orderId\s*:\s*order/,
          );

        expect(benefitsAdapter)
          .toContain(
            'benefitRpcArguments',
          );

        expect(benefitsAdapter)
          .toContain(
            'p_source_sale_id',
          );

        expect(benefitsAdapter)
          .toContain(
            'p_order_id',
          );

        expect(benefitsAdapter)
          .toContain(
            'p_redeemed_sale_id',
          );
      },
    );


    it(
      'preserves operation-key idempotency',
      () => {
        expect(page)
          .toMatch(
            /pending\.current\?\.fingerprint/,
          );

        expect(page)
          .toMatch(
            /crypto\.randomUUID\s*\(\s*\)/,
          );

        expect(page)
          .toMatch(
            /operationKey\s*:\s*pending\.current!\.key/,
          );
      },
    );


    it(
      'requires lookup resolution before controlled execution',
      () => {
        expect(page)
          .toContain(
            'actionLookupReady',
          );

        expect(page)
          .toMatch(
            /!actionLookupReady/,
          );

        expect(page)
          .toMatch(
            /benefitActionAllowed\s*\(\s*action\s*,\s*benefit\s*\)/,
          );
      },
    );


    it(
      'does not introduce automatic execution effects',
      () => {
        expect(page)
          .not.toMatch(
            /\buseEffect\s*\(/,
          );

        expect(page)
          .not.toMatch(
            /\bsetInterval\s*\(/,
          );

        expect(page)
          .not.toMatch(
            /\bsetTimeout\s*\(/,
          );

        expect(page)
          .not.toContain(
            'sendWhatsApp',
          );
      },
    );
  },
);
