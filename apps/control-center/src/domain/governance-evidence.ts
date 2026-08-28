import type { GovernanceReadinessStatus } from './governance-readiness';

export type GovernanceEvidenceStatus = 'READY' | 'REVIEW' | 'BLOCKED';

export type GovernanceEvidenceIssueCode =
  | 'GOVERNANCE_AUDIT_EMPTY'
  | 'OPERATION_TIMELINE_EMPTY'
  | 'GOVERNANCE_AUDIT_STALE'
  | 'OPERATION_TIMELINE_STALE'
  | 'GOVERNANCE_EVENT_MALFORMED'
  | 'OPERATION_EVENT_MALFORMED'
  | 'GOVERNANCE_EVENT_FUTURE_DATED'
  | 'OPERATION_EVENT_FUTURE_DATED';

export interface GovernanceEvidenceEvent {
  readonly id: string;
  readonly operationCode: string;
  readonly actorId: string;
  readonly status: string;
  readonly correlationKey: string;
  readonly occurredAt: Date;
}

export interface OperationEvidenceEvent {
  readonly domainCode: string;
  readonly operationType: string;
  readonly operationKey: string;
  readonly actorId: string;
  readonly occurredAt: Date;
}

export interface GovernanceEvidenceInput {
  readonly governanceAudit: readonly GovernanceEvidenceEvent[];
  readonly operationTimeline: readonly OperationEvidenceEvent[];
  readonly now: Date;
  readonly freshnessWindowHours?: number;
}

export interface GovernanceEvidenceResult {
  readonly status: GovernanceEvidenceStatus;
  readonly blockers: readonly GovernanceEvidenceIssueCode[];
  readonly warnings: readonly GovernanceEvidenceIssueCode[];
  readonly governanceAuditCount: number;
  readonly operationTimelineCount: number;
  readonly latestGovernanceEventAt: Date | null;
  readonly latestOperationEventAt: Date | null;
  readonly freshnessWindowHours: number;
}

export interface GovernanceAssuranceResult {
  readonly status: GovernanceReadinessStatus;
  readonly readinessStatus: GovernanceReadinessStatus;
  readonly evidenceStatus: GovernanceEvidenceStatus;
  readonly executionMustRemainBlocked: true;
}

const DEFAULT_FRESHNESS_WINDOW_HOURS = 72;
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

function latestDate(events: readonly { readonly occurredAt: Date }[]): Date | null {
  const validTimes = events
    .map((event) => event.occurredAt.getTime())
    .filter((time) => Number.isFinite(time));
  if (validTimes.length === 0) return null;
  return new Date(Math.max(...validTimes));
}

function isStale(value: Date | null, now: Date, freshnessWindowHours: number): boolean {
  if (!value) return false;
  return now.getTime() - value.getTime() > freshnessWindowHours * 60 * 60 * 1000;
}

export function evaluateGovernanceEvidence(input: GovernanceEvidenceInput): GovernanceEvidenceResult {
  const blockers: GovernanceEvidenceIssueCode[] = [];
  const warnings: GovernanceEvidenceIssueCode[] = [];
  const freshnessWindowHours = input.freshnessWindowHours ?? DEFAULT_FRESHNESS_WINDOW_HOURS;

  if (input.governanceAudit.length === 0) warnings.push('GOVERNANCE_AUDIT_EMPTY');
  if (input.operationTimeline.length === 0) warnings.push('OPERATION_TIMELINE_EMPTY');

  const malformedGovernance = input.governanceAudit.some((event) =>
    !event.id.trim()
    || !event.operationCode.trim()
    || !event.actorId.trim()
    || !event.status.trim()
    || !event.correlationKey.trim()
    || !Number.isFinite(event.occurredAt.getTime()),
  );
  if (malformedGovernance) blockers.push('GOVERNANCE_EVENT_MALFORMED');

  const malformedOperation = input.operationTimeline.some((event) =>
    !event.domainCode.trim()
    || !event.operationType.trim()
    || !event.operationKey.trim()
    || !event.actorId.trim()
    || !Number.isFinite(event.occurredAt.getTime()),
  );
  if (malformedOperation) blockers.push('OPERATION_EVENT_MALFORMED');

  const nowMs = input.now.getTime();
  if (input.governanceAudit.some((event) => event.occurredAt.getTime() > nowMs + FUTURE_TOLERANCE_MS)) {
    blockers.push('GOVERNANCE_EVENT_FUTURE_DATED');
  }
  if (input.operationTimeline.some((event) => event.occurredAt.getTime() > nowMs + FUTURE_TOLERANCE_MS)) {
    blockers.push('OPERATION_EVENT_FUTURE_DATED');
  }

  const latestGovernanceEventAt = latestDate(input.governanceAudit);
  const latestOperationEventAt = latestDate(input.operationTimeline);
  if (isStale(latestGovernanceEventAt, input.now, freshnessWindowHours)) warnings.push('GOVERNANCE_AUDIT_STALE');
  if (isStale(latestOperationEventAt, input.now, freshnessWindowHours)) warnings.push('OPERATION_TIMELINE_STALE');

  return {
    status: blockers.length > 0 ? 'BLOCKED' : warnings.length > 0 ? 'REVIEW' : 'READY',
    blockers,
    warnings,
    governanceAuditCount: input.governanceAudit.length,
    operationTimelineCount: input.operationTimeline.length,
    latestGovernanceEventAt,
    latestOperationEventAt,
    freshnessWindowHours,
  };
}

export function evaluateGovernanceAssurance(
  readinessStatus: GovernanceReadinessStatus,
  evidenceStatus: GovernanceEvidenceStatus,
): GovernanceAssuranceResult {
  const status: GovernanceReadinessStatus = readinessStatus === 'BLOCKED' || evidenceStatus === 'BLOCKED'
    ? 'BLOCKED'
    : readinessStatus === 'REVIEW' || evidenceStatus === 'REVIEW'
      ? 'REVIEW'
      : 'READY';

  return {
    status,
    readinessStatus,
    evidenceStatus,
    executionMustRemainBlocked: true,
  };
}
