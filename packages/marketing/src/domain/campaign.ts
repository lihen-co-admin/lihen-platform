export const marketingChannels = [
  'INSTAGRAM_FEED',
  'INSTAGRAM_STORY',
  'INSTAGRAM_REEL',
  'FACEBOOK',
  'TIKTOK',
  'WHATSAPP_DIRECT',
  'WHATSAPP_STATUS',
  'WHATSAPP_COMMUNITY',
  'CATALOG',
  'PUBLIC_HUB',
  'WEB',
] as const;

export type MarketingChannel = (typeof marketingChannels)[number];

export const campaignStatuses = [
  'DRAFT',
  'PREPARED',
  'IN_REVIEW',
  'APPROVED',
  'SCHEDULED',
  'PUBLISHED',
  'ARCHIVED',
] as const;

export type CampaignStatus = (typeof campaignStatuses)[number];

export type MarketingObjective =
  | 'AWARENESS'
  | 'ENGAGEMENT'
  | 'CONVERSATION'
  | 'CATALOG_VISIT'
  | 'LEAD_GENERATION'
  | 'SALE'
  | 'RETENTION'
  | 'REACTIVATION';

export interface Campaign {
  readonly id: string;
  readonly name: string;
  readonly objective: MarketingObjective;
  readonly productIds: readonly string[];
  readonly categoryIds: readonly string[];
  readonly audienceDescription: string;
  readonly status: CampaignStatus;
  readonly startsAt: Date | null;
  readonly endsAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CampaignContent {
  readonly id: string;
  readonly campaignId: string;
  readonly concept: string;
  readonly coreMessage: string;
  readonly callToAction: string;
  readonly createdAt: Date;
}

export interface ChannelVariant {
  readonly id: string;
  readonly campaignContentId: string;
  readonly channel: MarketingChannel;
  readonly copy: string;
  readonly callToAction: string;
  readonly hashtags: readonly string[];
  readonly creativeAssetIds: readonly string[];
  readonly status: 'DRAFT' | 'READY_FOR_REVIEW' | 'APPROVED';
}
