export interface Query<TPayload = unknown> {
  readonly queryId: string;
  readonly requestedAt: Date;
  readonly actorId?: string;
  readonly payload: TPayload;
}

export interface QueryHandler<TQuery extends Query, TResult> {
  handle(query: TQuery): Promise<TResult>;
}
