import type {
  SocialPublicationRequest,
  SocialPublicationResult,
  SocialPublishingPort,
} from '../ports/social-publishing-port';

export class InMemorySocialPublishingAdapter
implements SocialPublishingPort {
  public readonly requests: SocialPublicationRequest[] = [];

  public constructor(
    private readonly result: SocialPublicationResult = {
      outcome: 'SUCCEEDED',
      externalPublicationRef: 'local-test-publication',
    },
  ) {}

  public async publish(
    request: SocialPublicationRequest,
  ): Promise<SocialPublicationResult> {
    this.requests.push(request);
    return this.result;
  }
}
