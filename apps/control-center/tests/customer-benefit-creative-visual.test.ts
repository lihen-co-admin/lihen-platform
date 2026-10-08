import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  benefitCreativeThemes,
  buildCustomerBenefitVisualModel,
  type CustomerBenefitCreativeInput,
} from '../src/domain/customer-benefit-creative';


const base:
CustomerBenefitCreativeInput = {
  benefit_code:
    'LIHENBC-DEV-PREVIEW',

  business_line:
    'BEAUTY_CARE',

  benefit_type:
    'WELCOME',

  status:
    'ACTIVE',

  discount_percent:
    15,

  valid_until:
    '2026-10-31T23:59:59-05:00',
};


describe(
  'LIHEN Customer Benefit visual identity',
  () => {
    it(
      'defines related but distinct Beauty Care and Style themes',
      () => {
        expect(
          benefitCreativeThemes
            .BEAUTY_CARE
            .middle,
        ).not.toBe(
          benefitCreativeThemes
            .STYLE
            .middle,
        );

        expect(
          benefitCreativeThemes
            .BEAUTY_CARE
            .limeGlow,
        ).toBeTruthy();

        expect(
          benefitCreativeThemes
            .STYLE
            .glow,
        ).toBeTruthy();
      },
    );


    it(
      'adds emotional customer-facing copy',
      () => {
        expect(
          buildCustomerBenefitVisualModel(
            base,
          ).emotionalCopy,
        ).toBe(
          'Un detalle para darte la bienvenida.',
        );

        expect(
          buildCustomerBenefitVisualModel({
            ...base,
            benefit_type:
              'PURCHASE_THRESHOLD',
          }).emotionalCopy,
        ).toBe(
          'Gracias por elegirnos una vez más.',
        );

        expect(
          buildCustomerBenefitVisualModel({
            ...base,
            benefit_type:
              'RETURN_AFTER_EXPIRED',
          }).emotionalCopy,
        ).toBe(
          'Queremos volver a consentirte.',
        );
      },
    );


    it(
      'keeps the percentage as one visual token',
      () => {
        expect(
          buildCustomerBenefitVisualModel(
            base,
          ).discountLabel,
        ).toBe('15%');
      },
    );


    it(
      'provides a compact premium validity value',
      () => {
        const value =
          buildCustomerBenefitVisualModel(
            base,
          ).validityValue;

        expect(value)
          .toContain('31');

        expect(value)
          .toContain('2026');

        expect(value)
          .toContain('OCT');
      },
    );


    it(
      'keeps historical status human-readable',
      () => {
        expect(
          buildCustomerBenefitVisualModel({
            ...base,
            status:
              'EXPIRED',
          }).statusLabel,
        ).toBe(
          'Vencido',
        );

        expect(
          buildCustomerBenefitVisualModel({
            ...base,
            status:
              'REDEEMED',
          }).statusLabel,
        ).toBe(
          'Usado',
        );
      },
    );
  },
);
