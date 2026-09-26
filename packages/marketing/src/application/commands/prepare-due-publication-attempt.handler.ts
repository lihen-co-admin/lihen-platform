import type { PublicationAttempt } from '../../domain/publication-attempt';
import {
  MarketingSocialEntityNotFoundError,
} from '../../domain/errors/marketing-social-governance-errors';
import {
  MarketingSocialPublicationNotApprovedError,
  MarketingSocialPublicationNotDueError,
  MarketingSocialPublicationScheduleRequiredError,
  MarketingSocialScheduleNotApprovedError,
} from '../../domain/errors/marketing-social-orchestration-errors';
import type {
  MarketingSocialRepository,
} from '../../ports/marketing-social-repository';
import type {
  PrepareDuePublicationAttemptCommand,
} from './prepare-due-publication-attempt.command';

export class PrepareDuePublicationAttemptHandler {
  public constructor(
    private readonly repository: MarketingSocialRepository,
  ) {}

  public async execute(
    command: PrepareDuePublicationAttemptCommand,
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

    if (!publication.scheduleId) {
      throw new MarketingSocialPublicationScheduleRequiredError(
        publication.id,
      );
    }

    const schedule =
      await this.repository.getContentScheduleById(
        publication.scheduleId,
      );

    if (!schedule) {
      throw new MarketingSocialEntityNotFoundError(
        'ContentSchedule',
        publication.scheduleId,
      );
    }

    if (schedule.status !== 'APPROVED') {
      throw new MarketingSocialScheduleNotApprovedError(
        schedule.id,
      );
    }

    if (schedule.scheduledFor.getTime() > command.now.getTime()) {
      throw new MarketingSocialPublicationNotDueError(
        schedule.id,
      );
    }

    return this.repository.createPendingPublicationAttempt(
      {
        id: command.attemptId,
        preparedPublicationId: publication.id,
      },
      { operationKey: command.operationKey },
    );
  }
}
