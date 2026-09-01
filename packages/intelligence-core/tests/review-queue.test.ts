import { describe, expect, it } from 'vitest';
import type {
  IntelligenceDecision,
  IntelligenceRecommendation,
} from '../src';
import {
  assertReviewItemDoesNotAuthorizeExecution,
  buildUnifiedHumanReviewQueue,
  reviewItemFromRecommendation,
  reviewItemFromReconciliation,
} from '../src';

function recommendation(
  id: string,
  priority: IntelligenceRecommendation['priority'] = 'P2',
): IntelligenceRecommendation {
  return {
    recommendationId: id,
    correlationId: `corr-${id}`,
    context: {
      contextId: `ctx-${id}`,
      type: 'PRODUCT',
      entityId: `product-${id}`,
      attributes: {},
    },
    actionType: 'PRODUCT.REVIEW',
    title: `Review ${id}`,
    explanation: 'Human review required.',
    priority,
    severity: 'WARNING',
    source: 'test',
    rationale: ['test'],
    evidenceIds: [`ev-${id}`],
    confidence: {
      score: 0.8,
      band: 'HIGH',
      rationale: ['test'],
    },
    risk: {
      level: 'R3',
      reasons: ['review'],
      requiresHumanReview: true,
    },
    status: 'PROPOSED',
    createdAt: '2026-09-01T00:00:00.000Z',
  };
}

function decision(
  id: string,
  value: IntelligenceDecision['decision'],
): IntelligenceDecision {
  return {
    decisionId: `decision-${id}`,
    correlationId: `corr-${id}`,
    recommendationId: id,
    decision: value,
    reason: 'Reviewed.',
    decidedBy: 'human-1',
    decidedAt: '2026-09-01T00:01:00.000Z',
  };
}

describe('GAP-010 Unified Human Review Queue', () => {
  it('projects Intelligence Recommendation + existing Human Decision', () => {
    const item = reviewItemFromRecommendation({
      recommendation: recommendation('1'),
      decision: decision('1', 'APPROVE'),
    });

    expect(item.sourceKind).toBe('INTELLIGENCE_RECOMMENDATION');
    expect(item.status).toBe('APPROVED');
    expect(item.existingDecision?.decisionId).toBe('decision-1');
    expect(item.reviewId).toBe('INTELLIGENCE_RECOMMENDATION:1');
  });

  it('fails closed when a decision points at another recommendation', () => {
    expect(() =>
      reviewItemFromRecommendation({
        recommendation: recommendation('1'),
        decision: decision('2', 'APPROVE'),
      }),
    ).toThrow('REVIEW_DECISION_RECOMMENDATION_MISMATCH');
  });

  it('preserves REPLACE decisions as REPLACED review state', () => {
    const item = reviewItemFromRecommendation({
      recommendation: recommendation('replace'),
      decision: decision('replace', 'REPLACE'),
    });

    expect(item.status).toBe('REPLACED');
    expect(item.existingDecision?.decision).toBe('REPLACE');
  });

  it('preserves P4 recommendations in the unified review priority model', () => {
    const item = reviewItemFromRecommendation({
      recommendation: recommendation('p4', 'P4'),
    });

    expect(item.priority).toBe('P4');
  });

  it('projects reconciliation as a source-owned review item', () => {
    const item = reviewItemFromReconciliation({
      resultId: 'result-1',
      correlationId: 'corr-recon-1',
      title: 'Resolve product identity',
      summary: 'Two candidates require human choice.',
      confidence: 0.55,
      reviewRequired: true,
      status: 'PENDING',
      createdAt: '2026-09-01T00:00:00.000Z',
    });

    expect(item.sourceKind).toBe('PRODUCT_RECONCILIATION');
    expect(item.priority).toBe('P1');
    expect(item.requiresHumanDecision).toBe(true);
  });

  it('unifies multiple sources without changing their source authority', () => {
    const queue = buildUnifiedHumanReviewQueue({
      recommendations: [
        { recommendation: recommendation('1', 'P2') },
      ],
      reconciliations: [
        {
          resultId: 'result-1',
          correlationId: 'corr-recon-1',
          title: 'Reconciliation',
          summary: 'Review result.',
          confidence: 0.5,
          reviewRequired: true,
          status: 'PENDING',
          createdAt: '2026-09-01T00:02:00.000Z',
        },
      ],
      otherSources: [
        {
          sourceKind: 'VISUAL_INTELLIGENCE',
          sourceRecordId: 'visual-1',
          correlationId: 'corr-visual-1',
          title: 'Visual candidate',
          summary: 'Image requires review.',
          priority: 'P0',
          riskLevel: 'R3',
          status: 'PENDING',
          requiresHumanDecision: true,
          createdAt: '2026-09-01T00:03:00.000Z',
        },
      ],
    });

    expect(queue.map((item) => item.sourceKind)).toEqual([
      'VISUAL_INTELLIGENCE',
      'PRODUCT_RECONCILIATION',
      'INTELLIGENCE_RECOMMENDATION',
    ]);
  });

  it('supports human-review filters', () => {
    const queue = buildUnifiedHumanReviewQueue({
      recommendations: [
        { recommendation: recommendation('1', 'P1') },
        {
          recommendation: {
            ...recommendation('2', 'P3'),
            risk: {
              level: 'R1',
              reasons: [],
              requiresHumanReview: false,
            },
          },
        },
      ],
      filter: {
        requiresHumanDecisionOnly: true,
        minimumPriority: 'P2',
      },
    });

    expect(queue).toHaveLength(1);
    expect(queue[0]?.sourceRecordId).toBe('1');
  });

  it('rejects duplicate review identities', () => {
    expect(() =>
      buildUnifiedHumanReviewQueue({
        recommendations: [
          { recommendation: recommendation('1') },
          { recommendation: recommendation('1') },
        ],
      }),
    ).toThrow('DUPLICATE_REVIEW_ID');
  });

  it('does not grant execution authority from a review item', () => {
    const item = reviewItemFromRecommendation({
      recommendation: recommendation('1'),
    });

    expect(assertReviewItemDoesNotAuthorizeExecution(item)).toBe(true);

    expect(() =>
      assertReviewItemDoesNotAuthorizeExecution({
        ...item,
        sourceMetadata: {
          ...item.sourceMetadata,
          execute: true,
        },
      }),
    ).toThrow('REVIEW_ITEM_EXECUTION_AUTHORITY_FORBIDDEN');
  });
});
