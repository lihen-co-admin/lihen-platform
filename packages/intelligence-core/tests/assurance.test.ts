import { describe, expect, it } from 'vitest';
import { evaluateRecommendationAssurance } from '../src';

describe('LIHEN Intelligence Assurance — GAP-005', () => {
  it('passes a coherent recommendation set with an execution guard', () => {
    const result = evaluateRecommendationAssurance([
      {
        id: 'recommendation-1',
        source: 'product intelligence',
        rationale: ['Exact product identity verified'],
        actionLabel: 'Review',
        targetRoute: '/products/1',
        executionGuard: false,
      },
      {
        id: 'governance-hold',
        source: 'governance policy',
        rationale: ['Execution remains controlled'],
        executionGuard: true,
      },
    ]);

    expect(result.status).toBe('PASS');
    expect(result.issueCount).toBe(0);
  });

  it('blocks duplicate recommendation ids', () => {
    const result = evaluateRecommendationAssurance([
      {
        id: 'duplicate',
        source: 'source-a',
        rationale: ['reason-a'],
        executionGuard: true,
      },
      {
        id: 'duplicate',
        source: 'source-b',
        rationale: ['reason-b'],
        executionGuard: false,
      },
    ]);

    expect(result.status).toBe('BLOCKED');
    expect(result.issues.some((issue) => issue.code === 'DUPLICATE_RECOMMENDATION_ID')).toBe(true);
  });

  it('blocks missing source and incomplete rationale', () => {
    const result = evaluateRecommendationAssurance([
      {
        id: 'invalid',
        source: '   ',
        rationale: [''],
        executionGuard: true,
      },
    ]);

    expect(result.status).toBe('BLOCKED');
    expect(result.criticalIssueCount).toBe(2);
  });

  it('returns REVIEW for action/route mismatch without inventing a critical block', () => {
    const result = evaluateRecommendationAssurance([
      {
        id: 'route-warning',
        source: 'catalog intelligence',
        rationale: ['Candidate requires review'],
        actionLabel: 'Open',
        executionGuard: true,
      },
    ]);

    expect(result.status).toBe('REVIEW');
    expect(result.warningIssueCount).toBe(1);
    expect(result.criticalIssueCount).toBe(0);
  });

  it('blocks a non-empty set when execution guard is required but absent', () => {
    const result = evaluateRecommendationAssurance([
      {
        id: 'recommendation-without-guard',
        source: 'analytics',
        rationale: ['Insight only'],
        executionGuard: false,
      },
    ]);

    expect(result.status).toBe('BLOCKED');
    expect(result.issues.some((issue) => issue.code === 'EXECUTION_GUARD_MISSING')).toBe(true);
  });

  it('keeps an empty set as REVIEW, preserving the legacy semantic', () => {
    const result = evaluateRecommendationAssurance([]);

    expect(result.status).toBe('REVIEW');
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]?.code).toBe('RECOMMENDATION_SET_EMPTY');
  });

  it('can disable the execution-guard check for assurance contexts that do not produce executable recommendations', () => {
    const result = evaluateRecommendationAssurance([
      {
        id: 'report-only',
        source: 'document intelligence',
        rationale: ['Report generation does not expose an executable action'],
        executionGuard: false,
      },
    ], {
      requireExecutionGuard: false,
    });

    expect(result.status).toBe('PASS');
  });

  it('does not require the legacy execution-held id', () => {
    const result = evaluateRecommendationAssurance([
      {
        id: 'future-social-governance-hold',
        source: 'future social policy',
        rationale: ['Publishing remains governed'],
        executionGuard: true,
      },
    ]);

    expect(result.status).toBe('PASS');
  });
});
