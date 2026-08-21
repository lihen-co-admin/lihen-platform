import type { BusinessLine } from './business-line';

export type ApprovedProductImportScope = 'HUMAN_APPROVED_IMPORT_SUBSET';
export type ApprovedProductImportStatus = 'READY_CREATE' | 'BLOCKED_LEGACY_MATCH' | 'BLOCKED_CONFLICT' | 'BLOCKED_DECISION_DRIFT';

export interface ApprovedProductImportCandidate {
  readonly sourceReferenceId: string;
  readonly proposedProductId: string;
  readonly businessLine: BusinessLine;
  readonly productName: string;
  readonly proposedSku: string;
  readonly proposedCatalogCode: string;
  readonly proposedSlug: string;
  readonly brandId?: string;
  readonly categoryId?: string;
  readonly salePrice: number;
  readonly imageSha256: string;
  readonly eligibilityStatus: ApprovedProductImportStatus;
}
