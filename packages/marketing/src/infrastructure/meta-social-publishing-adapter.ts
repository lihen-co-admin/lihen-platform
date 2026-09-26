import type {
  SocialPublicationRequest,
  SocialPublicationResult,
  SocialPublishingPort,
} from '../ports/social-publishing-port';

export interface MetaPublishingAsset {
  readonly publicUrl: string;
  readonly mediaType: 'IMAGE' | 'VIDEO';
}

export interface MetaSocialPublishingConfig {
  readonly accessToken: string;
  readonly facebookPageId: string;
  readonly instagramAccountId: string;
  readonly graphApiVersion: string;
  readonly enabled: boolean;
}

export type MetaPublishingAssetResolver = (
  creativeAssetId: string,
) => Promise<MetaPublishingAsset | null>;

interface MetaGraphResponse {
  readonly id?: string;
  readonly error?: { readonly code?: number; readonly message?: string };
}

export class MetaSocialPublishingAdapter implements SocialPublishingPort {
  public constructor(
    private readonly config: MetaSocialPublishingConfig,
    private readonly resolveAsset: MetaPublishingAssetResolver,
    private readonly request: typeof fetch = fetch,
  ) {}

  public async publish(
    publication: SocialPublicationRequest,
  ): Promise<SocialPublicationResult> {
    if (!this.config.enabled) {
      return { outcome: 'FAILED', failureCode: 'META_PUBLICATION_DISABLED' };
    }

    if (publication.channel === 'FACEBOOK') {
      return this.publishFacebook(publication);
    }

    if (publication.channel.startsWith('INSTAGRAM_')) {
      return this.publishInstagram(publication);
    }

    return { outcome: 'FAILED', failureCode: 'META_CHANNEL_UNSUPPORTED' };
  }

  private async publishFacebook(
    publication: SocialPublicationRequest,
  ): Promise<SocialPublicationResult> {
    const asset = await this.firstAsset(publication);
    const message = this.caption(publication);
    const path = asset?.mediaType === 'IMAGE'
      ? `${this.config.facebookPageId}/photos`
      : `${this.config.facebookPageId}/feed`;
    const body = asset?.mediaType === 'IMAGE'
      ? { url: asset.publicUrl, caption: message }
      : { message };

    return this.post(path, body);
  }

  private async publishInstagram(
    publication: SocialPublicationRequest,
  ): Promise<SocialPublicationResult> {
    const asset = await this.firstAsset(publication);
    if (!asset) {
      return { outcome: 'FAILED', failureCode: 'META_ASSET_REQUIRED' };
    }

    const container: Record<string, string | boolean> = {
      caption: this.caption(publication),
    };

    if (publication.channel === 'INSTAGRAM_REEL') {
      if (asset.mediaType !== 'VIDEO') {
        return { outcome: 'FAILED', failureCode: 'META_REEL_VIDEO_REQUIRED' };
      }
      container.media_type = 'REELS';
      container.video_url = asset.publicUrl;
    } else if (publication.channel === 'INSTAGRAM_STORY') {
      container.media_type = 'STORIES';
      if (asset.mediaType === 'VIDEO') container.video_url = asset.publicUrl;
      else container.image_url = asset.publicUrl;
    } else if (asset.mediaType === 'IMAGE') {
      container.image_url = asset.publicUrl;
    } else {
      return { outcome: 'FAILED', failureCode: 'META_FEED_IMAGE_REQUIRED' };
    }

    const created = await this.postRaw(
      `${this.config.instagramAccountId}/media`,
      container,
    );
    if (!created.id) return this.failure(created, 'META_CONTAINER_CREATE_FAILED');

    const published = await this.postRaw(
      `${this.config.instagramAccountId}/media_publish`,
      { creation_id: created.id },
    );
    if (!published.id) return this.failure(published, 'META_MEDIA_PUBLISH_FAILED');

    return { outcome: 'SUCCEEDED', externalPublicationRef: published.id };
  }

  private async firstAsset(
    publication: SocialPublicationRequest,
  ): Promise<MetaPublishingAsset | null> {
    const id = publication.creativeAssetIds[0];
    return id ? this.resolveAsset(id) : null;
  }

  private caption(publication: SocialPublicationRequest): string {
    return [
      publication.copy.trim(),
      publication.callToAction.trim(),
      publication.hashtags.map((tag) => tag.startsWith('#') ? tag : `#${tag}`).join(' '),
    ].filter(Boolean).join('\n\n');
  }

  private async post(
    path: string,
    body: Record<string, string | boolean>,
  ): Promise<SocialPublicationResult> {
    const result = await this.postRaw(path, body);
    if (!result.id) return this.failure(result, 'META_PUBLICATION_FAILED');
    return { outcome: 'SUCCEEDED', externalPublicationRef: result.id };
  }

  private async postRaw(
    path: string,
    body: Record<string, string | boolean>,
  ): Promise<MetaGraphResponse> {
    const url = new URL(
      `https://graph.facebook.com/${this.config.graphApiVersion}/${path}`,
    );
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(body)) params.set(key, String(value));
    params.set('access_token', this.config.accessToken);

    const response = await this.request(url, { method: 'POST', body: params });
    const data = await response.json() as MetaGraphResponse;
    return data;
  }

  private failure(
    response: MetaGraphResponse,
    fallback: string,
  ): SocialPublicationResult {
    return {
      outcome: 'FAILED',
      failureCode: response.error?.code
        ? `META_${response.error.code}`
        : fallback,
    };
  }
}
