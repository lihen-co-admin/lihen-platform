import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ContentSchedule,
  ContentScheduleStatus,
} from '../domain/content-schedule';
import { MarketingSocialWriteBlockedError } from '../domain/errors/marketing-social-errors';
import type {
  PreparedPublication,
  PreparedPublicationStatus,
} from '../domain/prepared-publication';
import type {
  PublicationAttempt,
  PublicationAttemptStatus,
} from '../domain/publication-attempt';
import type { MarketingChannel } from '../domain/campaign';
import type { MarketingSocialRepository } from '../ports/marketing-social-repository';

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
  public constructor(private readonly client: SupabaseClient) {}

  public async saveContentSchedule(
    _schedule: ContentSchedule,
  ): Promise<ContentSchedule> {
    throw new MarketingSocialWriteBlockedError();
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
    _publication: PreparedPublication,
  ): Promise<PreparedPublication> {
    throw new MarketingSocialWriteBlockedError();
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

  public async savePublicationAttempt(
    _attempt: PublicationAttempt,
  ): Promise<PublicationAttempt> {
    throw new MarketingSocialWriteBlockedError();
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
