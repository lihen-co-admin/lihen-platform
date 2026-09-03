import { describe, expect, it } from 'vitest';
import {
  buildUnifiedHumanReviewQueue,
  evidenceFromPersistedReconciliation,
  prepareProductReconciliation,
} from '../src';

const context = {
  contextId: 'supplier-doc-1',
  type: 'SUPPLIER' as const,
  entityId: 'supplier-1',
  attributes: {},
};

const baseSource = {
  sourceRecordId: 'source-record-1',
  sourceRowKey: 'page-1-row-1',
  productName: 'Producto demo',
  supplierReference: 'REF-01',
  businessLine: 'BEAUTY_CARE' as const,
  extractionConfidence: 0.91,
  evidenceIds: ['evidence:document:1'],
};

function prepare(
  matches: Parameters<typeof prepareProductReconciliation>[0]['matches'],
) {
  return prepareProductReconciliation({
    resultId: 'result-1',
    correlationId: 'corr-1',
    context,
    sourceRecord: baseSource,
    matches,
    createdAt: '2026-09-03T20:00:00.000Z',
  });
}

describe('GAP-020 Product Reconciliation Engine', () => {
  it('treats an exact candidate as evidence/proposal, never mutation authority', () => {
    const result = prepare([
      {
        productId: 'product-1',
        matchKind: 'EXACT',
        confidence: 0.99,
        reasons: ['Exact supplier reference and canonical identity.'],
      },
    ]);

    expect(result.classification).toBe('EXACT_MATCH');
    expect(result.proposedProductId).toBe('product-1');
    expect(result.canAutoAssignProductId).toBe(false);
    expect(result.canAutoCreateProductMaster).toBe(false);
    expect(result.requiresHumanReview).toBe(true);
    expect(result.recommendation.risk.level).toBe('R3');
    expect(result.reviewCandidate.reviewRequired).toBe(true);
  });

  it('never autoassigns product_id for fuzzy matching', () => {
    const result = prepare([
      {
        productId: 'product-fuzzy',
        matchKind: 'FUZZY',
        confidence: 0.86,
        reasons: ['Similar name and reference fragment.'],
      },
    ]);

    expect(result.classification).toBe('POSSIBLE_MATCH');
    expect(result.proposedProductId).toBe('product-fuzzy');
    expect(result.canAutoAssignProductId).toBe(false);
    expect(result.reviewCandidate.sourceMetadata).toMatchObject({
      canAutoAssignProductId: false,
      decisionPath: 'EXISTING_PRODUCT_RECONCILIATION_DECISIONS',
      mutationBoundary: 'EXISTING_CONTROL_PLANE',
    });
  });

  it('routes multiple or ambiguous candidates to human review without a proposed product id', () => {
    const result = prepare([
      {
        productId: 'product-a',
        matchKind: 'FUZZY',
        confidence: 0.82,
        reasons: ['Candidate A.'],
      },
      {
        productId: 'product-b',
        matchKind: 'AMBIGUOUS',
        confidence: 0.78,
        reasons: ['Candidate B.'],
      },
    ]);

    expect(result.classification).toBe('REVIEW_REQUIRED');
    expect(result.proposedProductId).toBeNull();
    expect(result.recommendation.priority).toBe('P1');
  });

  it('treats no match as a NEW_PRODUCT candidate but never creates Product Master automatically', () => {
    const result = prepare([]);

    expect(result.classification).toBe('NEW_PRODUCT');
    expect(result.candidate.type).toBe('NEW_PRODUCT');
    expect(result.proposedProductId).toBeNull();
    expect(result.canAutoCreateProductMaster).toBe(false);
    expect(result.recommendation.actionType).toBe(
      'REVIEW_NEW_PRODUCT_CANDIDATE',
    );
  });

  it('treats conflicting or multiple exact identities as conflict', () => {
    const result = prepare([
      {
        productId: 'product-a',
        matchKind: 'EXACT',
        confidence: 0.99,
        reasons: ['Exact A.'],
      },
      {
        productId: 'product-b',
        matchKind: 'EXACT',
        confidence: 0.98,
        reasons: ['Exact B.'],
      },
    ]);

    expect(result.classification).toBe('CONFLICT');
    expect(result.proposedProductId).toBeNull();
    expect(result.recommendation.severity).toBe('CRITICAL');
  });

  it('feeds the existing Unified Human Review Queue instead of creating another queue', () => {
    const result = prepare([
      {
        productId: 'product-1',
        matchKind: 'FUZZY',
        confidence: 0.65,
        reasons: ['Weak fuzzy candidate.'],
      },
    ]);

    const queue = buildUnifiedHumanReviewQueue({
      reconciliations: [result.reviewCandidate],
    });

    expect(queue).toHaveLength(1);
    expect(queue[0]?.sourceKind).toBe('PRODUCT_RECONCILIATION');
    expect(queue[0]?.reviewId).toBe('PRODUCT_RECONCILIATION:result-1');
    expect(queue[0]?.requiresHumanDecision).toBe(true);
  });

  it('rejects duplicate candidate product IDs', () => {
    expect(() =>
      prepare([
        {
          productId: 'product-1',
          matchKind: 'FUZZY',
          confidence: 0.7,
          reasons: [],
        },
        {
          productId: 'product-1',
          matchKind: 'AMBIGUOUS',
          confidence: 0.6,
          reasons: [],
        },
      ]),
    ).toThrow('PRODUCT_RECONCILIATION_DUPLICATE_PRODUCT_CANDIDATE');
  });

  it('projects persisted reconciliation results as evidence without authority', () => {
    const evidence = evidenceFromPersistedReconciliation({
      resultId: 'persisted-result-1',
      correlationId: 'corr-persisted',
      context: {
        contextId: 'product-reconciliation-run-1',
        type: 'PRODUCT',
        attributes: {},
      },
      classification: 'POSSIBLE_MATCH',
      productId: 'product-9',
      confidence: 0.83,
      reason: 'Existing persisted reconciliation result.',
      sourcePayload: { sourceRowKey: 'r9' },
      createdAt: '2026-09-03T20:00:00.000Z',
    });

    expect(evidence.capability).toBe('PRODUCT_INTELLIGENCE');
    expect(evidence.payload).toMatchObject({
      observedProductId: 'product-9',
      canAutoAssignProductId: false,
    });
  });
});
