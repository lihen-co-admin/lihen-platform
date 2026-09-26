import type { PublicationAttempt } from '../../domain/publication-attempt';
import {
  MarketingSocialEntityNotFoundError,
} from '../../domain/errors/marketing-social-governance-errors';
import {
  MarketingSocialPublicationNotApprovedError,
} from '../../domain/errors/marketing-social-orchestration-errors';
import {
  MarketingSocialPublicationAttemptNotPendingError,
} from '../../domain/errors/marketing-social-execution-errors';
import type {
  MarketingSocialRepository,
} from '../../ports/marketing-social-repository';
import type {
  SocialPublishingPort,
} from '../../ports/social-publishing-port';
import type {
  ExecutePublicationAttemptCommand,
} from './execute-publication-attempt.command';

export class ExecutePublicationAttemptHandler {
  public constructor(
    private readonly repository: MarketingSocialRepository,
    private readonly publisher: SocialPublishingPort,
  ) {}

  public async execute(
    command: ExecutePublicationAttemptCommand,
  ): Promise<PublicationAttempt> {
    const publication =
      await this.repository.getPreparedPublicationById(
        command.preparedPublicationId,
      );

    if (!publication) {
      throw new MarketingSocialEntityNotFoundError(
        'PreparedPublication',
        command.preparedPublicationId,
      );
    }

    if (publication.status !== 'APPROVED') {
      throw new MarketingSocialPublicationNotApprovedError(
        publication.id,
      );
    }

    const attempts =
      await this.repository
        .listPublicationAttemptsByPreparedPublicationId(
          publication.id,
        );

    const attempt = attempts.find(
      (candidate) => candidate.id === command.attemptId,
    );

    if (!attempt) {
      throw new MarketingSocialEntityNotFoundError(
        'PublicationAttempt',
        command.attemptId,
      );
    }

    if (attempt.status !== 'PENDING') {
      throw new MarketingSocialPublicationAttemptNotPendingError(
        attempt.id,
      );
    }

    await this.repository.startPublicationAttempt(
      {
        id: attempt.id,
      },
      { operationKey: command.startOperationKey },
    );

    const result = await this.publisher.publish({
      attemptId: attempt.id,
      preparedPublicationId: publication.id,
      channel: publication.channel,
      copy: publication.copy,
      callToAction: publication.callToAction,
      hashtags: publication.hashtags,
      creativeAssetIds: publication.creativeAssetIds,
    });

    if (result.outcome === 'SUCCEEDED') {
      return this.repository.completePublicationAttempt(
        {
          id: attempt.id,
          outcome: 'SUCCEEDED',
          externalPublicationRef:
            result.externalPublicationRef,
        },
        { operationKey: command.completionOperationKey },
      );
    }

    return this.repository.completePublicationAttempt(
      {
        id: attempt.id,
        outcome: 'FAILED',
        failureCode: result.failureCode,
      },
      { operationKey: command.completionOperationKey },
    );
  }
}
