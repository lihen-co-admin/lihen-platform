import { describe, expect, expectTypeOf, it } from 'vitest';

import type {
  Campaign,
  ContentSchedule,
  PreparedPublication,
  PublicationAttempt,
} from '../src';

describe('marketing social publication domain contracts', () => {
  it('ContentSchedule references a ChannelVariant and preserves schedule governance state', () => {
    const schedule: ContentSchedule = {
      id: 'schedule-1',
      channelVariantId: 'variant-1',
      scheduledFor: new Date('2026-10-01T15:00:00.000Z'),
      timezone: 'America/Bogota',
      status: 'APPROVED',
      createdAt: new Date('2026-09-24T20:00:00.000Z'),
      updatedAt: new Date('2026-09-24T20:00:00.000Z'),
    };

    expect(schedule.channelVariantId).toBe('variant-1');
    expect(schedule.scheduledFor).toBeInstanceOf(Date);
    expect(schedule.timezone.trim()).not.toBe('');
    expect(schedule.status).toBe('APPROVED');
  });

  it('CANCELLED schedule is a schedule state, not publication authorization', () => {
    const schedule: ContentSchedule = {
      id: 'schedule-2',
      channelVariantId: 'variant-2',
      scheduledFor: new Date('2026-10-02T15:00:00.000Z'),
      timezone: 'America/Bogota',
      status: 'CANCELLED',
      createdAt: new Date('2026-09-24T20:00:00.000Z'),
      updatedAt: new Date('2026-09-24T20:00:00.000Z'),
    };

    expect(schedule.status).toBe('CANCELLED');
    expect('publish' in schedule).toBe(false);
  });

  it('PreparedPublication preserves the frozen channel variant content', () => {
    const publication: PreparedPublication = {
      id: 'prepared-1',
      campaignId: 'campaign-1',
      campaignContentId: 'content-1',
      channelVariantId: 'variant-1',
      scheduleId: 'schedule-1',
      channel: 'INSTAGRAM_FEED',
      copy: 'Contenido preparado',
      callToAction: 'Conoce más',
      hashtags: ['#LIHEN', '#BeautyCare'],
      creativeAssetIds: ['asset-1', 'asset-2'],
      status: 'APPROVED',
      preparedAt: new Date('2026-09-24T21:00:00.000Z'),
    };

    expect(publication.channel).toBe('INSTAGRAM_FEED');
    expect(publication.copy).toBe('Contenido preparado');
    expect(publication.callToAction).toBe('Conoce más');
    expect(publication.hashtags).toEqual(['#LIHEN', '#BeautyCare']);
    expect(publication.creativeAssetIds).toEqual(['asset-1', 'asset-2']);
  });

  it('APPROVED PreparedPublication is not modeled as PUBLISHED and has no publish method', () => {
    const publication: PreparedPublication = {
      id: 'prepared-2',
      campaignId: 'campaign-1',
      campaignContentId: 'content-1',
      channelVariantId: 'variant-1',
      scheduleId: null,
      channel: 'TIKTOK',
      copy: 'Contenido listo para revisión gobernada',
      callToAction: 'Descubre más',
      hashtags: [],
      creativeAssetIds: [],
      status: 'APPROVED',
      preparedAt: new Date('2026-09-24T21:00:00.000Z'),
    };

    expect(publication.status).toBe('APPROVED');
    expect(publication.status).not.toBe('PUBLISHED');
    expect('publish' in publication).toBe(false);
  });

  it('PublicationAttempt belongs to a PreparedPublication and can preserve an external reference on success', () => {
    const attempt: PublicationAttempt = {
      id: 'attempt-1',
      preparedPublicationId: 'prepared-1',
      attemptNumber: 1,
      status: 'SUCCEEDED',
      startedAt: new Date('2026-10-01T15:00:00.000Z'),
      completedAt: new Date('2026-10-01T15:00:05.000Z'),
      externalPublicationRef: 'external-ref-1',
      failureCode: null,
    };

    expect(attempt.preparedPublicationId).toBe('prepared-1');
    expect(attempt.externalPublicationRef).toBe('external-ref-1');
  });

  it('FAILED PublicationAttempt preserves its failure code without changing CampaignStatus', () => {
    const campaign: Campaign = {
      id: 'campaign-1',
      name: 'Campaign',
      objective: 'AWARENESS',
      productIds: [],
      categoryIds: [],
      audienceDescription: 'Audience',
      status: 'SCHEDULED',
      startsAt: null,
      endsAt: null,
      createdAt: new Date('2026-09-24T20:00:00.000Z'),
      updatedAt: new Date('2026-09-24T20:00:00.000Z'),
    };

    const attempt: PublicationAttempt = {
      id: 'attempt-2',
      preparedPublicationId: 'prepared-1',
      attemptNumber: 1,
      status: 'FAILED',
      startedAt: new Date('2026-10-01T15:00:00.000Z'),
      completedAt: new Date('2026-10-01T15:00:05.000Z'),
      externalPublicationRef: null,
      failureCode: 'EXTERNAL_PUBLICATION_FAILED',
    };

    expect(attempt.failureCode).toBe('EXTERNAL_PUBLICATION_FAILED');
    expect(campaign.status).toBe('SCHEDULED');
    expectTypeOf(attempt.status).not.toEqualTypeOf<typeof campaign.status>();
  });

  it('keeps publication results independent per prepared channel publication', () => {
    const instagramAttempt: PublicationAttempt = {
      id: 'attempt-instagram',
      preparedPublicationId: 'prepared-instagram',
      attemptNumber: 1,
      status: 'SUCCEEDED',
      startedAt: null,
      completedAt: null,
      externalPublicationRef: 'instagram-ref',
      failureCode: null,
    };

    const tiktokAttempt: PublicationAttempt = {
      id: 'attempt-tiktok',
      preparedPublicationId: 'prepared-tiktok',
      attemptNumber: 1,
      status: 'FAILED',
      startedAt: null,
      completedAt: null,
      externalPublicationRef: null,
      failureCode: 'CHANNEL_FAILURE',
    };

    expect(instagramAttempt.status).toBe('SUCCEEDED');
    expect(tiktokAttempt.status).toBe('FAILED');
    expect(instagramAttempt.preparedPublicationId).not.toBe(
      tiktokAttempt.preparedPublicationId,
    );
  });
});
