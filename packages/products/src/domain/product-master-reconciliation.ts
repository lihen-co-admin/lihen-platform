export type ProductMasterReconciliationStatus =
  | 'MATCHED'
  | 'NEW_PRODUCT'
  | 'POSSIBLE_MATCH'
  | 'CONFLICT'
  | 'REVIEW_REQUIRED';

export type ProductMasterMatchMethod =
  | 'PRODUCT_ID'
  | 'SKU'
  | 'CATALOG_CODE'
  | 'NORMALIZED_NAME_AND_BRAND'
  | 'NORMALIZED_NAME_ONLY'
  | 'NONE';

export interface ProductMasterRecord {
  readonly productId: string;
  readonly sku?: string;
  readonly catalogCode?: string;
  readonly name: string;
  readonly brandName?: string;
  readonly categoryName?: string;
  readonly imageSha256?: string;
}

export interface CanonicalProductReference {
  readonly referenceId: string;
  readonly trustedProductId?: string;
  readonly sku?: string;
  readonly catalogCode?: string;
  readonly name: string;
  readonly brandName?: string;
  readonly categoryName?: string;
  readonly imageSha256?: string;
  readonly sourceReviewRequired?: boolean;
  readonly duplicateCanonicalIdentity?: boolean;
}

export interface ProductMasterReconciliationResult {
  readonly referenceId: string;
  readonly status: ProductMasterReconciliationStatus;
  readonly matchMethod: ProductMasterMatchMethod;
  readonly confidence: number;
  readonly selectedProductId?: string;
  readonly candidateProductIds: readonly string[];
  readonly reasons: readonly string[];
}

export function normalizeProductIdentityText(value: string | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

const uniqueByProductId = (rows: readonly ProductMasterRecord[]): ProductMasterRecord[] =>
  [...new Map(rows.map((row) => [row.productId, row])).values()];

function result(
  referenceId: string,
  status: ProductMasterReconciliationStatus,
  matchMethod: ProductMasterMatchMethod,
  confidence: number,
  candidates: readonly ProductMasterRecord[],
  reasons: readonly string[],
  selectedProductId?: string,
): ProductMasterReconciliationResult {
  return {
    referenceId,
    status,
    matchMethod,
    confidence,
    ...(selectedProductId ? { selectedProductId } : {}),
    candidateProductIds: uniqueByProductId(candidates).map((row) => row.productId),
    reasons,
  };
}

export function reconcileCanonicalProductReference(
  reference: CanonicalProductReference,
  productMaster: readonly ProductMasterRecord[],
): ProductMasterReconciliationResult {
  if (reference.sourceReviewRequired) {
    return result(reference.referenceId, 'REVIEW_REQUIRED', 'NONE', 0, [], ['SOURCE_REVIEW_REQUIRED']);
  }

  if (reference.duplicateCanonicalIdentity) {
    return result(reference.referenceId, 'CONFLICT', 'NONE', 0, [], ['DUPLICATE_CANONICAL_IDENTITY']);
  }

  if (productMaster.length === 0) {
    return result(reference.referenceId, 'NEW_PRODUCT', 'NONE', 0, [], ['PRODUCT_MASTER_EMPTY']);
  }

  const productIdMatches = reference.trustedProductId
    ? productMaster.filter((p) => p.productId === reference.trustedProductId)
    : [];
  if (productIdMatches.length === 1) {
    return result(reference.referenceId, 'MATCHED', 'PRODUCT_ID', 100, productIdMatches, ['TRUSTED_PRODUCT_ID_EXACT'], productIdMatches[0]!.productId);
  }

  const normalizedSku = normalizeProductIdentityText(reference.sku);
  const normalizedCatalogCode = normalizeProductIdentityText(reference.catalogCode);
  const skuMatches = normalizedSku
    ? productMaster.filter((p) => normalizeProductIdentityText(p.sku) === normalizedSku)
    : [];
  const codeMatches = normalizedCatalogCode
    ? productMaster.filter((p) => normalizeProductIdentityText(p.catalogCode) === normalizedCatalogCode)
    : [];

  if (skuMatches.length > 0 && codeMatches.length > 0) {
    const skuIds = new Set(skuMatches.map((p) => p.productId));
    const common = codeMatches.filter((p) => skuIds.has(p.productId));
    if (common.length === 1 && skuMatches.length === 1 && codeMatches.length === 1) {
      return result(reference.referenceId, 'MATCHED', 'SKU', 100, common, ['SKU_AND_CATALOG_CODE_AGREE'], common[0]!.productId);
    }
    if (common.length === 0 || skuMatches.length > 1 || codeMatches.length > 1) {
      return result(reference.referenceId, 'CONFLICT', 'NONE', 0, [...skuMatches, ...codeMatches], ['IDENTIFIER_CONFLICT']);
    }
  }

  if (skuMatches.length === 1) {
    return result(reference.referenceId, 'MATCHED', 'SKU', 100, skuMatches, ['SKU_EXACT_UNIQUE'], skuMatches[0]!.productId);
  }
  if (skuMatches.length > 1) {
    return result(reference.referenceId, 'CONFLICT', 'SKU', 0, skuMatches, ['SKU_NOT_UNIQUE']);
  }
  if (codeMatches.length === 1) {
    return result(reference.referenceId, 'MATCHED', 'CATALOG_CODE', 100, codeMatches, ['CATALOG_CODE_EXACT_UNIQUE'], codeMatches[0]!.productId);
  }
  if (codeMatches.length > 1) {
    return result(reference.referenceId, 'CONFLICT', 'CATALOG_CODE', 0, codeMatches, ['CATALOG_CODE_NOT_UNIQUE']);
  }

  const normalizedName = normalizeProductIdentityText(reference.name);
  const normalizedBrand = normalizeProductIdentityText(reference.brandName);
  const nameMatches = productMaster.filter((p) => normalizeProductIdentityText(p.name) === normalizedName);
  const nameAndBrandMatches = normalizedBrand
    ? nameMatches.filter((p) => normalizeProductIdentityText(p.brandName) === normalizedBrand)
    : [];

  if (nameAndBrandMatches.length === 1) {
    return result(reference.referenceId, 'MATCHED', 'NORMALIZED_NAME_AND_BRAND', 95, nameAndBrandMatches, ['NAME_AND_BRAND_EXACT_NORMALIZED'], nameAndBrandMatches[0]!.productId);
  }
  if (nameAndBrandMatches.length > 1) {
    return result(reference.referenceId, 'CONFLICT', 'NORMALIZED_NAME_AND_BRAND', 0, nameAndBrandMatches, ['NAME_AND_BRAND_AMBIGUOUS']);
  }
  if (nameMatches.length === 1) {
    return result(reference.referenceId, 'POSSIBLE_MATCH', 'NORMALIZED_NAME_ONLY', 70, nameMatches, ['NAME_EXACT_BRAND_NOT_CONFIRMED']);
  }
  if (nameMatches.length > 1) {
    return result(reference.referenceId, 'CONFLICT', 'NORMALIZED_NAME_ONLY', 0, nameMatches, ['NAME_AMBIGUOUS']);
  }

  return result(reference.referenceId, 'NEW_PRODUCT', 'NONE', 0, [], ['NO_CANONICAL_MATCH']);
}
