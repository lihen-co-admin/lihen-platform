export type TaxonomyEntityType = 'BRAND' | 'CATEGORY';

export type TaxonomyReconciliationStatus =
  | 'MATCHED'
  | 'NEW_ENTITY'
  | 'POSSIBLE_MATCH'
  | 'CONFLICT'
  | 'REVIEW_REQUIRED';

export type TaxonomyMatchMethod =
  | 'TRUSTED_ID'
  | 'NORMALIZED_NAME'
  | 'NONE';

export interface TaxonomyMasterRecord {
  readonly id: string;
  readonly entityType: TaxonomyEntityType;
  readonly name: string;
  readonly parentId?: string;
  readonly businessLine?: string;
}

export interface CanonicalTaxonomyReference {
  readonly referenceId: string;
  readonly entityType: TaxonomyEntityType;
  readonly trustedId?: string;
  readonly displayName: string;
  readonly sourceConfidence: 'HIGH' | 'MEDIUM' | 'LOW';
  readonly parentLabel?: string;
  readonly businessLine?: string;
  readonly sourceReviewRequired?: boolean;
}

export interface TaxonomyReconciliationResult {
  readonly referenceId: string;
  readonly entityType: TaxonomyEntityType;
  readonly status: TaxonomyReconciliationStatus;
  readonly matchMethod: TaxonomyMatchMethod;
  readonly confidence: number;
  readonly selectedId?: string;
  readonly candidateIds: readonly string[];
  readonly reasons: readonly string[];
}

export function normalizeTaxonomyText(value: string | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function makeResult(
  reference: CanonicalTaxonomyReference,
  status: TaxonomyReconciliationStatus,
  matchMethod: TaxonomyMatchMethod,
  confidence: number,
  candidates: readonly TaxonomyMasterRecord[],
  reasons: readonly string[],
  selectedId?: string,
): TaxonomyReconciliationResult {
  return {
    referenceId: reference.referenceId,
    entityType: reference.entityType,
    status,
    matchMethod,
    confidence,
    ...(selectedId ? { selectedId } : {}),
    candidateIds: [...new Set(candidates.map((candidate) => candidate.id))],
    reasons,
  };
}

export function reconcileTaxonomyReference(
  reference: CanonicalTaxonomyReference,
  master: readonly TaxonomyMasterRecord[],
): TaxonomyReconciliationResult {
  if (reference.sourceReviewRequired || reference.sourceConfidence !== 'HIGH') {
    return makeResult(reference, 'REVIEW_REQUIRED', 'NONE', 0, [], [
      reference.sourceReviewRequired ? 'SOURCE_REVIEW_REQUIRED' : `SOURCE_CONFIDENCE_${reference.sourceConfidence}`,
    ]);
  }

  const sameType = master.filter((row) => row.entityType === reference.entityType);

  if (reference.trustedId) {
    const trusted = sameType.filter((row) => row.id === reference.trustedId);
    if (trusted.length === 1) {
      return makeResult(reference, 'MATCHED', 'TRUSTED_ID', 100, trusted, ['TRUSTED_ID_EXACT'], trusted[0]!.id);
    }
  }

  if (sameType.length === 0) {
    return makeResult(reference, 'NEW_ENTITY', 'NONE', 0, [], ['TAXONOMY_MASTER_EMPTY_FOR_TYPE']);
  }

  const normalizedName = normalizeTaxonomyText(reference.displayName);
  const nameMatches = sameType.filter((row) => normalizeTaxonomyText(row.name) === normalizedName);

  if (nameMatches.length === 1) {
    return makeResult(reference, 'MATCHED', 'NORMALIZED_NAME', 95, nameMatches, ['NORMALIZED_NAME_EXACT_UNIQUE'], nameMatches[0]!.id);
  }
  if (nameMatches.length > 1) {
    return makeResult(reference, 'CONFLICT', 'NORMALIZED_NAME', 0, nameMatches, ['NORMALIZED_NAME_NOT_UNIQUE']);
  }

  return makeResult(reference, 'NEW_ENTITY', 'NONE', 0, [], ['NO_CANONICAL_TAXONOMY_MATCH']);
}
