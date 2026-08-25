import type { StorefrontMedia } from './storefront-media';

export type StorefrontAvailability = 'AVAILABLE' | 'LOW_STOCK' | 'COMING_SOON' | 'OUT_OF_STOCK';

export interface StorefrontProduct {
  product_id: string;
  sku: string;
  slug: string;
  product_name: string;
  business_line: string;
  brand: string | null;
  category: string | null;
  subcategory: string | null;
  description: string | null;
  sale_price: string | number;
  main_image_url: string;
  image_urls: string[];
  card_media: StorefrontMedia | null;
  detail_media: StorefrontMedia | null;
  gallery_media: StorefrontMedia[];
  availability: StorefrontAvailability;
}

export interface StorefrontProductQuery {
  limit?: number;
  offset?: number;
  query?: string | null;
  businessLine?: string | null;
  brand?: string | null;
  category?: string | null;
  collection?: 'CARE' | null;
  maxPrice?: number | null;
  availableOnly?: boolean | null;
}

export interface StorefrontProductPage {
  items: StorefrontProduct[];
  hasMore: boolean;
}

export function money(value: StorefrontProduct['sale_price']): string {
  const numberValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numberValue)) return '$0';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(numberValue);
}

export function availabilityLabel(value: StorefrontAvailability): string {
  if (value === 'AVAILABLE') return 'Disponible';
  if (value === 'LOW_STOCK') return 'Últimas unidades';
  if (value === 'COMING_SOON') return 'Próximamente';
  return 'Agotado';
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
