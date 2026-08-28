import { describe, expect, it } from 'vitest';
import { evaluateOperationalActivationReadiness } from '../src/domain/operational-activation-readiness';

describe('evaluateOperationalActivationReadiness', () => {
  it('keeps final execution, canary, dispatch and production protected', () => {
    const result = evaluateOperationalActivationReadiness();

    expect(result.productionMustRemainUntouched).toBe(true);
    expect(result.finalExecutionMustRemainBlocked).toBe(true);
    expect(result.canaryMustRemainDisabled).toBe(true);
    expect(result.dispatchMustRemainHeld).toBe(true);
  });

  it('classifies controlled domain writes as DEV capable without enabling them', () => {
    const result = evaluateOperationalActivationReadiness();
    const ids = result.capabilities
      .filter((item) => item.state === 'DEV_CONTROLLED_CAPABLE')
      .map((item) => item.id);

    expect(ids).toContain('product-master-writes');
    expect(ids).toContain('inventory-supply-commerce-finance-writes');
  });

  it('classifies governance control-plane flows as prepared but held', () => {
    const result = evaluateOperationalActivationReadiness();

    expect(
      result.capabilities.find((item) => item.id === 'operation-intent-preview-confirm')?.state,
    ).toBe('PREPARED_BUT_HELD');
    expect(result.capabilities.find((item) => item.id === 'dispatch')?.state).toBe(
      'PREPARED_BUT_HELD',
    );
    expect(result.capabilities.find((item) => item.id === 'canary')?.state).toBe(
      'PREPARED_BUT_HELD',
    );
  });

  it('does not classify final execution or production as activatable', () => {
    const result = evaluateOperationalActivationReadiness();

    expect(result.capabilities.find((item) => item.id === 'final-release-execution')?.state).toBe(
      'NOT_ACTIVATABLE',
    );
    expect(result.capabilities.find((item) => item.id === 'production')?.state).toBe(
      'NOT_ACTIVATABLE',
    );
  });
});
