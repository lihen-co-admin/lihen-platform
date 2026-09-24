import {
  readFileSync,
} from 'node:fs';

import {
  describe,
  expect,
  it,
} from 'vitest';


const domain =
  readFileSync(
    new URL(
      '../../../packages/customer/src/domain/customer.ts',
      import.meta.url,
    ),
    'utf8',
  );


const command =
  readFileSync(
    new URL(
      '../../../packages/customer/src/application/commands/create-customer.command.ts',
      import.meta.url,
    ),
    'utf8',
  );


const repository =
  readFileSync(
    new URL(
      '../../../packages/customer/src/infrastructure/supabase-customer-repository.ts',
      import.meta.url,
    ),
    'utf8',
  );


describe(
  'canonical Customer Master package contract',
  () => {

    it(
      'exposes canonical Customer Master fields',
      () => {
        for (
          const field of [
            'customerCode',
            'fullName',
            'phone',
            'phoneNormalized',
            'whatsappPhone',
            'address',
            'city',
            'neighborhood',
            'email',
            'notes',
            'preferredLine',
            'status',
          ]
        ) {
          expect(
            domain,
          ).toContain(field);
        }
      },
    );


    it(
      'uses canonical business lines',
      () => {
        expect(
          domain,
        ).toContain(
          "'BEAUTY_CARE'",
        );

        expect(
          domain,
        ).toContain(
          "'STYLE'",
        );

        expect(
          domain,
        ).toContain(
          "'MIXED'",
        );

        expect(
          domain,
        ).toContain(
          "'UNKNOWN'",
        );

        expect(
          domain,
        ).not.toContain(
          'BEAUTY_CURE',
        );
      },
    );


    it(
      'removes legacy fields from the active Customer domain',
      () => {
        expect(
          domain,
        ).not.toMatch(
          /\bwhatsapp:\s/,
        );

        expect(
          domain,
        ).not.toContain(
          'documentNumber',
        );
      },
    );


    it(
      'uses the canonical create RPC arguments',
      () => {
        for (
          const argument of [
            'p_phone',
            'p_whatsapp_phone',
            'p_address',
            'p_city',
            'p_neighborhood',
            'p_email',
            'p_notes',
            'p_preferred_line',
            'p_allow_shared_phone',
          ]
        ) {
          expect(
            repository,
          ).toContain(argument);
        }
      },
    );


    it(
      'does not call the legacy create RPC contract',
      () => {
        expect(
          repository,
        ).not.toContain(
          'p_whatsapp:',
        );

        expect(
          repository,
        ).not.toContain(
          'p_document_number',
        );
      },
    );


    it(
      'reads only active customers for operational selectors',
      () => {
        expect(
          repository,
        ).toMatch(
          /\.eq\(\s*['"]status['"]\s*,\s*['"]ACTIVE['"]\s*,?\s*\)/,
        );
      },
    );


    it(
      'keeps create command aligned to Customer Master',
      () => {
        expect(
          command,
        ).toContain(
          'phone: string',
        );

        expect(
          command,
        ).toContain(
          'preferredLine',
        );

        expect(
          command,
        ).toContain(
          'allowSharedPhone?',
        );

        expect(
          command,
        ).not.toContain(
          'documentNumber',
        );
      },
    );
  },
);
