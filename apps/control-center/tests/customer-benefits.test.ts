import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { benefitSchema, benefitActions, benefitActionAllowed, benefitRpcArguments, canManageBenefits, createCustomerBenefitsRepository, type BenefitInput } from '../src/composition/customer-benefits';

const id = '11111111-1111-4111-8111-111111111111';
const input: BenefitInput = { operationKey: 'retry-stable', benefitId: id, saleId: id, orderId: id, businessLine: 'STYLE', discountPercent: 10 };
const row = { id, customer_id: id, benefit_code: 'BONO', business_line: 'STYLE', benefit_type: 'WELCOME', status: 'GENERATED', discount_percent: '10', created_at: '2026-10-07', issued_at: null, valid_from: null, valid_until: null, source_order_id: id, source_sale_id: id, redeemed_order_id: null, redeemed_sale_id: null, predecessor_benefit_id: null };
describe('customer benefits controlled adapter', () => {
  it('maps every existing RPC with an operation key and no table writes', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ benefit_id: id }], error: null });
    const repository = createCustomerBenefitsRepository({ rpc } as unknown as SupabaseClient, true);
    for (const action of Object.keys(benefitActions) as (keyof typeof benefitActions)[]) {
      await repository.execute(action, input);
      expect(rpc).toHaveBeenLastCalledWith(benefitActions[action], expect.objectContaining({p_operation_key: 'retry-stable'}));
    }
    expect(benefitRpcArguments('WELCOME', input)).toEqual({ p_operation_key: 'retry-stable', p_source_sale_id: id, p_business_line: 'STYLE', p_discount_percent: 10 });
    expect(benefitRpcArguments('REDEEM', input)).toEqual({ p_operation_key: 'retry-stable', p_benefit_id: id, p_redeemed_sale_id: id });
    expect(benefitRpcArguments('APPLY', input)).toEqual({ p_operation_key: 'retry-stable', p_benefit_id: id, p_order_id: id });
  });
  it('fails closed and propagates RPC errors', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'policy denied' } });
    const client = { rpc } as unknown as SupabaseClient;
    await expect(createCustomerBenefitsRepository(client, false).execute('WELCOME', input)).rejects.toThrow('bloqueada');
    expect(rpc).not.toHaveBeenCalled();
    await expect(createCustomerBenefitsRepository(client, true).execute('WELCOME', input)).rejects.toThrow('policy denied');
    expect(() => benefitRpcArguments('WELCOME', { ...input, discountPercent: 0 })).toThrow();
    expect(() => benefitRpcArguments('APPLY', { ...input, orderId: 'bad' })).toThrow();
  });
  it('maps durable rows and filters reads by customer', async () => {
    const query = { order: vi.fn().mockReturnThis(), range: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), then: (resolve: (x: unknown) => void) => resolve({data: [row], error: null}) };
    const select = vi.fn().mockReturnValue(query);
    const from = vi.fn().mockReturnValue({select});
    const rows = await createCustomerBenefitsRepository({from} as unknown as SupabaseClient, true).list(id);
    expect(rows[0]?.discount_percent).toBe(10);
    expect(query.eq).toHaveBeenCalledWith('customer_id', id);
    expect(from).toHaveBeenCalledWith('customer_benefits');
  });
  it('gates roles, activation and expiry without redefining commercial policy', () => {
    const env = {VITE_AUTH_MODE: 'supabase', VITE_PRODUCT_READ_SOURCE: 'supabase'};
    expect(canManageBenefits(env, true, 'OWNER')).toBe(true);
    expect(canManageBenefits(env, true, 'STAFF')).toBe(false);
    expect(canManageBenefits(env, false, 'ADMIN')).toBe(false);
    const benefit = benefitSchema.parse(row);
    expect(benefitActionAllowed('ACTIVATE', benefit)).toBe(true);
    expect(benefitActionAllowed('REDEEM', benefit)).toBe(false);
    const active = {...benefit, status: 'ACTIVE' as const, valid_from: '2026-10-01', valid_until: '2026-10-20'};
    expect(benefitActionAllowed('EXPIRE', active, Date.parse('2026-10-07'))).toBe(false);
    expect(benefitActionAllowed('EXPIRE', active, Date.parse('2026-10-21'))).toBe(true);
  });
  it('contains no direct table mutations or automatic effects', () => {
    const repo = readFileSync(new URL('../src/composition/customer-benefits.ts', import.meta.url), 'utf8');
    const page = readFileSync(new URL('../src/pages/CustomerBenefitsPage.tsx', import.meta.url), 'utf8');
    expect(repo).not.toMatch(/\.(insert|update|upsert|delete)\(/);
    expect(page).not.toContain('useEffect');
    expect(page).toContain('pending.current!.key');
  });
});
