export const CATALOG_SOURCE_TYPES = ['PDF', 'WEB'] as const;
export type CatalogSourceType = (typeof CATALOG_SOURCE_TYPES)[number];

export const CATALOG_VERSION_STATUSES = ['DRAFT', 'ACTIVE', 'ARCHIVED'] as const;
export type CatalogVersionStatus = (typeof CATALOG_VERSION_STATUSES)[number];

export interface CatalogVersion {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly versionLabel: string;
  readonly sourceType: CatalogSourceType;
  readonly status: CatalogVersionStatus;
  readonly effectiveAt: Date | null;
  readonly sourceReference: string | null;
  readonly createdAt: Date;
}
