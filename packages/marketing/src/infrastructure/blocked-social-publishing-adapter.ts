import {
  MarketingSocialExternalPublicationBlockedError,
} from '../domain/errors/marketing-social-execution-errors';
import type {
  SocialPublicationRequest,
  SocialPublicationResult,
  SocialPublishingPort,
} from '../ports/social-publishing-port';

export class BlockedSocialPublishingAdapter
implements SocialPublishingPort {
  public async publish(
    _request: SocialPublicationRequest,
  ): Promise<SocialPublicationResult> {
    throw new MarketingSocialExternalPublicationBlockedError();
  }
}
