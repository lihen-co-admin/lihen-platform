import { describe, expect, it } from 'vitest';
import { parseDeliveryPolicyPayload, renderDeliveryPolicies } from '../src/components/delivery-policy';

describe('QA-E storefront delivery policy', () => {
  it('publishes only ACTIVE delivery policies', () => {
    const rows = parseDeliveryPolicyPayload([
      { policy_key: 'STANDARD_NATIONAL', policy_status: 'ACTIVE', coverage_scope: 'COLOMBIA', free_shipping_threshold: 100000, applies_weekday: null, public_label: 'Envío gratis desde $100.000 COP', public_detail: 'Cobertura nacional.' },
      { policy_key: 'SATURDAY_FREE_CALI', policy_status: 'DISABLED_PENDING_APPROVAL', coverage_scope: 'CALI', free_shipping_threshold: null, applies_weekday: 6, public_label: 'Sábado gratis', public_detail: 'Pendiente.' },
    ]);
    expect(rows.map((row) => row.policyKey)).toEqual(['STANDARD_NATIONAL']);
  });

  it('renders the source-backed free-shipping threshold and does not invent Saturday availability', () => {
    const html = renderDeliveryPolicies(parseDeliveryPolicyPayload([
      { policy_key: 'STANDARD_NATIONAL', policy_status: 'ACTIVE', coverage_scope: 'COLOMBIA', free_shipping_threshold: 100000, applies_weekday: null, public_label: 'Envío gratis desde $100.000 COP', public_detail: 'Cali 1 a 3 días.' },
    ]));
    expect(html).toContain('100.000');
    expect(html).not.toMatch(/sábado gratis/i);
  });
});
