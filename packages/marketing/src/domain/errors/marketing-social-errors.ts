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
