export class MarketingSocialEntityNotFoundError extends Error {
  public constructor(entityType: string, entityId: string) {
    super(`${entityType} "${entityId}" was not found.`);
    this.name = 'MarketingSocialEntityNotFoundError';
  }
}

export class MarketingSocialInvalidTransitionError extends Error {
  public constructor(
    entityType: string,
    currentStatus: string,
    decision: string,
  ) {
    super(
      `${entityType} cannot apply decision "${decision}" from status "${currentStatus}".`,
    );
    this.name = 'MarketingSocialInvalidTransitionError';
  }
}
