import type { GovernanceReadinessStatus } from './governance-readiness';

export type GovernanceControlAction = 'PREPARE' | 'CONFIRM' | 'REQUEST_RELEASE' | 'EXECUTE';

export type GovernanceOperationPolicyReason =
  | 'ASSURANCE_BLOCKED'
  | 'ASSURANCE_REVIEW_REQUIRES_HUMAN_CHECK'
  | 'RELEASE_REQUEST_NOT_ELIGIBLE'
  | 'FINAL_EXECUTION_OUT_OF_SCOPE';

export interface GovernanceOperationPolicyInput {
  readonly assuranceStatus: GovernanceReadinessStatus;
  readonly releaseRequestEligible: boolean;
}

export interface GovernanceOperationPolicyResult {
  readonly prepareAllowed: boolean;
  readonly confirmAllowed: boolean;
  readonly releaseRequestAllowed: boolean;
  readonly executeAllowed: false;
  readonly reasons: readonly GovernanceOperationPolicyReason[];
  readonly executionMustRemainBlocked: true;
}

export function evaluateGovernanceOperationPolicy(
  input: GovernanceOperationPolicyInput,
): GovernanceOperationPolicyResult {
  const reasons: GovernanceOperationPolicyReason[] = [];

  if (input.assuranceStatus === 'BLOCKED') {
    reasons.push('ASSURANCE_BLOCKED');
  }

  if (input.assuranceStatus === 'REVIEW') {
    reasons.push('ASSURANCE_REVIEW_REQUIRES_HUMAN_CHECK');
  }

  if (!input.releaseRequestEligible) {
    reasons.push('RELEASE_REQUEST_NOT_ELIGIBLE');
  }

  reasons.push('FINAL_EXECUTION_OUT_OF_SCOPE');

  const prepareAllowed = input.assuranceStatus !== 'BLOCKED';
  const confirmAllowed = input.assuranceStatus === 'READY';
  const releaseRequestAllowed = input.assuranceStatus === 'READY' && input.releaseRequestEligible;

  return {
    prepareAllowed,
    confirmAllowed,
    releaseRequestAllowed,
    executeAllowed: false,
    reasons,
    executionMustRemainBlocked: true,
  };
}

export function governanceActionAllowed(
  policy: GovernanceOperationPolicyResult,
  action: GovernanceControlAction,
): boolean {
  if (action === 'PREPARE') return policy.prepareAllowed;
  if (action === 'CONFIRM') return policy.confirmAllowed;
  if (action === 'REQUEST_RELEASE') return policy.releaseRequestAllowed;
  return false;
}
