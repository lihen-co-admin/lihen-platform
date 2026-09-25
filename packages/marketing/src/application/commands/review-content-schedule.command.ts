export const contentScheduleReviewDecisions = [
  'SUBMIT_FOR_REVIEW',
  'APPROVE',
  'CANCEL',
] as const;

export type ContentScheduleReviewDecision =
  (typeof contentScheduleReviewDecisions)[number];

export interface ReviewContentScheduleCommand {
  readonly scheduleId: string;
  readonly decision: ContentScheduleReviewDecision;
}
