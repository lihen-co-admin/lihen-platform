import {
  readFileSync,
} from 'node:fs';

import {
  join,
} from 'node:path';

import {
  describe,
  expect,
  it,
} from 'vitest';


const root =
  process.cwd();

const assistant =
  readFileSync(
    join(
      root,
      'packages/intelligence-core/src/assistant.ts',
    ),
    'utf8',
  );

const creative =
  readFileSync(
    join(
      root,
      'packages/intelligence-core/src/capabilities/creative-intelligence.ts',
    ),
    'utf8',
  );

const ui =
  readFileSync(
    join(
      root,
      'apps/control-center/src/pages/AssistantPage.tsx',
    ),
    'utf8',
  );


describe(
  'LIHEN Intelligence brand governance architecture',
  () => {

    it(
      'injects canonical brand context into Assistant model messages',
      () => {
        expect(assistant)
          .toContain(
            'LIHEN_BRAND_CONTEXT',
          );

        expect(assistant)
          .toContain(
            'formatLihenBrandContextForModel',
          );

        expect(assistant)
          .toContain(
            'PREPARED_ONLY',
          );
      },
    );


    it(
      'applies brand audit before creative generation',
      () => {
        expect(creative)
          .toContain(
            'auditLihenCreativeRequest',
          );

        expect(creative)
          .toContain(
            'withLihenBrandConstraints',
          );

        expect(creative)
          .toContain(
            'LIHEN_BRAND_GOVERNANCE_BLOCKED',
          );
      },
    );


    it(
      'keeps generated creative candidates pending and non-executing',
      () => {
        expect(creative)
          .toContain(
            "status: 'PENDING'",
          );

        expect(creative)
          .toContain(
            "executionState: 'PREPARED_ONLY'",
          );
      },
    );


    it(
      'shows brand governance in Control Center Assistant',
      () => {
        expect(ui)
          .toContain(
            'LIHEN Brand Context',
          );

        expect(ui)
          .toContain(
            'PREPARED ONLY',
          );

        expect(ui)
          .toContain(
            'VISUAL REVIEW',
          );
      },
    );
  },
);
