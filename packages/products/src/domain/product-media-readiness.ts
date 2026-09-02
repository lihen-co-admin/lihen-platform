import type { ProductImageSourceType } from './product-image';

export type ProductMediaSurface =
  | 'WEB_CARD'
  | 'WEB_DETAIL'
  | 'CATALOG_PDF';

export type ProductMediaReadiness =
  | 'READY'
  | 'FALLBACK'
  | 'REPLACE'
  | 'UNKNOWN_DIMENSIONS';

export type ProductMediaPublicationEligibility =
  | 'NOT_ELIGIBLE'
  | 'FALLBACK_ONLY'
  | 'ELIGIBLE_PRIMARY';

export interface ProductMediaSourceCandidate {
  readonly sourceType: ProductImageSourceType;
  readonly isExactProductMatch: boolean;
  readonly publicationEligibility: ProductMediaPublicationEligibility;
  readonly widthPx?: number;
  readonly heightPx?: number;
}

const FALLBACK_SOURCE_TYPES: ReadonlySet<ProductImageSourceType> = new Set([
  'SUPPLIER_PDF',
  'SUPPLIER_DRIVE',
  'CATALOG_EVIDENCE_CROP',
]);

function hasKnownPositiveDimensions(
  candidate: ProductMediaSourceCandidate,
): candidate is ProductMediaSourceCandidate & {
  readonly widthPx: number;
  readonly heightPx: number;
} {
  return (
    typeof candidate.widthPx === 'number' &&
    Number.isInteger(candidate.widthPx) &&
    candidate.widthPx > 0 &&
    typeof candidate.heightPx === 'number' &&
    Number.isInteger(candidate.heightPx) &&
    candidate.heightPx > 0
  );
}

export function evaluateProductMediaSourceReadiness(
  candidate: ProductMediaSourceCandidate,
): ProductMediaReadiness {
  if (!candidate.isExactProductMatch) {
    return 'REPLACE';
  }

  if (candidate.publicationEligibility === 'NOT_ELIGIBLE') {
    return 'REPLACE';
  }

  if (!hasKnownPositiveDimensions(candidate)) {
    return 'UNKNOWN_DIMENSIONS';
  }

  if (
    candidate.publicationEligibility === 'FALLBACK_ONLY' ||
    FALLBACK_SOURCE_TYPES.has(candidate.sourceType)
  ) {
    return 'FALLBACK';
  }

  return 'READY';
}
