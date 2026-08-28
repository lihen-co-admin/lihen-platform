import { describe, expect, it } from 'vitest';
import { evaluateDashboardFocusGuidance } from '../src/domain/dashboard-focus-guidance';
import type { DashboardOperationalHealth } from '../src/domain/dashboard-operational-health';

function health(
  overrides: Partial<DashboardOperationalHealth> = {},
): DashboardOperationalHealth {
  return {
    status: 'STABLE',
    nextFocus: 'MONITOR',
    workQueueTotal: 0,
    humanDecisionQueue: 0,
    blockers: [],
    attentionItems: [],
    explanation: 'Operación estable.',
    ...overrides,
  };
}

describe('evaluateDashboardFocusGuidance', () => {
  it('maps integrity focus to the existing governance surface', () => {
    const result = evaluateDashboardFocusGuidance(
      health({
        status: 'BLOCKED',
        nextFocus: 'INTEGRITY',
        blockers: ['Dashboard metric integrity BLOCKED'],
      }),
    );

    expect(result.tone).toBe('CRITICAL');
    expect(result.targetRoute).toBe('/operations');
    expect(result.actionLabel).toBe('Revisar integridad');
  });

  it('keeps Intelligence assurance as an in-dashboard review when no dedicated route exists', () => {
    const result = evaluateDashboardFocusGuidance(
      health({
        status: 'ATTENTION',
        nextFocus: 'INTELLIGENCE_ASSURANCE',
        attentionItems: ['Intelligence assurance requiere revisión'],
      }),
    );

    expect(result.targetRoute).toBeUndefined();
    expect(result.actionLabel).toBeUndefined();
  });

  it('maps human decision to governance controls without executing anything', () => {
    const result = evaluateDashboardFocusGuidance(
      health({
        status: 'ATTENTION',
        nextFocus: 'HUMAN_DECISION',
        attentionItems: ['2 recomendaciones listas para decisión humana'],
      }),
    );

    expect(result.targetRoute).toBe('/operations');
    expect(result.navigationOnly).toBe(true);
    expect(result.mayMutateDomain).toBe(false);
  });

  it('maps ordinary operational focus to existing pages', () => {
    expect(
      evaluateDashboardFocusGuidance(health({ status: 'ATTENTION', nextFocus: 'ORDERS' }))
        .targetRoute,
    ).toBe('/orders');
    expect(
      evaluateDashboardFocusGuidance(health({ status: 'ATTENTION', nextFocus: 'PURCHASES' }))
        .targetRoute,
    ).toBe('/purchases');
    expect(
      evaluateDashboardFocusGuidance(health({ status: 'ATTENTION', nextFocus: 'INVENTORY' }))
        .targetRoute,
    ).toBe('/inventory');
  });

  it('keeps MONITOR stable and without a synthetic action', () => {
    const result = evaluateDashboardFocusGuidance(health());

    expect(result.tone).toBe('SUCCESS');
    expect(result.targetRoute).toBeUndefined();
    expect(result.actionLabel).toBeUndefined();
  });

  it('uses blockers before attention items in its explanation', () => {
    const result = evaluateDashboardFocusGuidance(
      health({
        status: 'BLOCKED',
        nextFocus: 'INTEGRITY',
        blockers: ['bloqueo canónico'],
        attentionItems: ['cola secundaria'],
      }),
    );

    expect(result.explanation).toContain('bloqueo canónico');
    expect(result.explanation).not.toContain('cola secundaria');
  });
});
