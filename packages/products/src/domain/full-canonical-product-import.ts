import type { BusinessLine } from './business-line';

export type CanonicalApprovalSource = 'HUMAN_APPROVED' | 'POLICY_APPROVED';
export type FullCanonicalProductImportScope = 'FULL_CANONICAL_APPROVED';
export type FullCanonicalImportEligibility = 'READY_CREATE' | 'BLOCKED';

export interface FullCanonicalProductImportCandidate {
  readonly sourceReferenceId: string;
  readonly approvalSource: CanonicalApprovalSource;
  readonly proposedProductId: string;
  readonly businessLine: BusinessLine;
  readonly productName: string;
  readonly brandId?: string;
  readonly categoryId?: string;
  readonly salePrice: number;
  readonly imageSha256: string;
  readonly proposedSku: string;
  readonly proposedCatalogCode: string;
  readonly proposedSlug: string;
  readonly eligibilityStatus: FullCanonicalImportEligibility;
}

export interface FullCanonicalProductImportSummary {
  readonly canonicalApproved: number;
  readonly humanApproved: number;
  readonly policyApproved: number;
  readonly rejectedExcluded: number;
  readonly deferredExcluded: number;
  readonly readyCreate: number;
  readonly conflicts: number;
  readonly productWritesExecuted: boolean;
}

export function assertFullCanonicalImportSummary(summary: FullCanonicalProductImportSummary): void {
  if (summary.canonicalApproved !== 952) throw new Error('LIHEN_FULL_CANONICAL_APPROVED_COUNT_INVALID');
  if (summary.humanApproved !== 136) throw new Error('LIHEN_FULL_CANONICAL_HUMAN_COUNT_INVALID');
  if (summary.policyApproved !== 816) throw new Error('LIHEN_FULL_CANONICAL_POLICY_COUNT_INVALID');
  if (summary.humanApproved + summary.policyApproved !== summary.canonicalApproved) {
    throw new Error('LIHEN_FULL_CANONICAL_APPROVAL_SUM_MISMATCH');
  }
  if (summary.rejectedExcluded !== 6 || summary.deferredExcluded !== 45) {
    throw new Error('LIHEN_FULL_CANONICAL_EXCLUSION_COUNT_INVALID');
  }
  if (summary.readyCreate !== summary.canonicalApproved || summary.conflicts !== 0) {
    throw new Error('LIHEN_FULL_CANONICAL_PREVIEW_NOT_READY');
  }
  if (summary.productWritesExecuted) throw new Error('LIHEN_FULL_CANONICAL_FOUNDATION_MUST_NOT_WRITE_PRODUCTS');
}
