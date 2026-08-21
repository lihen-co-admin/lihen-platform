export const PRODUCT_CANDIDATE_REVIEW_DECISIONS = [
  'APPROVE_CREATE',
  'LINK_EXISTING_PRODUCT',
  'REJECT',
  'DEFER',
] as const;

export type ProductCandidateReviewDecision =
  (typeof PRODUCT_CANDIDATE_REVIEW_DECISIONS)[number];

export const PRODUCT_IDENTITY_RESOLUTIONS = [
  'DISTINCT_PRODUCTS',
  'DUPLICATE_REFERENCE',
  'VARIANT_SET',
  'DEFER',
] as const;

export type ProductIdentityResolution =
  (typeof PRODUCT_IDENTITY_RESOLUTIONS)[number];

export interface CandidateDecisionInput {
  decision: ProductCandidateReviewDecision;
  selectedProductId: string | null;
  reason: string;
}

export interface IdentityResolutionInput {
  resolution: ProductIdentityResolution;
  canonicalSourceReferenceId: string | null;
  memberCount: number;
  reason: string;
}

export function validateCandidateDecision(input: CandidateDecisionInput): void {
  if (!input.reason.trim()) throw new Error('LIHEN_REVIEW_REASON_REQUIRED');

  const needsProduct = input.decision === 'LINK_EXISTING_PRODUCT';
  if (needsProduct !== Boolean(input.selectedProductId)) {
    throw new Error('LIHEN_SELECTED_PRODUCT_DECISION_MISMATCH');
  }
}

export function validateIdentityResolution(input: IdentityResolutionInput): void {
  if (!input.reason.trim()) throw new Error('LIHEN_REVIEW_REASON_REQUIRED');
  if (input.memberCount <= 1) {
    throw new Error('LIHEN_IDENTITY_GROUP_REQUIRES_MULTIPLE_MEMBERS');
  }

  const needsCanonical = input.resolution === 'DUPLICATE_REFERENCE';
  if (needsCanonical !== Boolean(input.canonicalSourceReferenceId)) {
    throw new Error('LIHEN_CANONICAL_REFERENCE_RESOLUTION_MISMATCH');
  }
}
