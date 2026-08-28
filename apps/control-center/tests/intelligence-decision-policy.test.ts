import { describe, expect, it } from 'vitest';
import {
  evaluateIntelligenceDecisionPolicy,
  summarizeIntelligenceDecisionPolicy,
} from '../src/domain/intelligence-decision-policy';
import type { LihenIntelligenceRecommendation } from '../src/domain/dashboard-intelligence';

function recommendation(
  overrides: Partial<LihenIntelligenceRecommendation> = {},
): LihenIntelligenceRecommendation {
  return {
    id: 'inventory-review',
    priority: 'P2',
    score: 70,
    severity: 'WARNING',
    title: 'Revisar inventario',
    explanation: 'Hay señales que requieren revisión.',
    actionLabel: 'Abrir inventario',
    targetRoute: '/inventory',
    source: 'inventario canónico',
    rationale: ['existen movimientos pendientes de revisión'],
    ...overrides,
  };
}

describe('evaluateIntelligenceDecisionPolicy', () => {
  it('marks actionable recommendations as APPROVABLE only with PASS assurance', () => {
    const result = evaluateIntelligenceDecisionPolicy({
      assuranceStatus: 'PASS',
      recommendation: recommendation(),
    });

    expect(result.state).toBe('APPROVABLE');
    expect(result.mayRequestHumanDecision).toBe(true);
    expect(result.mayExecuteAutomatically).toBe(false);
  });

  it('keeps informational recommendations in OBSERVE', () => {
    const result = evaluateIntelligenceDecisionPolicy({
      assuranceStatus: 'PASS',
      recommendation: recommendation({
        actionLabel: undefined,
        targetRoute: undefined,
      }),
    });

    expect(result.state).toBe('OBSERVE');
    expect(result.mayRequestHumanDecision).toBe(false);
  });

  it('downgrades recommendations to REVIEW when assurance needs review', () => {
    const result = evaluateIntelligenceDecisionPolicy({
      assuranceStatus: 'REVIEW',
      recommendation: recommendation(),
    });

    expect(result.state).toBe('REVIEW');
    expect(result.mayOpenSuggestedRoute).toBe(true);
    expect(result.mayRequestHumanDecision).toBe(false);
  });

  it('blocks decision handoff when assurance is BLOCKED', () => {
    const result = evaluateIntelligenceDecisionPolicy({
      assuranceStatus: 'BLOCKED',
      recommendation: recommendation(),
    });

    expect(result.state).toBe('BLOCKED');
    expect(result.mayOpenSuggestedRoute).toBe(false);
  });

  it('never allows automatic execution', () => {
    const states = ['PASS', 'REVIEW', 'BLOCKED'] as const;

    for (const assuranceStatus of states) {
      const result = evaluateIntelligenceDecisionPolicy({
        assuranceStatus,
        recommendation: recommendation(),
      });

      expect(result.mayExecuteAutomatically).toBe(false);
    }
  });

  it('summarizes the human-decision handoff without creating commands', () => {
    const summary = summarizeIntelligenceDecisionPolicy('PASS', [
      recommendation(),
      recommendation({
        id: 'execution-held',
        actionLabel: undefined,
        targetRoute: undefined,
      }),
    ]);

    expect(summary.approvableCount).toBe(1);
    expect(summary.observeCount).toBe(1);
    expect(summary.executionMustRemainManual).toBe(true);
  });
});
