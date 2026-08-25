export type StyleProductReadinessStatus = 'READY' | 'BLOCKED';

export interface StyleProductReadinessInput {
  readonly active: boolean;
  readonly visibleOnWebsite: boolean;
  readonly sku?: string;
  readonly salePrice?: number;
  readonly brandId?: string;
  readonly categoryId?: string;
  readonly hasExactApprovedImage: boolean;
}

export interface StyleProductReadinessResult {
  readonly status: StyleProductReadinessStatus;
  readonly blockingReasons: readonly string[];
  readonly visibilityMustRemainOff: boolean;
}

export function evaluateStyleProductReadiness(input: StyleProductReadinessInput): StyleProductReadinessResult {
  const reasons: string[] = [];
  if (!input.active) reasons.push('PRODUCT_NOT_ACTIVE');
  if (!input.sku?.trim()) reasons.push('SKU_REQUIRED');
  if (typeof input.salePrice !== 'number' || !Number.isFinite(input.salePrice) || input.salePrice < 0) reasons.push('SALE_PRICE_REQUIRED');
  if (!input.brandId?.trim()) reasons.push('BRAND_REQUIRED');
  if (!input.categoryId?.trim()) reasons.push('CATEGORY_REQUIRED');
  if (!input.hasExactApprovedImage) reasons.push('EXACT_APPROVED_IMAGE_REQUIRED');
  if (input.visibleOnWebsite) reasons.push('PREMATURE_VISIBILITY');
  return { status: reasons.length === 0 ? 'READY' : 'BLOCKED', blockingReasons: reasons, visibilityMustRemainOff: true };
}
