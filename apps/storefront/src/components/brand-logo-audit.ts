import { bundledBrandLogoFallbacks } from './brand-logo-assets';
import type { StorefrontBrand } from './storefront-brand';

export type BrandLogoReadiness = 'CANONICAL' | 'BUNDLED_FALLBACK' | 'MISSING_VERIFIED_SOURCE';

export interface BrandLogoAuditEntry {
  brandName: string;
  visibleProductCount: number;
  readiness: BrandLogoReadiness;
}

export function auditBrandLogos(brands: readonly StorefrontBrand[]): BrandLogoAuditEntry[] {
  return brands.map((brand) => ({
    brandName: brand.brand_name,
    visibleProductCount: brand.visible_product_count,
    readiness: brand.logo_url
      ? 'CANONICAL'
      : bundledBrandLogoFallbacks[brand.brand_name]
        ? 'BUNDLED_FALLBACK'
        : 'MISSING_VERIFIED_SOURCE',
  }));
}
