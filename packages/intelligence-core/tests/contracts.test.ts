import { describe, expect, it } from 'vitest';
import type {
  Confidence,
  IntelligenceContext,
  IntelligenceEvidence,
  IntelligenceRecommendation,
  IntelligenceResult,
  LegacyRecommendationSemantics,
  SourceAuthority,
  ToolDescriptor,
} from '../src';

describe('LIHEN Intelligence Core contracts — GAP-003', () => {
  it('preserves the current dashboard recommendation semantics', () => {
    const recommendation = {
      priority: 'P1',
      severity: 'CRITICAL',
      source: 'dashboard operacional',
      rationale: ['integrity first'],
    } satisfies LegacyRecommendationSemantics;

    expect(recommendation.priority).toBe('P1');
    expect(recommendation.severity).toBe('CRITICAL');
  });

  it('models context as a governed projection instead of canonical storage', () => {
    const context = {
      contextId: 'ctx-product-1',
      type: 'PRODUCT',
      entityId: 'product-1',
      businessLine: 'BEAUTY_CARE',
      attributes: { sku: 'BC-001' },
    } satisfies IntelligenceContext;

    expect(context.type).toBe('PRODUCT');
    expect(context.attributes).toEqual({ sku: 'BC-001' });
  });

  it('keeps source authority and confidence explicit', () => {
    const sourceAuthority = {
      level: 'OFFICIAL',
      sourceName: 'official brand site',
      sourceUri: 'https://example.invalid/product',
      rationale: ['first-party source'],
    } satisfies SourceAuthority;

    const confidence = {
      score: 0.98,
      band: 'VERY_HIGH',
      rationale: ['exact reference and packaging match'],
    } satisfies Confidence;

    expect(sourceAuthority.level).toBe('OFFICIAL');
    expect(confidence.score).toBeGreaterThan(0.9);
  });

  it('makes evidence independently traceable by correlation and fingerprint', () => {
    const evidence = {
      evidenceId: 'evidence-1',
      correlationId: 'corr-1',
      context: {
        contextId: 'ctx-brand-1',
        type: 'BRAND',
        entityId: 'brand-1',
        attributes: {},
      },
      capability: 'VERIFICATION',
      sourceAuthority: {
        level: 'FIRST_PARTY',
        sourceName: 'brand source',
        rationale: [],
      },
      observation: 'Identity matched.',
      confidence: {
        score: 0.95,
        band: 'VERY_HIGH',
        rationale: ['consistent identity'],
      },
      fingerprint: 'sha256:test',
      createdAt: '2026-09-01T10:00:00Z',
    } satisfies IntelligenceEvidence;

    expect(evidence.correlationId).toBe('corr-1');
    expect(evidence.fingerprint).toBe('sha256:test');
  });

  it('represents recommendation without implying execution', () => {
    const recommendation = {
      recommendationId: 'rec-1',
      correlationId: 'corr-1',
      context: {
        contextId: 'ctx-product-1',
        type: 'PRODUCT',
        entityId: 'product-1',
        attributes: {},
      },
      actionType: 'REVIEW_PRODUCT_ASSET',
      title: 'Review candidate asset',
      explanation: 'A verified candidate is available.',
      priority: 'P2',
      severity: 'WARNING',
      source: 'product intelligence',
      rationale: ['exact product match'],
      evidenceIds: ['evidence-1'],
      confidence: {
        score: 0.9,
        band: 'HIGH',
        rationale: ['verified source'],
      },
      risk: {
        level: 'R2',
        reasons: ['recommendation only'],
        requiresHumanReview: true,
      },
      status: 'OPEN',
      createdAt: '2026-09-01T10:00:00Z',
    } satisfies IntelligenceRecommendation;

    expect(recommendation.status).toBe('OPEN');
    expect(recommendation.risk.requiresHumanReview).toBe(true);
  });

  it('describes tools without coupling contracts to a provider', () => {
    const tool = {
      toolId: 'vision-default',
      kind: 'VISION',
      name: 'Vision capability adapter',
      version: 'v1',
      description: 'Provider-neutral visual analysis tool.',
      readOnly: true,
    } satisfies ToolDescriptor;

    expect(tool.readOnly).toBe(true);
  });

  it('keeps result traceability independent from persistence', () => {
    const result = {
      correlationId: 'corr-1',
      status: 'REQUIRES_REVIEW',
      evidenceIds: ['evidence-1'],
      candidateIds: ['candidate-1'],
      recommendationIds: ['rec-1'],
      messages: ['Human review required.'],
    } satisfies IntelligenceResult<{ readonly reviewed: boolean }>;

    expect(result.status).toBe('REQUIRES_REVIEW');
    expect(result.recommendationIds).toEqual(['rec-1']);
  });
});
