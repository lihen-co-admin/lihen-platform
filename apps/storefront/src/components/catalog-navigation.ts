export type CatalogBusinessLine = 'BEAUTY_CARE' | 'STYLE';

export interface CatalogNavigationTarget {
  readonly businessLine?: CatalogBusinessLine | null | undefined;
  readonly brand?: string | null | undefined;
  readonly category?: string | null | undefined;
  readonly query?: string | null | undefined;
  readonly page?: number | null | undefined;
}

export function buildCatalogHref(target: CatalogNavigationTarget = {}): string {
  const params = new URLSearchParams();
  if (target.businessLine) params.set('business_line', target.businessLine);
  if (target.brand) params.set('brand', target.brand);
  if (target.category) params.set('category', target.category);
  if (target.query) params.set('q', target.query);
  if ((target.page ?? 1) > 1) params.set('page', String(target.page));
  const query = params.toString();
  return `#catalogo${query ? `?${query}` : ''}`;
}
