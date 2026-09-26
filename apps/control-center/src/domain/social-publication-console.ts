import type {
  ContentSchedule,
  PreparedPublication,
  PublicationAttempt,
} from '@lihen/marketing';

export interface SocialPublicationConsoleSnapshot {
  readonly schedules: readonly ContentSchedule[];
  readonly publications: readonly PreparedPublication[];
  readonly attempts: readonly PublicationAttempt[];
}

export interface SocialPublicationConsoleSummary {
  readonly scheduled: number;
  readonly approvedSchedules: number;
  readonly prepared: number;
  readonly approvedPublications: number;
  readonly pendingAttempts: number;
  readonly inProgressAttempts: number;
  readonly succeededAttempts: number;
  readonly failedAttempts: number;
}

export function summarizeSocialPublicationConsole(
  snapshot: SocialPublicationConsoleSnapshot,
): SocialPublicationConsoleSummary {
  return {
    scheduled: snapshot.schedules.length,
    approvedSchedules: snapshot.schedules.filter(
      (item) => item.status === 'APPROVED',
    ).length,
    prepared: snapshot.publications.length,
    approvedPublications: snapshot.publications.filter(
      (item) => item.status === 'APPROVED',
    ).length,
    pendingAttempts: snapshot.attempts.filter(
      (item) => item.status === 'PENDING',
    ).length,
    inProgressAttempts: snapshot.attempts.filter(
      (item) => item.status === 'IN_PROGRESS',
    ).length,
    succeededAttempts: snapshot.attempts.filter(
      (item) => item.status === 'SUCCEEDED',
    ).length,
    failedAttempts: snapshot.attempts.filter(
      (item) => item.status === 'FAILED',
    ).length,
  };
}

export function isSimulationAttempt(
  attempt: PublicationAttempt,
): boolean {
  return (
    attempt.status === 'SUCCEEDED' &&
    attempt.externalPublicationRef === 'local-test-publication'
  );
}
