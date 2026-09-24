export const publicationAttemptStatuses = [
  'PENDING',
  'IN_PROGRESS',
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
] as const;

export type PublicationAttemptStatus =
  (typeof publicationAttemptStatuses)[number];

export interface PublicationAttempt {
  readonly id: string;
  readonly preparedPublicationId: string;
  readonly attemptNumber: number;
  readonly status: PublicationAttemptStatus;
  readonly startedAt: Date | null;
  readonly completedAt: Date | null;
  readonly externalPublicationRef: string | null;
  readonly failureCode: string | null;
}
