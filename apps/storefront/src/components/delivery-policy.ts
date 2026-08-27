import { getStorefrontRuntimeConfig } from './storefront-runtime-config';
import { escapeHtml, money } from './storefront-product';

export interface StorefrontDeliveryPolicy {
  policyKey: string;
  policyStatus: string;
  coverageScope: string;
  freeShippingThreshold: number | null;
  appliesWeekday: number | null;
  publicLabel: string;
  publicDetail: string;
}

export function parseDeliveryPolicyPayload(payload: unknown): StorefrontDeliveryPolicy[] {
  if (!Array.isArray(payload)) return [];
  return payload.flatMap((raw) => {
    if (!raw || typeof raw !== 'object') return [];
    const row = raw as Record<string, unknown>;
    if (row.policy_status !== 'ACTIVE' || typeof row.policy_key !== 'string' || typeof row.public_label !== 'string' || typeof row.public_detail !== 'string') return [];
    const threshold = row.free_shipping_threshold == null ? null : Number(row.free_shipping_threshold);
    const weekday = row.applies_weekday == null ? null : Number(row.applies_weekday);
    return [{
      policyKey: row.policy_key,
      policyStatus: row.policy_status,
      coverageScope: typeof row.coverage_scope === 'string' ? row.coverage_scope : '',
      freeShippingThreshold: threshold != null && Number.isFinite(threshold) ? threshold : null,
      appliesWeekday: weekday != null && Number.isInteger(weekday) ? weekday : null,
      publicLabel: row.public_label,
      publicDetail: row.public_detail,
    }];
  });
}

export async function getStorefrontDeliveryPolicies(): Promise<StorefrontDeliveryPolicy[]> {
  const config = getStorefrontRuntimeConfig();
  const response = await fetch(`${config.url}/rest/v1/rpc/get_storefront_delivery_policy_controlled`, {
    method: 'POST',
    headers: { apikey: config.publishableKey, Authorization: `Bearer ${config.publishableKey}`, 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!response.ok) throw new Error(`No fue posible cargar la política de entrega (${response.status}).`);
  return parseDeliveryPolicyPayload(await response.json());
}

export function renderDeliveryPolicies(policies: readonly StorefrontDeliveryPolicy[]): string {
  if (policies.length === 0) return '<p class="content-page__policy-note">No hay beneficios especiales activos en este momento.</p>';
  return policies.map((policy) => `
    <div class="content-page__policy-note">
      <strong>${escapeHtml(policy.publicLabel)}</strong>
      <span>${escapeHtml(policy.publicDetail)}</span>
      ${policy.freeShippingThreshold != null ? `<small>Umbral: ${money(policy.freeShippingThreshold)}</small>` : ''}
    </div>`).join('');
}

export async function hydrateDeliveryPolicy(root: ParentNode): Promise<void> {
  const host = root.querySelector<HTMLElement>('[data-delivery-policy]');
  if (!host) return;
  try { host.innerHTML = renderDeliveryPolicies(await getStorefrontDeliveryPolicies()); }
  catch { host.innerHTML = '<p class="content-page__policy-note">Consulta por WhatsApp las condiciones vigentes de entrega.</p>'; }
}
