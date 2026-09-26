import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ContentSchedule,
  ContentScheduleStatus,
} from '../domain/content-schedule';
import {
  MarketingSocialOperationKeyRequiredError,
  MarketingSocialWriteBlockedError,
  MarketingSocialWriteOperationConflictError,
} from '../domain/errors/marketing-social-errors';
import type {
  PreparedPublication,
  PreparedPublicationStatus,
} from '../domain/prepared-publication';
import type {
  PublicationAttempt,
  PublicationAttemptStatus,
} from '../domain/publication-attempt';
import type { MarketingChannel } from '../domain/campaign';
import type {
  MarketingSocialRepository,
  MarketingSocialWriteContext,
} from '../ports/marketing-social-repository';

interface ContentScheduleRow {
  id: string;
  channel_variant_id: string;
  scheduled_for: string;
  timezone: string;
  status: ContentScheduleStatus;
  created_at: string;
  updated_at: string;
}

interface PreparedPublicationRow {
  id: string;
  campaign_id: string;
  campaign_content_id: string;
  channel_variant_id: string;
  schedule_id: string | null;
  channel: MarketingChannel;
  copy: string;
  cta: string | null;
  hashtags: string[];
  creative_asset_ids: string[];
  status: PreparedPublicationStatus;
  prepared_at: string;
}

interface PublicationAttemptRow {
  id: string;
  prepared_publication_id: string;
  attempt_number: number;
  status: PublicationAttemptStatus;
  started_at: string | null;
  completed_at: string | null;
  external_publication_ref: string | null;
  failure_code: string | null;
}

function mapContentSchedule(row: ContentScheduleRow): ContentSchedule {
  return {
    id: row.id,
    channelVariantId: row.channel_variant_id,
    scheduledFor: new Date(row.scheduled_for),
    timezone: row.timezone,
    status: row.status,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapPreparedPublication(
  row: PreparedPublicationRow,
): PreparedPublication {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    campaignContentId: row.campaign_content_id,
    channelVariantId: row.channel_variant_id,
    scheduleId: row.schedule_id,
    channel: row.channel,
    copy: row.copy,
    callToAction: row.cta ?? '',
    hashtags: row.hashtags,
    creativeAssetIds: row.creative_asset_ids,
    status: row.status,
    preparedAt: new Date(row.prepared_at),
  };
}

function mapPublicationAttempt(
  row: PublicationAttemptRow,
): PublicationAttempt {
  return {
    id: row.id,
    preparedPublicationId: row.prepared_publication_id,
    attemptNumber: row.attempt_number,
    status: row.status,
    startedAt: row.started_at === null ? null : new Date(row.started_at),
    completedAt:
      row.completed_at === null ? null : new Date(row.completed_at),
    externalPublicationRef: row.external_publication_ref,
    failureCode: row.failure_code,
  };
}

export class SupabaseMarketingSocialRepository
  implements MarketingSocialRepository
{
  public constructor(
    private readonly client: SupabaseClient,
    private readonly controlledWriteEnabled = false,
  ) {}

  public async saveContentSchedule(
    schedule: ContentSchedule,
    context: MarketingSocialWriteContext,
  ): Promise<ContentSchedule> {
    if (!this.controlledWriteEnabled) {
      throw new MarketingSocialWriteBlockedError();
    }

    if (context.operationKey.trim().length === 0) {
      throw new MarketingSocialOperationKeyRequiredError();
    }

    const { data, error } = await this.client.rpc(
      'save_marketing_content_schedule_controlled',
      {
        p_operation_key: context.operationKey.trim(),
        p_id: schedule.id,
        p_channel_variant_id: schedule.channelVariantId,
        p_scheduled_for: schedule.scheduledFor.toISOString(),
        p_timezone: schedule.timezone,
        p_status: schedule.status,
        p_created_at: schedule.createdAt.toISOString(),
        p_updated_at: schedule.updatedAt.toISOString(),
      },
    );

    if (error) {
      if (error.message?.includes(
        'LIHEN_MARKETING_SOCIAL_WRITE_OPERATION_CONFLICT',
      )) {
        throw new MarketingSocialWriteOperationConflictError();
      }
      throw error;
    }

    const row = Array.isArray(data) ? data[0] : data;
    return mapContentSchedule(row as ContentScheduleRow);
  }

  public async getContentScheduleById(
    id: string,
  ): Promise<ContentSchedule | null> {
    const { data, error } = await this.client
      .from('marketing_content_schedules')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data === null
      ? null
      : mapContentSchedule(data as ContentScheduleRow);
  }

  public async listContentSchedulesByChannelVariantId(
    channelVariantId: string,
  ): Promise<readonly ContentSchedule[]> {
    const { data, error } = await this.client
      .from('marketing_content_schedules')
      .select('*')
      .eq('channel_variant_id', channelVariantId)
      .order('scheduled_for', { ascending: true });

    if (error) {
      throw error;
    }

    return ((data ?? []) as ContentScheduleRow[]).map(mapContentSchedule);
  }

  public async savePreparedPublication(
    publication: PreparedPublication,
    context: MarketingSocialWriteContext,
  ): Promise<PreparedPublication> {
    if (!this.controlledWriteEnabled) {
      throw new MarketingSocialWriteBlockedError();
    }

    if (context.operationKey.trim().length === 0) {
      throw new MarketingSocialOperationKeyRequiredError();
    }

    const { data, error } = await this.client.rpc(
      'save_marketing_prepared_publication_controlled',
      {
        p_operation_key: context.operationKey.trim(),
        p_id: publication.id,
        p_campaign_id: publication.campaignId,
        p_campaign_content_id: publication.campaignContentId,
        p_channel_variant_id: publication.channelVariantId,
        p_schedule_id: publication.scheduleId,
        p_channel: publication.channel,
        p_copy: publication.copy,
        p_cta: publication.callToAction || null,
        p_hashtags: [...publication.hashtags],
        p_creative_asset_ids: [...publication.creativeAssetIds],
        p_status: publication.status,
        p_prepared_at: publication.preparedAt.toISOString(),
      },
    );

    if (error) {
      if (error.message?.includes(
        'LIHEN_MARKETING_SOCIAL_WRITE_OPERATION_CONFLICT',
      )) {
        throw new MarketingSocialWriteOperationConflictError();
      }
      throw error;
    }

    const row = Array.isArray(data) ? data[0] : data;
    return mapPreparedPublication(row as PreparedPublicationRow);
  }

  public async getPreparedPublicationById(
    id: string,
  ): Promise<PreparedPublication | null> {
    const { data, error } = await this.client
      .from('marketing_prepared_publications')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data === null
      ? null
      : mapPreparedPublication(data as PreparedPublicationRow);
  }

  public async listPreparedPublicationsByChannelVariantId(
    channelVariantId: string,
  ): Promise<readonly PreparedPublication[]> {
    const { data, error } = await this.client
      .from('marketing_prepared_publications')
      .select('*')
      .eq('channel_variant_id', channelVariantId)
      .order('prepared_at', { ascending: true });

    if (error) {
      throw error;
    }

    return ((data ?? []) as PreparedPublicationRow[]).map(
      mapPreparedPublication,
    );
  }

  public async createPendingPublicationAttempt(
    input: {
      readonly id: string;
      readonly preparedPublicationId: string;
    },
    context: MarketingSocialWriteContext,
  ): Promise<PublicationAttempt> {
    if (!this.controlledWriteEnabled) {
      throw new MarketingSocialWriteBlockedError();
    }

    const operationKey = context.operationKey.trim();

    if (operationKey.length === 0) {
      throw new MarketingSocialOperationKeyRequiredError();
    }

    const { data, error } = await this.client.rpc(
      'create_marketing_publication_attempt_controlled',
      {
        p_operation_key: operationKey,
        p_id: input.id,
        p_prepared_publication_id:
          input.preparedPublicationId,
      },
    );

    if (error) {
      if (
        error.message?.includes(
          'LIHEN_MARKETING_SOCIAL_WRITE_OPERATION_CONFLICT',
        )
      ) {
        throw new MarketingSocialWriteOperationConflictError();
      }

      throw error;
    }

    const row = Array.isArray(data) ? data[0] : data;

    return mapPublicationAttempt(
      row as PublicationAttemptRow,
    );
  }

  public async listPublicationAttemptsByPreparedPublicationId(
    preparedPublicationId: string,
  ): Promise<readonly PublicationAttempt[]> {
    const { data, error } = await this.client
      .from('marketing_publication_attempts')
      .select('*')
      .eq('prepared_publication_id', preparedPublicationId)
      .order('attempt_number', { ascending: true });

    if (error) {
      throw error;
    }

    return ((data ?? []) as PublicationAttemptRow[]).map(
      mapPublicationAttempt,
    );
  }
}
