import { describe, expect, it } from 'vitest';
import {
  buildCustomerBenefitMessage,
  buildCustomerBenefitVisualModel,
  customerBenefitImageFileName,
  customerBenefitWhatsAppUrl,
  type CustomerBenefitCreativeInput,
} from '../src/domain/customer-benefit-creative';

const base: CustomerBenefitCreativeInput = {
  benefit_code: 'LIHENBC-TEST-001',
  business_line: 'BEAUTY_CARE',
  benefit_type: 'WELCOME',
  status: 'ACTIVE',
  discount_percent: 15,
  valid_until: '2026-10-31T23:59:59-05:00',
};

describe('customer benefit creative model', () => {
  it('renders Beauty Care and Style as distinct visual themes', () => {
    expect(buildCustomerBenefitVisualModel(base)).toMatchObject({
      lineLabel: 'Beauty Care',
      theme: 'beauty-care',
      discountLabel: '15%',
    });

    expect(
      buildCustomerBenefitVisualModel({
        ...base,
        business_line: 'STYLE',
      }),
    ).toMatchObject({
      lineLabel: 'Style',
      theme: 'style',
    });
  });

  it.each([
    ['WELCOME', 'Bono de bienvenida'],
    ['PURCHASE_THRESHOLD', 'Bono por compra'],
    ['RETURN_AFTER_EXPIRED', 'Bono para volver a LIHEN'],
  ] as const)('maps %s into customer-facing copy', (type, label) => {
    expect(
      buildCustomerBenefitVisualModel({
        ...base,
        benefit_type: type,
      }).typeLabel,
    ).toBe(label);
  });

  it.each([
    ['GENERATED', 'Preparado'],
    ['ACTIVE', 'Activo'],
    ['REDEEMED', 'Usado'],
    ['EXPIRED', 'Vencido'],
    ['CANCELLED', 'Cancelado'],
  ] as const)('maps %s into visual status %s', (status, label) => {
    expect(
      buildCustomerBenefitVisualModel({
        ...base,
        status,
      }).statusLabel,
    ).toBe(label);
  });

  it('keeps code and percentage visible without internal UUIDs', () => {
    const model = buildCustomerBenefitVisualModel(base);

    expect(model.codeLabel).toBe('LIHENBC-TEST-001');
    expect(model.discountLabel).toBe('15%');
    expect(JSON.stringify(model)).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    );
  });

  it('builds WhatsApp copy for the three benefit types without sending', () => {
    const customer = {
      fullName: 'Cliente DEV',
      customerCode: 'CLI-DEV',
      whatsappPhone: '+57 300 000 0000',
    };

    const message = buildCustomerBenefitMessage(base, customer);

    expect(message).toContain('Hola, Cliente DEV ✨');
    expect(message).toContain('Bono de bienvenida');
    expect(message).toContain('15% de descuento');
    expect(message).toContain('LIHENBC-TEST-001');
    expect(message).toContain('LIHEN.CO | Beauty Care • Style');

    const url = customerBenefitWhatsAppUrl(message, customer);

    expect(url).toMatch(/^https:\/\/wa\.me\/573000000000\?text=/);
    expect(decodeURIComponent(url)).toContain(message);
  });

  it('uses a neutral greeting when Customer Master identity is unavailable', () => {
    expect(buildCustomerBenefitMessage(base, null)).toMatch(/^Hola ✨/);
  });

  it('generates a safe PNG file name', () => {
    expect(customerBenefitImageFileName(base))
      .toBe('LIHEN-bono-LIHENBC-TEST-001.png');
  });
});
