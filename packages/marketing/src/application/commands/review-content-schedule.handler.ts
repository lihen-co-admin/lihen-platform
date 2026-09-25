import type {
  ContentSchedule,
  ContentScheduleStatus,
} from '../../domain/content-schedule';
import {
  MarketingSocialEntityNotFoundError,
  MarketingSocialInvalidTransitionError,
} from '../../domain/errors/marketing-social-governance-errors';
import type { MarketingSocialRepository } from '../../ports/marketing-social-repository';
import type {
  ContentScheduleReviewDecision,
  ReviewContentScheduleCommand,
} from './review-content-schedule.command';

const transitions: Readonly<
  Record<
    ContentScheduleReviewDecision,
    Readonly<Partial<Record<ContentScheduleStatus, ContentScheduleStatus>>>
  >
> = {
  SUBMIT_FOR_REVIEW: {
    DRAFT: 'READY_FOR_REVIEW',
  },
  APPROVE: {
    READY_FOR_REVIEW: 'APPROVED',
  },
  CANCEL: {
    DRAFT: 'CANCELLED',
    READY_FOR_REVIEW: 'CANCELLED',
  },
};

export class ReviewContentScheduleHandler {
  public constructor(
    private readonly repository: MarketingSocialRepository,
  ) {}

  public async execute(
    command: ReviewContentScheduleCommand,
  ): Promise<ContentSchedule> {
    const schedule = await this.repository.getContentScheduleById(
      command.scheduleId,
    );

    if (!schedule) {
      throw new MarketingSocialEntityNotFoundError(
        'ContentSchedule',
        command.scheduleId,
      );
    }

    const nextStatus = transitions[command.decision][schedule.status];

    if (!nextStatus) {
      throw new MarketingSocialInvalidTransitionError(
        'ContentSchedule',
        schedule.status,
        command.decision,
      );
    }

    return this.repository.saveContentSchedule(
      {
        ...schedule,
        status: nextStatus,
        updatedAt: new Date(),
      },
      { operationKey: command.operationKey },
    );
  }
}
