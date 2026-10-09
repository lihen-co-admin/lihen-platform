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


const source =
  readFileSync(
    resolve(
      process.cwd(),
      'apps/control-center/src/components/customer-benefit-reference-canvas.ts',
    ),
    'utf8',
  );


describe(
  'LIHEN Customer Benefit reference Canvas',
  () => {
    it(
      'keeps the official logo with presentation-time neutralization',
      () => {
        expect(source)
          .toContain(
            'lihen-logo-official.png',
          );

        expect(source)
          .toMatch(
            /globalCompositeOperation\s*=\s*['"]multiply['"]/,
          );
      },
    );


    it(
      'contains the approved coupon hierarchy',
      () => {
        expect(source)
          .toContain(
            'DE DESCUENTO',
          );

        expect(source)
          .toContain(
            'TU CÓDIGO EXCLUSIVO',
          );

        expect(source)
          .toContain(
            'VÁLIDO HASTA',
          );

        expect(source)
          .toContain(
            'BENEFICIO',
          );

        expect(source)
          .toContain(
            '¡Te esperamos!',
          );

        expect(source)
          .toContain(
            'LIHEN.CO',
          );
      },
    );


    it(
      'keeps Beauty Care and Style as related distinct palettes',
      () => {
        expect(source)
          .toContain(
            'BEAUTY_PALETTE',
          );

        expect(source)
          .toContain(
            'STYLE_PALETTE',
          );

        expect(source)
          .toContain(
            '#f8dce9',
          );

        expect(source)
          .toContain(
            '#e3d5f3',
          );
      },
    );


    it(
      'keeps the discount model-driven rather than hardcoded',
      () => {
        expect(source)
          .toContain(
            'model.discountLabel',
          );

        expect(source)
          .toContain(
            'model.codeLabel',
          );

        expect(source)
          .toContain(
            'model.validityValue',
          );

        expect(source)
          .toContain(
            'model.statusLabel',
          );
      },
    );
  },
);
