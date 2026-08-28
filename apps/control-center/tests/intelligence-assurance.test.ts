import { describe, expect, it } from 'vitest';
import { evaluateIntelligenceAssurance } from '../src/domain/intelligence-assurance';
import type { LihenIntelligenceRecommendation } from '../src/domain/dashboard-intelligence';

function recommendation(
  overrides: Partial<LihenIntelligenceRecommendation> = {},
): LihenIntelligenceRecommendation {
  return {
    id: 'execution-held',
    priority: 'P4',
    severity: 'INFO',
    title: 'Ejecución protegida',
    explanation: 'La ejecución sigue bajo aprobación humana.',
    actionLabel: 'Ver controles',
    targetRoute: '/operations',
    source: 'política de ejecución',
    rationale: ['Intelligence opera en modo READ ONLY'],
    ...overrides,
  };
}

describe('evaluateIntelligenceAssurance', () => {
  it('returns PASS for coherent and traceable recommendations', () => {
    const result = evaluateIntelligenceAssurance([
      recommendation(),
      recommendation({
        id: 'orders-open',
        priority: 'P3',
        title: 'Pedidos abiertos',
        source: 'pedidos canónicos',
        rationale: ['10 pedidos abiertos'],
      }),
    ]);

    expect(result.status).toBe('PASS');
    expect(result.issueCount).toBe(0);
  });

  it('does not duplicate the producer priority policy with score thresholds', () => {
    const result = evaluateIntelligenceAssurance([
      recommendation({ priority: 'P1' }),
    ]);

    expect(result.status).toBe('PASS');
    expect(result.issues.map((issue) => issue.code)).not.toContain('PRIORITY_SCORE_MISMATCH');
  });

  it('blocks duplicated recommendation ids', () => {
    const result = evaluateIntelligenceAssurance([
      recommendation(),
      recommendation(),
    ]);

    expect(result.status).toBe('BLOCKED');
    expect(result.issues.some((issue) => issue.code === 'DUPLICATE_RECOMMENDATION_ID')).toBe(true);
  });

  it('blocks missing provenance or rationale', () => {
    const result = evaluateIntelligenceAssurance([
      recommendation({ source: '', rationale: [] }),
    ]);

    expect(result.status).toBe('BLOCKED');
    expect(result.criticalIssueCount).toBe(2);
  });

  it('returns REVIEW when action label and route are not paired', () => {
    const result = evaluateIntelligenceAssurance([
      recommendation({ targetRoute: undefined }),
    ]);

    expect(result.status).toBe('REVIEW');
    expect(result.issues.some((issue) => issue.code === 'ACTION_ROUTE_MISMATCH')).toBe(true);
  });

  it('blocks when the execution-held safeguard is absent', () => {
    const result = evaluateIntelligenceAssurance([
      recommendation({ id: 'inventory-review' }),
    ]);

    expect(result.status).toBe('BLOCKED');
    expect(result.issues.some((issue) => issue.code === 'EXECUTION_GUARD_MISSING')).toBe(true);
  });
});
