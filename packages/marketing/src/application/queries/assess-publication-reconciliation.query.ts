export interface AssessPublicationReconciliationQuery {
  readonly preparedPublicationId: string;
  readonly now: Date;
  readonly uncertaintyWindowMs: number;
}
