export class MarketingSocialExternalPublicationBlockedError
extends Error {
  public constructor() {
    super(
      'External social publication is blocked by the active adapter.',
    );
    this.name =
      'MarketingSocialExternalPublicationBlockedError';
  }
}

export class MarketingSocialPublicationAttemptNotPendingError
extends Error {
  public constructor(attemptId: string) {
    super(
      `PublicationAttempt "${attemptId}" must be PENDING before execution starts.`,
    );
    this.name =
      'MarketingSocialPublicationAttemptNotPendingError';
  }
}

export class MarketingSocialPublicationAttemptNotInProgressError
extends Error {
  public constructor(attemptId: string) {
    super(
      `PublicationAttempt "${attemptId}" must be IN_PROGRESS before execution completes.`,
    );
    this.name =
      'MarketingSocialPublicationAttemptNotInProgressError';
  }
}
