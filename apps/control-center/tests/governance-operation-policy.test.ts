import { describe, expect, it } from 'vitest';
import {
  evaluateGovernanceOperationPolicy,
  governanceActionAllowed,
} from '../src/domain/governance-operation-policy';

describe('governance operation policy', () => {
  it('allows prepare, confirm and release review only when assurance is READY and the request is eligible', () => {
    const result = evaluateGovernanceOperationPolicy({ assuranceStatus: 'READY', releaseRequestEligible: true });
    expect(result.prepareAllowed).toBe(true);
    expect(result.confirmAllowed).toBe(true);
    expect(result.releaseRequestAllowed).toBe(true);
    expect(result.executeAllowed).toBe(false);
  });

  it('keeps prepare available for investigation under REVIEW but blocks confirm and release request', () => {
    const result = evaluateGovernanceOperationPolicy({ assuranceStatus: 'REVIEW', releaseRequestEligible: true });
    expect(result.prepareAllowed).toBe(true);
    expect(result.confirmAllowed).toBe(false);
    expect(result.releaseRequestAllowed).toBe(false);
    expect(result.reasons).toContain('ASSURANCE_REVIEW_REQUIRES_HUMAN_CHECK');
  });

  it('blocks control-plane mutation when assurance is BLOCKED', () => {
    const result = evaluateGovernanceOperationPolicy({ assuranceStatus: 'BLOCKED', releaseRequestEligible: true });
    expect(result.prepareAllowed).toBe(false);
    expect(result.confirmAllowed).toBe(false);
    expect(result.releaseRequestAllowed).toBe(false);
    expect(result.reasons).toContain('ASSURANCE_BLOCKED');
  });

  it('requires operation eligibility before release review can be requested', () => {
    const result = evaluateGovernanceOperationPolicy({ assuranceStatus: 'READY', releaseRequestEligible: false });
    expect(result.releaseRequestAllowed).toBe(false);
    expect(result.reasons).toContain('RELEASE_REQUEST_NOT_ELIGIBLE');
  });

  it('never exposes final execution through governance actions', () => {
    const result = evaluateGovernanceOperationPolicy({ assuranceStatus: 'READY', releaseRequestEligible: true });
    expect(governanceActionAllowed(result, 'PREPARE')).toBe(true);
    expect(governanceActionAllowed(result, 'CONFIRM')).toBe(true);
    expect(governanceActionAllowed(result, 'REQUEST_RELEASE')).toBe(true);
    expect(governanceActionAllowed(result, 'EXECUTE')).toBe(false);
    expect(result.executionMustRemainBlocked).toBe(true);
  });
});
