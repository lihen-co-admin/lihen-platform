import { describe, expect, it } from 'vitest';
import { evaluateGovernanceReadiness, type GovernanceReadinessInput } from '../src/domain/governance-readiness';

const readyInput: GovernanceReadinessInput = {
  integrityIssueCount: 0,
  operationCount: 14,
  executionEnabledCount: 0,
  executionReleaseHeld: true,
  dispatchHeld: true,
  canarySimulationSafe: true,
  canaryGuardBlocksAll: true,
  releaseGuardBlocksAll: true,
  phase64Status: 'PASS',
  phase66Status: 'PASS',
  phase75Status: 'PASS',
  phase84Status: 'PASS',
  phase87Status: 'PASS',
};

describe('governance readiness', () => {
  it('reports READY only while every execution path stays blocked and governance gates pass', () => {
    const result = evaluateGovernanceReadiness(readyInput);
    expect(result.status).toBe('READY');
    expect(result.blockers).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.executionMustRemainBlocked).toBe(true);
  });

  it('blocks when any catalog operation exposes execution', () => {
    const result = evaluateGovernanceReadiness({ ...readyInput, executionEnabledCount: 1 });
    expect(result.status).toBe('BLOCKED');
    expect(result.blockers).toContain('CATALOG_EXECUTION_ENABLED');
  });

  it('blocks when dispatch or final release guard stops holding', () => {
    const result = evaluateGovernanceReadiness({ ...readyInput, dispatchHeld: false, releaseGuardBlocksAll: false });
    expect(result.status).toBe('BLOCKED');
    expect(result.blockers).toContain('DISPATCH_NOT_HELD');
    expect(result.blockers).toContain('RELEASE_GUARD_NOT_BLOCKING');
  });

  it('reports REVIEW when execution is still protected but a governance phase is not PASS', () => {
    const result = evaluateGovernanceReadiness({ ...readyInput, phase87Status: 'REVIEW' });
    expect(result.status).toBe('REVIEW');
    expect(result.blockers).toEqual([]);
    expect(result.warnings).toContain('PHASE_87_NOT_PASS');
  });

  it('reports REVIEW when governance evidence is incomplete without inventing readiness', () => {
    const result = evaluateGovernanceReadiness({ ...readyInput, operationCount: 0, phase84Status: null });
    expect(result.status).toBe('REVIEW');
    expect(result.warnings).toContain('GOVERNANCE_EVIDENCE_INCOMPLETE');
  });
});
