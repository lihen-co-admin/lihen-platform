import { describe, expect, it } from 'vitest';
import {
  blankDevActivationEvidence,
  evaluateDevActivationPreflight,
  type DevActivationEvidence,
} from '../src/domain/dev-activation-preflight';

const completeEvidence: DevActivationEvidence = {
  supabaseDevConfirmed: true,
  controlledModeExplicit: true,
  controlledRpcConfirmed: true,
  authorizationPolicyConfirmed: true,
  auditTraceConfirmed: true,
  idempotencyConfirmed: true,
  compensationPlanConfirmed: true,
  isolatedFixtureConfirmed: true,
  productionUntouchedConfirmed: true,
};

describe('evaluateDevActivationPreflight', () => {
  it('starts blocked when evidence has not been verified', () => {
    const result = evaluateDevActivationPreflight('INVENTORY', blankDevActivationEvidence());

    expect(result.readiness).toBe('EVIDENCE_INCOMPLETE');
    expect(result.mayEnableControlledMode).toBe(false);
    expect(result.missingEvidence).toHaveLength(9);
    expect(result.executionPlaneMustRemainHeld).toBe(true);
  });

  it('allows only a later DEV pilot after every evidence item is explicit', () => {
    const result = evaluateDevActivationPreflight('INVENTORY', completeEvidence);

    expect(result.readiness).toBe('READY_FOR_DEV_PILOT');
    expect(result.mayEnableControlledMode).toBe(true);
    expect(result.missingEvidence).toEqual([]);
    expect(result.executionPlaneMustRemainHeld).toBe(true);
  });

  it('does not treat controlled mode alone as sufficient evidence', () => {
    const result = evaluateDevActivationPreflight('SUPPLIERS', {
      ...blankDevActivationEvidence(),
      supabaseDevConfirmed: true,
      controlledModeExplicit: true,
      productionUntouchedConfirmed: true,
    });

    expect(result.readiness).toBe('EVIDENCE_INCOMPLETE');
    expect(result.mayEnableControlledMode).toBe(false);
    expect(result.missingEvidence).toContain('controlledRpcConfirmed');
    expect(result.missingEvidence).toContain('idempotencyConfirmed');
    expect(result.missingEvidence).toContain('compensationPlanConfirmed');
  });

  it.each(['OPERATION_DISPATCH', 'CANARY', 'FINAL_RELEASE', 'PRODUCTION'] as const)(
    'keeps %s outside the controlled domain pilot',
    (capability) => {
      const result = evaluateDevActivationPreflight(capability, completeEvidence);

      expect(result.readiness).toBe('NOT_A_PILOT_TARGET');
      expect(result.mayEnableControlledMode).toBe(false);
      expect(result.executionPlaneMustRemainHeld).toBe(true);
    },
  );
});
