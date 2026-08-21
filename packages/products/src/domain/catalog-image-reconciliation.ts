export type CatalogEvidenceReviewStatus = 'OK' | 'REVIEW';

export type CatalogImageReconciliationStatus =
  | 'UNRESOLVED_PRODUCT'
  | 'MATCHED_EXACT'
  | 'AMBIGUOUS_MATCH'
  | 'REVIEW_REQUIRED';

export type CatalogImageMatchMethod =
  | 'NORMALIZED_NAME_AND_BRAND'
  | 'NORMALIZED_NAME_ONLY'
  | 'NONE';

export interface CatalogImageEvidence {
  readonly evidenceId: string;
  readonly sourceKey: string;
  readonly page: number;
  readonly slot: string;
  readonly productName: string;
  readonly brandLabel?: string;
  readonly sectionLabel?: string;
  readonly evidenceSha256: string;
  readonly evidencePath: string;
  readonly auditReviewStatus: CatalogEvidenceReviewStatus;
  readonly auditReviewReasons?: string;
}

export interface ProductImageReconciliationProduct {
  readonly productId: string;
  readonly name: string;
  readonly brandName?: string;
}

export interface CatalogImageReconciliationResult {
  readonly evidenceId: string;
  readonly status: CatalogImageReconciliationStatus;
  readonly matchMethod: CatalogImageMatchMethod;
  readonly confidence: number;
  readonly selectedProductId?: string;
  readonly candidateProductIds: readonly string[];
  readonly reasons: readonly string[];
}

/**
 * Normalization is intentionally conservative. It removes presentation noise but
 * never performs fuzzy/semantic substitution. Fuzzy matching must remain a review aid,
 * never an automatic product_id assignment.
 */
export function normalizeCatalogIdentityText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function reconcileCatalogImageEvidence(
  evidence: CatalogImageEvidence,
  products: readonly ProductImageReconciliationProduct[],
): CatalogImageReconciliationResult {
  const reasons: string[] = [];

  if (products.length === 0) {
    return {
      evidenceId: evidence.evidenceId,
      status: 'UNRESOLVED_PRODUCT',
      matchMethod: 'NONE',
      confidence: 0,
      candidateProductIds: [],
      reasons: ['PRODUCT_MASTER_EMPTY'],
    };
  }

  const normalizedEvidenceName = normalizeCatalogIdentityText(evidence.productName);
  const normalizedEvidenceBrand = evidence.brandLabel
    ? normalizeCatalogIdentityText(evidence.brandLabel)
    : undefined;

  const exactName = products.filter(
    (product) => normalizeCatalogIdentityText(product.name) === normalizedEvidenceName,
  );

  const exactNameAndBrand = normalizedEvidenceBrand
    ? exactName.filter(
        (product) =>
          Boolean(product.brandName) &&
          normalizeCatalogIdentityText(product.brandName ?? '') === normalizedEvidenceBrand,
      )
    : [];

  if (exactNameAndBrand.length === 1) {
    const selected = exactNameAndBrand[0]!;
    if (evidence.auditReviewStatus === 'REVIEW') {
      return {
        evidenceId: evidence.evidenceId,
        status: 'REVIEW_REQUIRED',
        matchMethod: 'NORMALIZED_NAME_AND_BRAND',
        confidence: 100,
        candidateProductIds: [selected.productId],
        reasons: ['CATALOG_EVIDENCE_REQUIRES_REVIEW'],
      };
    }
    return {
      evidenceId: evidence.evidenceId,
      status: 'MATCHED_EXACT',
      matchMethod: 'NORMALIZED_NAME_AND_BRAND',
      confidence: 100,
      selectedProductId: selected.productId,
      candidateProductIds: [selected.productId],
      reasons: ['EXACT_NORMALIZED_NAME_AND_BRAND'],
    };
  }

  if (exactNameAndBrand.length > 1) {
    return {
      evidenceId: evidence.evidenceId,
      status: 'AMBIGUOUS_MATCH',
      matchMethod: 'NORMALIZED_NAME_AND_BRAND',
      confidence: 100,
      candidateProductIds: exactNameAndBrand.map((product) => product.productId),
      reasons: ['MULTIPLE_PRODUCTS_SHARE_EXACT_NAME_AND_BRAND'],
    };
  }

  if (exactName.length === 1) {
    const selected = exactName[0]!;
    reasons.push('EXACT_NAME_WITHOUT_CONFIRMED_BRAND');
    if (normalizedEvidenceBrand) reasons.push('BRAND_NOT_CONFIRMED');
    if (evidence.auditReviewStatus === 'REVIEW') reasons.push('CATALOG_EVIDENCE_REQUIRES_REVIEW');
    return {
      evidenceId: evidence.evidenceId,
      status: 'REVIEW_REQUIRED',
      matchMethod: 'NORMALIZED_NAME_ONLY',
      confidence: 80,
      candidateProductIds: [selected.productId],
      reasons,
    };
  }

  if (exactName.length > 1) {
    return {
      evidenceId: evidence.evidenceId,
      status: 'AMBIGUOUS_MATCH',
      matchMethod: 'NORMALIZED_NAME_ONLY',
      confidence: 80,
      candidateProductIds: exactName.map((product) => product.productId),
      reasons: ['MULTIPLE_PRODUCTS_SHARE_EXACT_NORMALIZED_NAME'],
    };
  }

  return {
    evidenceId: evidence.evidenceId,
    status: 'REVIEW_REQUIRED',
    matchMethod: 'NONE',
    confidence: 0,
    candidateProductIds: [],
    reasons: ['NO_DETERMINISTIC_PRODUCT_MATCH'],
  };
}
