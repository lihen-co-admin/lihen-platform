import type { ContentSchedule } from '../domain/content-schedule';
import type { PreparedPublication } from '../domain/prepared-publication';
import type { PublicationAttempt } from '../domain/publication-attempt';
import type {
  MarketingSocialRepository,
  MarketingSocialWriteContext,
} from '../ports/marketing-social-repository';

export class InMemoryMarketingSocialRepository
implements MarketingSocialRepository {
  private readonly contentSchedules =
    new Map<string, ContentSchedule>();

  private readonly preparedPublications =
    new Map<string, PreparedPublication>();

  private readonly publicationAttempts =
    new Map<string, PublicationAttempt>();

  public async saveContentSchedule(
    schedule: ContentSchedule,
    _context: MarketingSocialWriteContext,
  ): Promise<ContentSchedule> {
    this.contentSchedules.set(schedule.id, schedule);
    return schedule;
  }

  public async getContentScheduleById(
    id: string,
  ): Promise<ContentSchedule | null> {
    return this.contentSchedules.get(id) ?? null;
  }

  public async listContentSchedulesByChannelVariantId(
    channelVariantId: string,
  ): Promise<readonly ContentSchedule[]> {
    return [...this.contentSchedules.values()]
      .filter(
        (schedule) =>
          schedule.channelVariantId === channelVariantId,
      );
  }

  public async savePreparedPublication(
    publication: PreparedPublication,
    _context: MarketingSocialWriteContext,
  ): Promise<PreparedPublication> {
    this.preparedPublications.set(
      publication.id,
      publication,
    );
    return publication;
  }

  public async getPreparedPublicationById(
    id: string,
  ): Promise<PreparedPublication | null> {
    return this.preparedPublications.get(id) ?? null;
  }

  public async listPreparedPublicationsByChannelVariantId(
    channelVariantId: string,
  ): Promise<readonly PreparedPublication[]> {
    return [...this.preparedPublications.values()]
      .filter(
        (publication) =>
          publication.channelVariantId === channelVariantId,
      );
  }

  public async savePublicationAttempt(
    attempt: PublicationAttempt,
  ): Promise<PublicationAttempt> {
    this.publicationAttempts.set(attempt.id, attempt);
    return attempt;
  }

  public async listPublicationAttemptsByPreparedPublicationId(
    preparedPublicationId: string,
  ): Promise<readonly PublicationAttempt[]> {
    return [...this.publicationAttempts.values()]
      .filter(
        (attempt) =>
          attempt.preparedPublicationId ===
          preparedPublicationId,
      )
      .sort(
        (left, right) =>
          left.attemptNumber - right.attemptNumber,
      );
  }
}
