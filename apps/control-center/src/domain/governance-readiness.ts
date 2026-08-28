export type GovernanceReadinessStatus = 'READY' | 'REVIEW' | 'BLOCKED';

export type GovernanceReadinessIssueCode =
  | 'INTEGRITY_ISSUES_PRESENT'
  | 'CATALOG_EXECUTION_ENABLED'
  | 'EXECUTION_RELEASE_NOT_HELD'
  | 'DISPATCH_NOT_HELD'
  | 'CANARY_SIMULATION_UNSAFE'
  | 'CANARY_GUARD_NOT_BLOCKING'
  | 'RELEASE_GUARD_NOT_BLOCKING'
  | 'PHASE_64_NOT_PASS'
  | 'PHASE_66_NOT_PASS'
  | 'PHASE_75_NOT_PASS'
  | 'PHASE_84_NOT_PASS'
  | 'PHASE_87_NOT_PASS'
  | 'GOVERNANCE_EVIDENCE_INCOMPLETE';

export interface GovernanceReadinessInput {
  readonly integrityIssueCount: number;
  readonly operationCount: number;
  readonly executionEnabledCount: number;
  readonly executionReleaseHeld: boolean;
  readonly dispatchHeld: boolean;
  readonly canarySimulationSafe: boolean;
  readonly canaryGuardBlocksAll: boolean;
  readonly releaseGuardBlocksAll: boolean;
  readonly phase64Status: string | null;
  readonly phase66Status: string | null;
  readonly phase75Status: string | null;
  readonly phase84Status: string | null;
  readonly phase87Status: string | null;
}

export interface GovernanceReadinessResult {
  readonly status: GovernanceReadinessStatus;
  readonly blockers: readonly GovernanceReadinessIssueCode[];
  readonly warnings: readonly GovernanceReadinessIssueCode[];
  readonly checkedSignals: number;
  readonly passingSignals: number;
  readonly executionMustRemainBlocked: true;
}

const REQUIRED_PHASE_STATUSES = ['phase64Status', 'phase66Status', 'phase75Status', 'phase84Status', 'phase87Status'] as const;

export function evaluateGovernanceReadiness(input: GovernanceReadinessInput): GovernanceReadinessResult {
  const blockers: GovernanceReadinessIssueCode[] = [];
  const warnings: GovernanceReadinessIssueCode[] = [];

  if (input.integrityIssueCount > 0) blockers.push('INTEGRITY_ISSUES_PRESENT');
  if (input.executionEnabledCount > 0) blockers.push('CATALOG_EXECUTION_ENABLED');
  if (!input.executionReleaseHeld) blockers.push('EXECUTION_RELEASE_NOT_HELD');
  if (!input.dispatchHeld) blockers.push('DISPATCH_NOT_HELD');
  if (!input.canarySimulationSafe) blockers.push('CANARY_SIMULATION_UNSAFE');
  if (!input.canaryGuardBlocksAll) blockers.push('CANARY_GUARD_NOT_BLOCKING');
  if (!input.releaseGuardBlocksAll) blockers.push('RELEASE_GUARD_NOT_BLOCKING');

  const evidenceIncomplete = input.operationCount <= 0 || REQUIRED_PHASE_STATUSES.some((key) => input[key] === null);
  if (evidenceIncomplete) warnings.push('GOVERNANCE_EVIDENCE_INCOMPLETE');

  if (input.phase64Status !== null && input.phase64Status !== 'PASS') warnings.push('PHASE_64_NOT_PASS');
  if (input.phase66Status !== null && input.phase66Status !== 'PASS') warnings.push('PHASE_66_NOT_PASS');
  if (input.phase75Status !== null && input.phase75Status !== 'PASS') warnings.push('PHASE_75_NOT_PASS');
  if (input.phase84Status !== null && input.phase84Status !== 'PASS') warnings.push('PHASE_84_NOT_PASS');
  if (input.phase87Status !== null && input.phase87Status !== 'PASS') warnings.push('PHASE_87_NOT_PASS');

  const checkedSignals = 12;
  const passingSignals = checkedSignals - blockers.length - warnings.length;

  return {
    status: blockers.length > 0 ? 'BLOCKED' : warnings.length > 0 ? 'REVIEW' : 'READY',
    blockers,
    warnings,
    checkedSignals,
    passingSignals: Math.max(0, passingSignals),
    executionMustRemainBlocked: true,
  };
}
