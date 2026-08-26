import { getStorefrontRuntimeConfig } from './storefront-runtime-config';

export const publicHubBlockTypes = ['LINK', 'SOCIAL', 'PRODUCT', 'PRODUCT_COLLECTION', 'BANNER', 'TEXT', 'HEADING', 'CTA'] as const;
export type PublicHubBlockType = (typeof publicHubBlockTypes)[number];

export type PublicHubBlock = {
  block_id: string;
  block_type: PublicHubBlockType;
  sort_order: number;
  title: string | null;
  subtitle: string | null;
  body: string | null;
  cta_label: string | null;
  target_url: string | null;
  image_url: string | null;
  product_id: string | null;
  product_slug: string | null;
  product_name: string | null;
  product_brand: string | null;
  product_sale_price: number | string | null;
  product_availability: string | null;
  collection_key: string | null;
};

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isSafeTargetUrl(value: string | null): boolean {
  return value === null || /^(https?:\/\/|mailto:|tel:|#)/i.test(value);
}

function isSafeImageUrl(value: string | null): boolean {
  return value === null || /^https?:\/\//i.test(value);
}

function isMoneyValue(value: unknown): value is number | string | null {
  if (value === null) return true;
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0;
  if (typeof value !== 'string' || !value.trim()) return false;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0;
}

function isPublicHubBlock(value: unknown): value is PublicHubBlock {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.block_id === 'string'
    && publicHubBlockTypes.includes(row.block_type as PublicHubBlockType)
    && typeof row.sort_order === 'number'
    && Number.isFinite(row.sort_order)
    && nullableString(row.title)
    && nullableString(row.subtitle)
    && nullableString(row.body)
    && nullableString(row.cta_label)
    && nullableString(row.target_url)
    && isSafeTargetUrl(row.target_url as string | null)
    && nullableString(row.image_url)
    && isSafeImageUrl(row.image_url as string | null)
    && nullableString(row.product_id)
    && nullableString(row.product_slug)
    && nullableString(row.product_name)
    && nullableString(row.product_brand)
    && isMoneyValue(row.product_sale_price)
    && nullableString(row.product_availability)
    && nullableString(row.collection_key);
}

export function parsePublicHubPayload(payload: unknown): PublicHubBlock[] {
  if (!Array.isArray(payload)) return [];
  return payload.filter(isPublicHubBlock).sort((left, right) => left.sort_order - right.sort_order || left.block_id.localeCompare(right.block_id));
}

export async function getPublicHub(): Promise<PublicHubBlock[]> {
  const config = getStorefrontRuntimeConfig();
  const response = await fetch(`${config.url}/rest/v1/rpc/get_public_hub_controlled`, {
    method: 'POST',
    headers: {
      apikey: config.publishableKey,
      Authorization: `Bearer ${config.publishableKey}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  if (!response.ok) throw new Error(`No fue posible cargar el Hub (${response.status}).`);
  return parsePublicHubPayload(await response.json());
}
