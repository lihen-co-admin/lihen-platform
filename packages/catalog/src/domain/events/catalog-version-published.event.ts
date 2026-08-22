export const CATALOG_VERSION_PUBLISHED_EVENT = 'CATALOG_VERSION_PUBLISHED' as const;

export interface CatalogVersionPublishedEvent {
  readonly eventId: string;
  readonly eventType: typeof CATALOG_VERSION_PUBLISHED_EVENT;
  readonly aggregateId: string;
  readonly occurredAt: Date;
  readonly payload: {
    readonly businessLine: string;
    readonly versionCode: string;
    readonly publishedBy: string;
  };
}
