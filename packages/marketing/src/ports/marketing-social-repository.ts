import type { ContentSchedule } from '../domain/content-schedule';
import type { PreparedPublication } from '../domain/prepared-publication';
import type { PublicationAttempt } from '../domain/publication-attempt';

export interface MarketingSocialRepository {
  saveContentSchedule(
    schedule: ContentSchedule,
  ): Promise<ContentSchedule>;

  getContentScheduleById(
    id: string,
  ): Promise<ContentSchedule | null>;

  listContentSchedulesByChannelVariantId(
    channelVariantId: string,
  ): Promise<readonly ContentSchedule[]>;

  savePreparedPublication(
    publication: PreparedPublication,
  ): Promise<PreparedPublication>;

  getPreparedPublicationById(
    id: string,
  ): Promise<PreparedPublication | null>;

  listPreparedPublicationsByChannelVariantId(
    channelVariantId: string,
  ): Promise<readonly PreparedPublication[]>;

  savePublicationAttempt(
    attempt: PublicationAttempt,
  ): Promise<PublicationAttempt>;

  listPublicationAttemptsByPreparedPublicationId(
    preparedPublicationId: string,
  ): Promise<readonly PublicationAttempt[]>;
}
