import type { MarketingChannel } from './campaign';

export const preparedPublicationStatuses = [
  'PREPARED',
  'IN_REVIEW',
  'APPROVED',
  'CANCELLED',
] as const;

export type PreparedPublicationStatus =
  (typeof preparedPublicationStatuses)[number];

export interface PreparedPublication {
  readonly id: string;
  readonly campaignId: string;
  readonly campaignContentId: string;
  readonly channelVariantId: string;
  readonly scheduleId: string | null;
  readonly channel: MarketingChannel;
  readonly copy: string;
  readonly callToAction: string;
  readonly hashtags: readonly string[];
  readonly creativeAssetIds: readonly string[];
  readonly status: PreparedPublicationStatus;
  readonly preparedAt: Date;
}
