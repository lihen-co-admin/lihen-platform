import type { TaxonomyEntityType } from './taxonomy-reconciliation';

export type TaxonomyImportStatus =
  | 'READY_CREATE'
  | 'ALREADY_EXISTS'
  | 'CONFLICT_NORMALIZED_NAME'
  | 'BLOCKED_NOT_APPROVED';

export interface ApprovedTaxonomyImportCandidate {
  readonly referenceId: string;
  readonly entityType: TaxonomyEntityType;
  readonly canonicalName: string;
  readonly sourcePage?: number;
  readonly approved: boolean;
}

export interface ExistingTaxonomyIdentity {
  readonly id: string;
  readonly entityType: TaxonomyEntityType;
  readonly name: string;
  readonly normalizedName: string;
  readonly parentId?: string;
}

export interface TaxonomyImportPreviewItem {
  readonly referenceId: string;
  readonly entityType: TaxonomyEntityType;
  readonly canonicalName: string;
  readonly normalizedName: string;
  readonly sourcePage?: number;
  readonly status: TaxonomyImportStatus;
  readonly existingEntityId?: string;
  readonly reason: string;
}

export function normalizeTaxonomyImportName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function taxonomyCategorySlug(value: string): string {
  return normalizeTaxonomyImportName(value).replace(/\s+/g, '-');
}

export function previewControlledTaxonomyImport(
  approved: readonly ApprovedTaxonomyImportCandidate[],
  existing: readonly ExistingTaxonomyIdentity[],
): readonly TaxonomyImportPreviewItem[] {
  const normalizedApprovalCounts = new Map<string, number>();

  for (const candidate of approved) {
    if (!candidate.approved) continue;
    const key = `${candidate.entityType}|${normalizeTaxonomyImportName(candidate.canonicalName)}`;
    normalizedApprovalCounts.set(key, (normalizedApprovalCounts.get(key) ?? 0) + 1);
  }

  return approved.map((candidate) => {
    const normalizedName = normalizeTaxonomyImportName(candidate.canonicalName);

    if (!candidate.approved) {
      return {
        referenceId: candidate.referenceId,
        entityType: candidate.entityType,
        canonicalName: candidate.canonicalName,
        normalizedName,
        ...(candidate.sourcePage !== undefined ? { sourcePage: candidate.sourcePage } : {}),
        status: 'BLOCKED_NOT_APPROVED',
        reason: 'TAXONOMY_DECISION_NOT_APPROVED_NEW_ENTITY',
      };
    }

    const approvalKey = `${candidate.entityType}|${normalizedName}`;
    if ((normalizedApprovalCounts.get(approvalKey) ?? 0) > 1) {
      return {
        referenceId: candidate.referenceId,
        entityType: candidate.entityType,
        canonicalName: candidate.canonicalName,
        normalizedName,
        ...(candidate.sourcePage !== undefined ? { sourcePage: candidate.sourcePage } : {}),
        status: 'CONFLICT_NORMALIZED_NAME',
        reason: 'DUPLICATE_APPROVED_NORMALIZED_NAME_REQUIRES_REVIEW',
      };
    }

    const matches = existing.filter(
      (row) =>
        row.entityType === candidate.entityType &&
        normalizeTaxonomyImportName(row.normalizedName || row.name) === normalizedName &&
        (candidate.entityType !== 'CATEGORY' || !row.parentId),
    );

    if (matches.length > 0) {
      return {
        referenceId: candidate.referenceId,
        entityType: candidate.entityType,
        canonicalName: candidate.canonicalName,
        normalizedName,
        ...(candidate.sourcePage !== undefined ? { sourcePage: candidate.sourcePage } : {}),
        status: 'ALREADY_EXISTS',
        existingEntityId: matches[0]!.id,
        reason: 'CANONICAL_NORMALIZED_NAME_ALREADY_PRESENT',
      };
    }

    return {
      referenceId: candidate.referenceId,
      entityType: candidate.entityType,
      canonicalName: candidate.canonicalName,
      normalizedName,
      ...(candidate.sourcePage !== undefined ? { sourcePage: candidate.sourcePage } : {}),
      status: 'READY_CREATE',
      reason: 'APPROVED_NEW_ENTITY_AND_NO_EXISTING_NORMALIZED_NAME',
    };
  });
}
