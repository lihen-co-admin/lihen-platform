import type { ProductVariantAttributes } from '@lihen/products';
/** Evidence identity is not a newly created commercial ProductVariant. */
export interface VariantEvidence {
  familyProductId: string;
  sourceVariantId: string;
  attributes: ProductVariantAttributes;
  sourceUrl: string;
  code: string | null;
  status: 'OFFICIAL_SOURCE' | 'PROBABLE' | 'UNCONFIRMED';
}
export interface VariantScope {
  familyProductId: string;
  variantId: string;
}
export interface VariantMedia extends VariantScope {
  id: string;
  imageUrl: string;
  rights: 'VERIFIED' | 'UNVERIFIED';
  exactMatch: boolean;
}
export function mediaForVariant(scope: VariantScope, images: readonly VariantMedia[]) {
  return images.filter(
    (i) => i.familyProductId === scope.familyProductId && i.variantId === scope.variantId,
  );
}
export interface CommercialFact extends VariantScope {
  verified: boolean;
  currency: string;
  from: string;
  to: string;
  soldUnits: number;
  realizedRevenue: number;
  confirmedOrderUnits: number;
  averageStock: number | null;
}
/** Facts must come from posted sales/net returns and confirmed orders, with complete period
 * coverage certified by an adapter. Never manufacture variant allocations from product totals.
 * Existing order_items/sale_items/inventory_stock have product_id but no variant attribution.
 */
export function variantDemand(
  scope: VariantScope,
  facts: readonly CommercialFact[],
  from: string,
  to: string,
  currency = 'COP',
) {
  const matched = facts.filter(
    (f) => f.familyProductId === scope.familyProductId && f.variantId === scope.variantId,
  );
  if (!matched.length)
    return {
      status: 'SIN DATOS' as const,
      units: null,
      revenue: null,
      requested: null,
      turnover: null,
      replenishment: 'SIN DATOS',
    };
  const exact = matched.filter((f) => f.from === from && f.to === to && f.currency === currency);
  if (
    exact.length !== 1 ||
    !exact[0]?.verified ||
    ![exact[0].soldUnits, exact[0].realizedRevenue, exact[0].confirmedOrderUnits].every(
      (n) => Number.isFinite(n) && n >= 0,
    ) ||
    (exact[0].averageStock !== null &&
      (!Number.isFinite(exact[0].averageStock) || exact[0].averageStock < 0))
  )
    return {
      status: 'NO VERIFICADO' as const,
      units: null,
      revenue: null,
      requested: null,
      turnover: null,
      replenishment: 'NO VERIFICADO',
    };
  const f = exact[0];
  return {
    status: 'DATOS REGISTRADOS' as const,
    units: f.soldUnits,
    revenue: f.realizedRevenue,
    requested: f.confirmedOrderUnits,
    turnover: f.averageStock && f.averageStock > 0 ? f.soldUnits / f.averageStock : null,
    replenishment: 'Pendiente de stock por variante, plazo de entrega y política de reposición',
  };
}
export function canApproveVariantMedia(
  media: VariantMedia,
  rightsEvidence: string,
  exactVariantConfirmed: boolean,
): boolean {
  return (
    media.rights === 'VERIFIED' &&
    media.exactMatch &&
    Boolean(rightsEvidence.trim()) &&
    exactVariantConfirmed
  );
}
