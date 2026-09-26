import type { ContentSchedule } from '../domain/content-schedule';
import type { PreparedPublication } from '../domain/prepared-publication';
import type { PublicationAttempt } from '../domain/publication-attempt';
import {
  MarketingSocialOperationKeyRequiredError,
  MarketingSocialWriteOperationConflictError,
} from '../domain/errors/marketing-social-errors';
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

  private readonly publicationAttemptOperations =
    new Map<
      string,
      {
        readonly id: string;
        readonly preparedPublicationId: string;
      }
    >();

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

  public async createPendingPublicationAttempt(
    input: {
      readonly id: string;
      readonly preparedPublicationId: string;
    },
    context: MarketingSocialWriteContext,
  ): Promise<PublicationAttempt> {
    const operationKey = context.operationKey.trim();

    if (operationKey.length === 0) {
      throw new MarketingSocialOperationKeyRequiredError();
    }

    const existingOperation =
      this.publicationAttemptOperations.get(operationKey);

    if (existingOperation) {
      if (
        existingOperation.id !== input.id ||
        existingOperation.preparedPublicationId !==
          input.preparedPublicationId
      ) {
        throw new MarketingSocialWriteOperationConflictError();
      }

      const existingAttempt =
        this.publicationAttempts.get(existingOperation.id);

      if (!existingAttempt) {
        throw new MarketingSocialWriteOperationConflictError();
      }

      return existingAttempt;
    }

    const existingAttempts =
      await this.listPublicationAttemptsByPreparedPublicationId(
        input.preparedPublicationId,
      );

    const persistedAttempt: PublicationAttempt = {
      id: input.id,
      preparedPublicationId: input.preparedPublicationId,
      attemptNumber:
        existingAttempts.reduce(
          (maximum, existing) =>
            Math.max(maximum, existing.attemptNumber),
          0,
        ) + 1,
      status: 'PENDING',
      startedAt: null,
      completedAt: null,
      externalPublicationRef: null,
      failureCode: null,
    };

    this.publicationAttempts.set(
      persistedAttempt.id,
      persistedAttempt,
    );

    this.publicationAttemptOperations.set(
      operationKey,
      {
        id: input.id,
        preparedPublicationId: input.preparedPublicationId,
      },
    );

    return persistedAttempt;
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
