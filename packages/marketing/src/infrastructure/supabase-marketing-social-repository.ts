import type { SupabaseClient } from '@supabase/supabase-js';
import type { ContentSchedule } from '../domain/content-schedule';
import {
  MarketingSocialPersistenceUnavailableError,
  MarketingSocialWriteBlockedError,
} from '../domain/errors/marketing-social-errors';
import type { PreparedPublication } from '../domain/prepared-publication';
import type { PublicationAttempt } from '../domain/publication-attempt';
import type { MarketingSocialRepository } from '../ports/marketing-social-repository';

export class SupabaseMarketingSocialRepository
  implements MarketingSocialRepository
{
  public constructor(private readonly client: SupabaseClient) {
    void this.client;
  }

  public async saveContentSchedule(
    _schedule: ContentSchedule,
  ): Promise<ContentSchedule> {
    throw new MarketingSocialWriteBlockedError();
  }

  public async getContentScheduleById(
    _id: string,
  ): Promise<ContentSchedule | null> {
    throw new MarketingSocialPersistenceUnavailableError();
  }

  public async listContentSchedulesByChannelVariantId(
    _channelVariantId: string,
  ): Promise<readonly ContentSchedule[]> {
    throw new MarketingSocialPersistenceUnavailableError();
  }

  public async savePreparedPublication(
    _publication: PreparedPublication,
  ): Promise<PreparedPublication> {
    throw new MarketingSocialWriteBlockedError();
  }

  public async getPreparedPublicationById(
    _id: string,
  ): Promise<PreparedPublication | null> {
    throw new MarketingSocialPersistenceUnavailableError();
  }

  public async listPreparedPublicationsByChannelVariantId(
    _channelVariantId: string,
  ): Promise<readonly PreparedPublication[]> {
    throw new MarketingSocialPersistenceUnavailableError();
  }

  public async savePublicationAttempt(
    _attempt: PublicationAttempt,
  ): Promise<PublicationAttempt> {
    throw new MarketingSocialWriteBlockedError();
  }

  public async listPublicationAttemptsByPreparedPublicationId(
    _preparedPublicationId: string,
  ): Promise<readonly PublicationAttempt[]> {
    throw new MarketingSocialPersistenceUnavailableError();
  }
}
