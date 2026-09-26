import type { MarketingChannel } from '../domain/campaign';

export interface SocialPublicationRequest {
  readonly attemptId: string;
  readonly preparedPublicationId: string;
  readonly channel: MarketingChannel;
  readonly copy: string;
  readonly callToAction: string;
  readonly hashtags: readonly string[];
  readonly creativeAssetIds: readonly string[];
}

export type SocialPublicationResult =
  | {
      readonly outcome: 'SUCCEEDED';
      readonly externalPublicationRef: string;
    }
  | {
      readonly outcome: 'FAILED';
      readonly failureCode: string;
    };

export interface SocialPublishingPort {
  publish(
    request: SocialPublicationRequest,
  ): Promise<SocialPublicationResult>;
}
