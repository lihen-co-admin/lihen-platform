import type { StorefrontBrand } from './storefront-brand';
import type { StorefrontProduct, StorefrontProductPage, StorefrontProductQuery } from './storefront-product';
import { getStorefrontRuntimeConfig } from './storefront-runtime-config';

function normalizeProduct(value: unknown): StorefrontProduct | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (typeof row.product_id !== 'string' || typeof row.product_name !== 'string') return null;
  if (typeof row.main_image_url !== 'string' || typeof row.availability !== 'string') return null;

  return {
    product_id: row.product_id,
    sku: typeof row.sku === 'string' ? row.sku : '',
    slug: typeof row.slug === 'string' ? row.slug : row.product_id,
    product_name: row.product_name,
    business_line: typeof row.business_line === 'string' ? row.business_line : 'BEAUTY_CARE',
    brand: typeof row.brand === 'string' ? row.brand : null,
    category: typeof row.category === 'string' ? row.category : null,
    subcategory: typeof row.subcategory === 'string' ? row.subcategory : null,
    description: typeof row.description === 'string' ? row.description : null,
    sale_price: typeof row.sale_price === 'number' || typeof row.sale_price === 'string' ? row.sale_price : 0,
    main_image_url: row.main_image_url,
    image_urls: Array.isArray(row.image_urls) ? row.image_urls.filter((url): url is string => typeof url === 'string') : [row.main_image_url],
    availability: row.availability as StorefrontProduct['availability'],
  };
}

export async function getStorefrontProducts(query: StorefrontProductQuery = {}): Promise<StorefrontProductPage> {
  const config = getStorefrontRuntimeConfig();
  const requestedLimit = Math.min(Math.max(query.limit ?? 24, 1), 100);
  const fetchLimit = Math.min(requestedLimit + 1, 100);
  const response = await fetch(`${config.url}/rest/v1/rpc/get_storefront_products_controlled`, {
    method: 'POST',
    headers: {
      apikey: config.publishableKey,
      Authorization: `Bearer ${config.publishableKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_limit: fetchLimit,
      p_offset: Math.max(query.offset ?? 0, 0),
      p_query: query.query?.trim() || null,
      p_business_line: query.businessLine || null,
      p_brand: query.brand || null,
      p_category: query.category || null,
    }),
  });

  if (!response.ok) {
    throw new Error(`No fue posible cargar el catálogo (${response.status}).`);
  }

  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) return { items: [], hasMore: false };

  const normalized = payload.map(normalizeProduct).filter((item): item is StorefrontProduct => item !== null);
  return {
    items: normalized.slice(0, requestedLimit),
    hasMore: normalized.length > requestedLimit,
  };
}


function normalizeBrand(value: unknown): StorefrontBrand | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (typeof row.brand_id !== 'string' || typeof row.brand_name !== 'string') return null;
  const count = typeof row.visible_product_count === 'number'
    ? row.visible_product_count
    : Number(row.visible_product_count);
  if (!Number.isFinite(count) || count < 1) return null;

  return {
    brand_id: row.brand_id,
    brand_name: row.brand_name,
    logo_url: typeof row.logo_url === 'string' && row.logo_url.trim() ? row.logo_url : null,
    visible_product_count: count,
  };
}

export async function getStorefrontBrands(
  businessLine: 'BEAUTY_CARE' | 'STYLE' = 'BEAUTY_CARE',
  limit = 60,
): Promise<StorefrontBrand[]> {
  const config = getStorefrontRuntimeConfig();
  const response = await fetch(`${config.url}/rest/v1/rpc/get_storefront_brands_controlled`, {
    method: 'POST',
    headers: {
      apikey: config.publishableKey,
      Authorization: `Bearer ${config.publishableKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_business_line: businessLine,
      p_limit: Math.min(Math.max(limit, 1), 100),
    }),
  });

  if (!response.ok) {
    throw new Error(`No fue posible cargar las marcas (${response.status}).`);
  }

  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) return [];
  return payload.map(normalizeBrand).filter((brand): brand is StorefrontBrand => brand !== null);
}
