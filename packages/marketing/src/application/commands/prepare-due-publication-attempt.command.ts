export interface PrepareDuePublicationAttemptCommand {
  readonly preparedPublicationId: string;
  readonly attemptId: string;
  readonly operationKey: string;
  readonly now: Date;
}
