export class MarketingSocialPublicationNotApprovedError extends Error {
  public constructor(preparedPublicationId: string) {
    super(
      `PreparedPublication "${preparedPublicationId}" must be APPROVED before preparing a publication attempt.`,
    );
    this.name = 'MarketingSocialPublicationNotApprovedError';
  }
}

export class MarketingSocialPublicationScheduleRequiredError extends Error {
  public constructor(preparedPublicationId: string) {
    super(
      `PreparedPublication "${preparedPublicationId}" requires a ContentSchedule before preparing a publication attempt.`,
    );
    this.name = 'MarketingSocialPublicationScheduleRequiredError';
  }
}

export class MarketingSocialScheduleNotApprovedError extends Error {
  public constructor(scheduleId: string) {
    super(
      `ContentSchedule "${scheduleId}" must be APPROVED before preparing a publication attempt.`,
    );
    this.name = 'MarketingSocialScheduleNotApprovedError';
  }
}

export class MarketingSocialPublicationNotDueError extends Error {
  public constructor(scheduleId: string) {
    super(
      `ContentSchedule "${scheduleId}" is not due for publication yet.`,
    );
    this.name = 'MarketingSocialPublicationNotDueError';
  }
}
