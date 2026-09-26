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

  private readonly publicationAttemptStartOperations =
    new Map<
      string,
      {
        readonly id: string;
      }
    >();

  private readonly publicationAttemptCompletionOperations =
    new Map<
      string,
      {
        readonly id: string;
        readonly outcome: 'SUCCEEDED' | 'FAILED';
        readonly resultValue: string;
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

  public async startPublicationAttempt(
    input: {
      readonly id: string;
    },
    context: MarketingSocialWriteContext,
  ): Promise<PublicationAttempt> {
    const operationKey = context.operationKey.trim();

    if (operationKey.length === 0) {
      throw new MarketingSocialOperationKeyRequiredError();
    }

    const existingOperation =
      this.publicationAttemptStartOperations.get(operationKey);

    if (existingOperation) {
      if (
        existingOperation.id !== input.id
      ) {
        throw new MarketingSocialWriteOperationConflictError();
      }

      const replayed = this.publicationAttempts.get(input.id);

      if (
        !replayed ||
        (
          replayed.status !== 'IN_PROGRESS' &&
          replayed.status !== 'SUCCEEDED' &&
          replayed.status !== 'FAILED'
        )
      ) {
        throw new MarketingSocialWriteOperationConflictError();
      }

      return replayed;
    }

    const attempt = this.publicationAttempts.get(input.id);

    if (!attempt || attempt.status !== 'PENDING') {
      throw new MarketingSocialWriteOperationConflictError();
    }

    const started: PublicationAttempt = {
      ...attempt,
      status: 'IN_PROGRESS',
      startedAt: new Date(),
    };

    this.publicationAttempts.set(started.id, started);

    this.publicationAttemptStartOperations.set(
      operationKey,
      {
        id: input.id,
      },
    );

    return started;
  }

  public async completePublicationAttempt(
    input:
      | {
          readonly id: string;
          readonly outcome: 'SUCCEEDED';
          readonly externalPublicationRef: string;
        }
      | {
          readonly id: string;
          readonly outcome: 'FAILED';
          readonly failureCode: string;
        },
    context: MarketingSocialWriteContext,
  ): Promise<PublicationAttempt> {
    const operationKey = context.operationKey.trim();

    if (operationKey.length === 0) {
      throw new MarketingSocialOperationKeyRequiredError();
    }

    const resultValue =
      input.outcome === 'SUCCEEDED'
        ? input.externalPublicationRef
        : input.failureCode;

    const existingOperation =
      this.publicationAttemptCompletionOperations.get(
        operationKey,
      );

    if (existingOperation) {
      if (
        existingOperation.id !== input.id ||
        existingOperation.outcome !== input.outcome ||
        existingOperation.resultValue !== resultValue
      ) {
        throw new MarketingSocialWriteOperationConflictError();
      }

      const replayed = this.publicationAttempts.get(input.id);

      if (
        !replayed ||
        replayed.status !== input.outcome
      ) {
        throw new MarketingSocialWriteOperationConflictError();
      }

      return replayed;
    }

    const attempt = this.publicationAttempts.get(input.id);

    if (!attempt || attempt.status !== 'IN_PROGRESS') {
      throw new MarketingSocialWriteOperationConflictError();
    }

    const completed: PublicationAttempt =
      input.outcome === 'SUCCEEDED'
        ? {
            ...attempt,
            status: 'SUCCEEDED',
            completedAt: new Date(),
            externalPublicationRef:
              input.externalPublicationRef,
            failureCode: null,
          }
        : {
            ...attempt,
            status: 'FAILED',
            completedAt: new Date(),
            externalPublicationRef: null,
            failureCode: input.failureCode,
          };

    this.publicationAttempts.set(completed.id, completed);

    this.publicationAttemptCompletionOperations.set(
      operationKey,
      {
        id: input.id,
        outcome: input.outcome,
        resultValue,
      },
    );

    return completed;
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
