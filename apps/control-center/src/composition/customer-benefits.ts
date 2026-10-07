import { getBrowserSupabaseClient } from '@lihen/database';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

const nullableId = z.string().nullable();
export const benefitSchema = z.object({
  id: z.string(), customer_id: z.string(), benefit_code: z.string(),
  business_line: z.enum(['BEAUTY_CARE', 'STYLE']),
  benefit_type: z.enum(['WELCOME', 'PURCHASE_THRESHOLD', 'RETURN_AFTER_EXPIRED']),
  status: z.enum(['GENERATED', 'ACTIVE', 'REDEEMED', 'EXPIRED', 'CANCELLED']),
  discount_percent: z.coerce.number(), created_at: z.string(),
  issued_at: nullableId, valid_from: nullableId, valid_until: nullableId,
  source_order_id: nullableId, source_sale_id: nullableId,
  redeemed_order_id: nullableId, redeemed_sale_id: nullableId,
  predecessor_benefit_id: nullableId,
});
export type CustomerBenefit = z.infer<typeof benefitSchema>;
export const benefitActions = {
  WELCOME: 'issue_customer_welcome_benefit_controlled',
  PURCHASE_THRESHOLD: 'issue_customer_purchase_threshold_benefit_controlled',
  RETURN_AFTER_EXPIRED: 'issue_customer_return_after_expired_benefit_controlled',
  ACTIVATE: 'activate_customer_benefit_controlled',
  EXPIRE: 'expire_customer_benefit_controlled',
  APPLY: 'apply_customer_benefit_to_order_controlled',
  REMOVE: 'remove_customer_benefit_from_order_controlled',
  REDEEM: 'redeem_customer_benefit_controlled',
} as const;
export type BenefitAction = keyof typeof benefitActions;
export interface BenefitInput {
  operationKey: string; benefitId: string; orderId: string; saleId: string;
  businessLine: 'BEAUTY_CARE' | 'STYLE'; discountPercent: number;
}
export function canManageBenefits(env: Record<string, unknown>, authorized: boolean, role?: string) {
  return authorized && (role === 'OWNER' || role === 'ADMIN')
    && env.VITE_AUTH_MODE === 'supabase' && env.VITE_PRODUCT_READ_SOURCE === 'supabase';
}
export function benefitActionAllowed(action: BenefitAction, benefit?: CustomerBenefit, now = Date.now()) {
  if (['WELCOME', 'PURCHASE_THRESHOLD', 'RETURN_AFTER_EXPIRED'].includes(action)) return true;
  if (!benefit) return false;
  if (action === 'ACTIVATE') return benefit.status === 'GENERATED';
  if (action === 'REMOVE') return benefit.status !== 'REDEEMED';
  if (benefit.status !== 'ACTIVE' || !benefit.valid_until) return false;
  if (action === 'EXPIRE') return Date.parse(benefit.valid_until) <= now;
  return Boolean(benefit.valid_from) && Date.parse(benefit.valid_from!) <= now && now < Date.parse(benefit.valid_until);
}
export function benefitRpcArguments(action: BenefitAction, input: BenefitInput) {
  if (!input.operationKey.trim()) throw new Error('Operation key requerida.');
  const args: Record<string, string | number> = { p_operation_key: input.operationKey };
  const uuid = (value: string) => z.string().uuid().parse(value.trim());
  if (['WELCOME', 'PURCHASE_THRESHOLD', 'RETURN_AFTER_EXPIRED'].includes(action)) {
    args.p_source_sale_id = uuid(input.saleId);
    args.p_business_line = z.enum(['BEAUTY_CARE', 'STYLE']).parse(input.businessLine);
    args.p_discount_percent = z.number().gt(0).max(100).parse(input.discountPercent);
  } else {
    args.p_benefit_id = uuid(input.benefitId);
    if (action === 'APPLY' || action === 'REMOVE') args.p_order_id = uuid(input.orderId);
    if (action === 'REDEEM') args.p_redeemed_sale_id = uuid(input.saleId);
  }
  return args;
}
export function createCustomerBenefitsRepository(client: SupabaseClient, allowed: boolean) {
  return {
    async list(customerId = '', offset = 0): Promise<CustomerBenefit[]> {
      if (!allowed) throw new Error('BONOS: requiere Supabase y OWNER/ADMIN activo.');
      let query = client.from('customer_benefits').select(Object.keys(benefitSchema.shape).join(','))
        .order('created_at', { ascending: false }).order('id').range(offset, offset + 99);
      if (customerId.trim()) query = query.eq('customer_id', z.string().uuid().parse(customerId.trim()));
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return z.array(benefitSchema).parse(data);
    },
    async execute(action: BenefitAction, input: BenefitInput) {
      if (!allowed) throw new Error('BONOS: acción bloqueada.');
      const { data, error } = await client.rpc(benefitActions[action], benefitRpcArguments(action, input));
      if (error) throw new Error(error.message);
      if (!Array.isArray(data) || !data.length) throw new Error('BONOS: respuesta RPC vacía. Consultar antes de reintentar.');
      return data as Record<string, unknown>[];
    },
  };
}
export function customerBenefitsRepository(allowed: boolean) {
  return createCustomerBenefitsRepository(getBrowserSupabaseClient(import.meta.env), allowed);
}
