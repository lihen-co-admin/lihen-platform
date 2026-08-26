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
    && nullableString(row.image_url)
    && nullableString(row.product_id)
    && nullableString(row.product_slug)
    && nullableString(row.product_name)
    && nullableString(row.product_brand)
    && (row.product_sale_price === null || (typeof row.product_sale_price === 'number' && Number.isFinite(row.product_sale_price)) || typeof row.product_sale_price === 'string')
    && nullableString(row.product_availability)
    && nullableString(row.collection_key);
}

export function parsePublicHubPayload(payload: unknown): PublicHubBlock[] {
  if (!Array.isArray(payload)) return [];
  return payload.filter(isPublicHubBlock).sort((left, right) => left.sort_order - right.sort_order);
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
