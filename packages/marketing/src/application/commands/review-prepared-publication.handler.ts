import type {
  PreparedPublication,
  PreparedPublicationStatus,
} from '../../domain/prepared-publication';
import {
  MarketingSocialEntityNotFoundError,
  MarketingSocialInvalidTransitionError,
} from '../../domain/errors/marketing-social-governance-errors';
import type { MarketingSocialRepository } from '../../ports/marketing-social-repository';
import type {
  PreparedPublicationReviewDecision,
  ReviewPreparedPublicationCommand,
} from './review-prepared-publication.command';

const transitions: Readonly<
  Record<
    PreparedPublicationReviewDecision,
    Readonly<Partial<Record<PreparedPublicationStatus, PreparedPublicationStatus>>>
  >
> = {
  SUBMIT_FOR_REVIEW: {
    PREPARED: 'IN_REVIEW',
  },
  APPROVE: {
    IN_REVIEW: 'APPROVED',
  },
  CANCEL: {
    PREPARED: 'CANCELLED',
    IN_REVIEW: 'CANCELLED',
  },
};

export class ReviewPreparedPublicationHandler {
  public constructor(
    private readonly repository: MarketingSocialRepository,
  ) {}

  public async execute(
    command: ReviewPreparedPublicationCommand,
  ): Promise<PreparedPublication> {
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

    const nextStatus =
      transitions[command.decision][publication.status];

    if (!nextStatus) {
      throw new MarketingSocialInvalidTransitionError(
        'PreparedPublication',
        publication.status,
        command.decision,
      );
    }

    return this.repository.savePreparedPublication({
      ...publication,
      status: nextStatus,
    });
  }
}
