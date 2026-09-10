import type { MarketingChannel } from '../../domain/campaign';

export interface MarketingPerformanceMetric {
  readonly impressions: number;
  readonly reach: number;
  readonly views: number;
  readonly likes: number;
  readonly comments: number;
  readonly shares: number;
  readonly saves: number;
  readonly clicks: number;
  readonly conversations: number;
  readonly leads: number;
  readonly catalogVisits: number;
  readonly attributedSales: number;
}

export interface CampaignChannelPerformance {
  readonly campaignId: string;
  readonly channel: MarketingChannel;
  readonly metric: MarketingPerformanceMetric;
}

export interface MarketingPerformanceReadModel {
  readonly campaignId: string;
  readonly channels: readonly CampaignChannelPerformance[];
  readonly totalEngagement: number;
  readonly totalConversions: number;
  readonly engagementRate: number | null;
}

export function buildMarketingPerformanceReadModel(
  campaignId: string,
  channels: readonly CampaignChannelPerformance[],
): MarketingPerformanceReadModel {
  const scoped = channels.filter(
    (item) => item.campaignId === campaignId,
  );

  const totalReach = scoped.reduce(
    (sum, item) => sum + item.metric.reach,
    0,
  );

  const totalEngagement = scoped.reduce(
    (sum, item) =>
      sum +
      item.metric.likes +
      item.metric.comments +
      item.metric.shares +
      item.metric.saves,
    0,
  );

  const totalConversions = scoped.reduce(
    (sum, item) =>
      sum +
      item.metric.conversations +
      item.metric.leads +
      item.metric.attributedSales,
    0,
  );

  return {
    campaignId,
    channels: scoped,
    totalEngagement,
    totalConversions,
    engagementRate:
      totalReach === 0
        ? null
        : totalEngagement / totalReach,
  };
}
