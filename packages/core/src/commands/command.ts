export interface Command<TPayload = unknown> {
  readonly commandId: string;
  readonly actorId: string;
  readonly requestedAt: Date;
  readonly operationKey?: string;
  readonly payload: TPayload;
}

export interface CommandHandler<TCommand extends Command, TResult> {
  handle(command: TCommand): Promise<TResult>;
}
