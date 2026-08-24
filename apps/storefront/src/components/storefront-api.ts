import type { StorefrontProduct, StorefrontProductPage, StorefrontProductQuery } from './storefront-product';

interface StorefrontRuntimeConfig {
  url: string;
  publishableKey: string;
}

const defaultDevConfig: StorefrontRuntimeConfig = {
  url: 'https://vnmkupzptujtywnnabkp.supabase.co',
  publishableKey: 'sb_publishable_E03kLaIYYbTgn6c6rBR52Q_iAaWTwr4',
};

function runtimeConfig(): StorefrontRuntimeConfig {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (url && publishableKey) return { url, publishableKey };

  // DEV-only fallback. Both values are browser-publishable and the RPC is
  // explicitly granted to anon/authenticated. Production can override them via Vite env.
  return defaultDevConfig;
}

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
  const config = runtimeConfig();
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
