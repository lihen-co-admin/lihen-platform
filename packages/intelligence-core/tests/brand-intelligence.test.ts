import { describe, expect, it } from 'vitest';
import {
  prepareBrandAssetCandidate,
  resolveBrandSourceAuthority,
  type BrandIntelligenceSource,
} from '../src';

const officialSource: BrandIntelligenceSource = {
  sourceName: 'Official Brand',
  sourceUrl: 'https://brand.example',
  sourceRole: 'OFFICIAL_BRAND',
  trustTier: 'TIER_1',
  mediaRightsBasis: 'BRAND_AUTHORIZED',
  status: 'ACTIVE',
};

const baseInput = {
  correlationId: 'corr-016',
  evidenceId: 'evidence-016',
  candidateId: 'candidate-016',
  recommendationId: 'recommendation-016',
  brandId: 'brand-1',
  assetKind: 'LOGO' as const,
  candidateUrl: 'https://brand.example/logo.svg',
  source: officialSource,
  confidenceScore: 0.95,
  fingerprint: 'brand-logo-fingerprint',
  observation: 'Official logo candidate.',
  createdAt: '2026-09-02T12:00:00.000Z',
  existingAssets: [],
};

describe('WAVE 5 / GAP-016 Brand Intelligence', () => {
  it('maps an official Tier 1 Brand source to OFFICIAL authority', () => {
    expect(resolveBrandSourceAuthority(officialSource).level).toBe('OFFICIAL');
  });

  it('maps weak secondary evidence to UNVERIFIED authority', () => {
    expect(
      resolveBrandSourceAuthority({
        ...officialSource,
        sourceRole: 'SECONDARY_REFERENCE',
        trustTier: 'TIER_3',
        mediaRightsBasis: 'PUBLIC_REFERENCE_ONLY',
      }).level,
    ).toBe('UNVERIFIED');
  });

  it('prepares Evidence → Candidate → Recommendation without authorizing mutation', () => {
    const result = prepareBrandAssetCandidate(baseInput);

    expect(result.disposition).toBe('VERIFICATION_ELIGIBLE');
    expect(result.evidence.capability).toBe('BRAND_INTELLIGENCE');
    expect(result.candidate.type).toBe('BRAND_ASSET');
    expect(result.candidate.status).toBe('IN_REVIEW');
    expect(result.recommendation.risk.level).toBe('R3');
    expect(result.recommendation.risk.requiresHumanReview).toBe(true);
    expect(result.recommendation.status).toBe('OPEN');
  });

  it('protects an ACTIVE MANUAL_VERIFIED primary asset from silent replacement', () => {
    const result = prepareBrandAssetCandidate({
      ...baseInput,
      candidateUrl: 'https://brand.example/new-logo.svg',
      existingAssets: [
        {
          id: 'manual-logo',
          brandId: 'brand-1',
          kind: 'LOGO',
          publicUrl: 'https://brand.example/manual-logo.svg',
          status: 'ACTIVE',
          approvalMode: 'MANUAL_VERIFIED',
          isPrimary: true,
        },
      ],
    });

    expect(result.disposition).toBe('MANUAL_IDENTITY_PROTECTED');
    expect(result.protectedManualAssetId).toBe('manual-logo');
    expect(result.recommendation.actionType).toBe(
      'REVIEW_MANUAL_BRAND_ASSET_REPLACEMENT',
    );
    expect(result.recommendation.risk.requiresHumanReview).toBe(true);
  });

  it('does not propose replacement when candidate is the same manual-verified identity', () => {
    const result = prepareBrandAssetCandidate({
      ...baseInput,
      candidateUrl: 'https://brand.example/manual-logo.svg',
      existingAssets: [
        {
          id: 'manual-logo',
          brandId: 'brand-1',
          kind: 'LOGO',
          publicUrl: 'https://brand.example/manual-logo.svg',
          status: 'ACTIVE',
          approvalMode: 'MANUAL_VERIFIED',
          isPrimary: true,
        },
      ],
    });

    expect(result.disposition).toBe('ALREADY_MANUAL_VERIFIED');
    expect(result.recommendation.actionType).toBe('KEEP_MANUAL_BRAND_ASSET');
    expect(result.recommendation.risk.level).toBe('R0');
    expect(result.recommendation.risk.requiresHumanReview).toBe(false);
  });

  it('rejects inactive sources', () => {
    const result = prepareBrandAssetCandidate({
      ...baseInput,
      source: { ...officialSource, status: 'INACTIVE' },
    });

    expect(result.disposition).toBe('REJECTED_SOURCE');
    expect(result.sourceAuthority.level).toBe('UNVERIFIED');
  });

  it('keeps public-reference-only evidence in review', () => {
    const result = prepareBrandAssetCandidate({
      ...baseInput,
      source: {
        ...officialSource,
        mediaRightsBasis: 'PUBLIC_REFERENCE_ONLY',
      },
    });

    expect(result.disposition).toBe('REQUIRES_REVIEW');
  });

  it('keeps secondary references in review even with high confidence', () => {
    const result = prepareBrandAssetCandidate({
      ...baseInput,
      source: {
        ...officialSource,
        sourceRole: 'SECONDARY_REFERENCE',
        trustTier: 'TIER_1',
        mediaRightsBasis: 'BRAND_AUTHORIZED',
      },
    });

    expect(result.disposition).toBe('REQUIRES_REVIEW');
  });

  it('rejects confidence outside 0..1', () => {
    expect(() =>
      prepareBrandAssetCandidate({ ...baseInput, confidenceScore: 1.01 }),
    ).toThrow('confidenceScore must be between 0 and 1');
  });

  it('requires all existing asset snapshots to belong to the same Brand', () => {
    expect(() =>
      prepareBrandAssetCandidate({
        ...baseInput,
        existingAssets: [
          {
            id: 'foreign-logo',
            brandId: 'brand-2',
            kind: 'LOGO',
            publicUrl: 'https://brand-2.example/logo.svg',
            status: 'ACTIVE',
            approvalMode: 'AUTO_VERIFIED',
            isPrimary: true,
          },
        ],
      }),
    ).toThrow(
      'All existing Brand Asset snapshots must belong to the requested brandId.',
    );
  });

  it('preserves a single correlation id through all prepared artifacts', () => {
    const result = prepareBrandAssetCandidate(baseInput);
    expect(result.evidence.correlationId).toBe('corr-016');
    expect(result.candidate.correlationId).toBe('corr-016');
    expect(result.recommendation.correlationId).toBe('corr-016');
  });
});
