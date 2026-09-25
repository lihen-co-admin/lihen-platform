export class MarketingSocialWriteBlockedError extends Error {
  public constructor() {
    super(
      'Marketing social persistence writes are blocked until the governed Supabase write path is explicitly authorized.',
    );
    this.name = 'MarketingSocialWriteBlockedError';
  }
}

export class MarketingSocialPersistenceUnavailableError extends Error {
  public constructor() {
    super(
      'Marketing social Supabase persistence is unavailable until its database schema is explicitly authorized.',
    );
    this.name = 'MarketingSocialPersistenceUnavailableError';
  }
}


export class MarketingSocialOperationKeyRequiredError extends Error {
  public constructor() {
    super('Marketing social controlled writes require a non-blank operation key.');
    this.name = 'MarketingSocialOperationKeyRequiredError';
  }
}

export class MarketingSocialWriteOperationConflictError extends Error {
  public constructor() {
    super('Marketing social operation key conflicts with an existing write.');
    this.name = 'MarketingSocialWriteOperationConflictError';
  }
}
