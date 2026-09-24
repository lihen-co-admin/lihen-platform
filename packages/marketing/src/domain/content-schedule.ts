export const contentScheduleStatuses = [
  'DRAFT',
  'READY_FOR_REVIEW',
  'APPROVED',
  'CANCELLED',
] as const;

export type ContentScheduleStatus =
  (typeof contentScheduleStatuses)[number];

export interface ContentSchedule {
  readonly id: string;
  readonly channelVariantId: string;
  readonly scheduledFor: Date;
  readonly timezone: string;
  readonly status: ContentScheduleStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
