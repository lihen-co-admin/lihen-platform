export const preparedPublicationReviewDecisions = [
  'SUBMIT_FOR_REVIEW',
  'APPROVE',
  'CANCEL',
] as const;

export type PreparedPublicationReviewDecision =
  (typeof preparedPublicationReviewDecisions)[number];

export interface ReviewPreparedPublicationCommand {
  readonly preparedPublicationId: string;
  readonly decision: PreparedPublicationReviewDecision;
}
