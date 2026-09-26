import type { ContentSchedule } from '../domain/content-schedule';
import type { PreparedPublication } from '../domain/prepared-publication';
import type { PublicationAttempt } from '../domain/publication-attempt';

export interface MarketingSocialWriteContext {
  readonly operationKey: string;
}

export interface MarketingSocialRepository {
  saveContentSchedule(
    schedule: ContentSchedule,
    context: MarketingSocialWriteContext,
  ): Promise<ContentSchedule>;

  getContentScheduleById(
    id: string,
  ): Promise<ContentSchedule | null>;

  listContentSchedulesByChannelVariantId(
    channelVariantId: string,
  ): Promise<readonly ContentSchedule[]>;

  savePreparedPublication(
    publication: PreparedPublication,
    context: MarketingSocialWriteContext,
  ): Promise<PreparedPublication>;

  getPreparedPublicationById(
    id: string,
  ): Promise<PreparedPublication | null>;

  listPreparedPublicationsByChannelVariantId(
    channelVariantId: string,
  ): Promise<readonly PreparedPublication[]>;

  createPendingPublicationAttempt(
    input: {
      readonly id: string;
      readonly preparedPublicationId: string;
    },
    context: MarketingSocialWriteContext,
  ): Promise<PublicationAttempt>;

  listPublicationAttemptsByPreparedPublicationId(
    preparedPublicationId: string,
  ): Promise<readonly PublicationAttempt[]>;
}
