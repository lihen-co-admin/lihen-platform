import type { BusinessLine } from './business-line';

export type ProductImportCandidateStatus = 'READY_CANDIDATE' | 'CONFLICT' | 'REVIEW_REQUIRED';
export type ProductImportProposedAction = 'CREATE_PRODUCT' | 'HOLD_FOR_REVIEW';

export interface ProductImportCandidateInput {
  readonly referenceId: string;
  readonly businessLine: BusinessLine;
  readonly name: string;
  readonly brandId?: string;
  readonly categoryId?: string;
  readonly sourceReviewRequired?: boolean;
  readonly duplicateIdentity?: boolean;
}

export interface ProductImportCandidateAssessment {
  readonly referenceId: string;
  readonly businessLine: BusinessLine;
  readonly status: ProductImportCandidateStatus;
  readonly proposedAction: ProductImportProposedAction;
  readonly taxonomyAnchored: boolean;
  readonly reasons: readonly string[];
  readonly autoInsertAllowed: false;
}

export function assessProductImportCandidate(input: ProductImportCandidateInput): ProductImportCandidateAssessment {
  const reasons: string[] = [];
  const taxonomyAnchored = Boolean(input.brandId || input.categoryId);
  const base = { referenceId: input.referenceId, businessLine: input.businessLine } as const;

  if (!taxonomyAnchored) {
    return { ...base, status:'REVIEW_REQUIRED', proposedAction:'HOLD_FOR_REVIEW', taxonomyAnchored:false, reasons:['NO_CANONICAL_TAXONOMY_ANCHOR'], autoInsertAllowed:false };
  }
  if (input.sourceReviewRequired) {
    return { ...base, status:'REVIEW_REQUIRED', proposedAction:'HOLD_FOR_REVIEW', taxonomyAnchored:true, reasons:['CATALOG_AUDIT_REVIEW_REQUIRED'], autoInsertAllowed:false };
  }
  if (input.duplicateIdentity) {
    return { ...base, status:'CONFLICT', proposedAction:'HOLD_FOR_REVIEW', taxonomyAnchored:true, reasons:['DUPLICATE_NORMALIZED_NAME_AND_TAXONOMY_CONTEXT'], autoInsertAllowed:false };
  }
  reasons.push('UNIQUE_CATALOG_IDENTITY_WITH_RESOLVED_TAXONOMY');
  if (input.brandId) reasons.push('BRAND_ID_RESOLVED');
  if (input.categoryId) reasons.push('CATEGORY_ID_RESOLVED');
  return { ...base, status:'READY_CANDIDATE', proposedAction:'CREATE_PRODUCT', taxonomyAnchored:true, reasons, autoInsertAllowed:false };
}
