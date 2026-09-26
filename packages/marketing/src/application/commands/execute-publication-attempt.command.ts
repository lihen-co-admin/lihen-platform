export interface ExecutePublicationAttemptCommand {
  readonly preparedPublicationId: string;
  readonly attemptId: string;
  readonly startOperationKey: string;
  readonly completionOperationKey: string;
}
