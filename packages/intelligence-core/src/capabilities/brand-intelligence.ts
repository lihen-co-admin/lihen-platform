import type {
  Confidence,
  CorrelationId,
  IntelligenceCandidate,
  IntelligenceContext,
  IntelligenceEvidence,
  IntelligenceRecommendation,
  SourceAuthority,
  SourceAuthorityLevel,
} from '../contracts';
import type { SearchPort, VisionPort } from '../provider-ports';

/**
 * WAVE 5 / GAP-016 — Brand Intelligence capability foundation.
 *
 * This module is intentionally provider-neutral and persistence-neutral.
 * It prepares auditable Intelligence artifacts; it never mutates Brand Master,
 * Brand Assets, Supabase, publishing, or the Existing Control Plane.
 */

export type BrandIntelligenceSourceRole =
  | 'OFFICIAL_BRAND'
  | 'OFFICIAL_PRODUCT_COLLECTION'
  | 'AUTHORIZED_SUPPLIER'
  | 'SECONDARY_REFERENCE';

export type BrandIntelligenceTrustTier = 'TIER_1' | 'TIER_2' | 'TIER_3';

export type BrandIntelligenceMediaRightsBasis =
  | 'PUBLIC_REFERENCE_ONLY'
  | 'USER_CONFIRMED_SUPPLIER_RIGHTS'
  | 'BRAND_AUTHORIZED'
  | 'INTERNAL_LIHEN_ASSET';

export type BrandIntelligenceSourceStatus = 'ACTIVE' | 'INACTIVE';

export type BrandIdentityAssetKind = 'LOGO' | 'WORDMARK' | 'ISOTYPE' | 'LOCKUP';

export type BrandIdentityApprovalMode =
  | 'MANUAL_VERIFIED'
  | 'AUTO_VERIFIED'
  | 'CANDIDATE'
  | 'REQUIRES_REVIEW';

export interface BrandIntelligenceTools {
  readonly search: SearchPort;
  readonly vision: VisionPort;
}

export interface BrandIntelligenceSource {
  readonly sourceName: string;
  readonly sourceUrl: string;
  readonly sourceRole: BrandIntelligenceSourceRole;
  readonly trustTier: BrandIntelligenceTrustTier;
  readonly mediaRightsBasis: BrandIntelligenceMediaRightsBasis;
  readonly status: BrandIntelligenceSourceStatus;
}

export interface BrandAssetIntelligenceSnapshot {
  readonly id: string;
  readonly brandId: string;
  readonly kind: BrandIdentityAssetKind;
  readonly publicUrl: string;
  readonly status: 'ACTIVE' | 'ARCHIVED';
  readonly approvalMode: BrandIdentityApprovalMode;
  readonly isPrimary: boolean;
}

export type BrandAssetCandidateDisposition =
  | 'REJECTED_SOURCE'
  | 'REQUIRES_REVIEW'
  | 'VERIFICATION_ELIGIBLE'
  | 'MANUAL_IDENTITY_PROTECTED'
  | 'ALREADY_MANUAL_VERIFIED';

export interface PrepareBrandAssetCandidateInput {
  readonly correlationId: CorrelationId;
  readonly evidenceId: string;
  readonly candidateId: string;
  readonly recommendationId: string;
  readonly brandId: string;
  readonly assetKind: BrandIdentityAssetKind;
  readonly candidateUrl: string;
  readonly source: BrandIntelligenceSource;
  readonly confidenceScore: number;
  readonly fingerprint: string;
  readonly observation: string;
  readonly createdAt: string;
  readonly existingAssets: readonly BrandAssetIntelligenceSnapshot[];
}

export interface PreparedBrandAssetCandidate {
  readonly disposition: BrandAssetCandidateDisposition;
  readonly sourceAuthority: SourceAuthority;
  readonly evidence: IntelligenceEvidence;
  readonly candidate: IntelligenceCandidate;
  readonly recommendation: IntelligenceRecommendation;
  readonly protectedManualAssetId?: string;
}

function requireText(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}

function confidenceFrom(score: number): Confidence {
  if (!Number.isFinite(score) || score < 0 || score > 1) {
    throw new Error('Brand Intelligence confidenceScore must be between 0 and 1.');
  }

  const band: Confidence['band'] =
    score >= 0.9
      ? 'VERY_HIGH'
      : score >= 0.75
        ? 'HIGH'
        : score >= 0.5
          ? 'MEDIUM'
          : score >= 0.25
            ? 'LOW'
            : 'VERY_LOW';

  return {
    score,
    band,
    rationale: [`Normalized Brand Intelligence confidence: ${score.toFixed(2)}.`],
  };
}

function sourceAuthorityLevel(
  source: BrandIntelligenceSource,
): SourceAuthorityLevel {
  if (source.status === 'INACTIVE') return 'UNVERIFIED';

  if (source.sourceRole === 'OFFICIAL_BRAND') {
    return source.trustTier === 'TIER_3' ? 'FIRST_PARTY' : 'OFFICIAL';
  }

  if (source.sourceRole === 'OFFICIAL_PRODUCT_COLLECTION') {
    return source.trustTier === 'TIER_3' ? 'TRUSTED_SECONDARY' : 'FIRST_PARTY';
  }

  if (source.sourceRole === 'AUTHORIZED_SUPPLIER') {
    return source.trustTier === 'TIER_3' ? 'SUPPLIER' : 'VERIFIED_PARTNER';
  }

  return source.trustTier === 'TIER_3'
    ? 'UNVERIFIED'
    : 'TRUSTED_SECONDARY';
}

export function resolveBrandSourceAuthority(
  source: BrandIntelligenceSource,
): SourceAuthority {
  const sourceName = requireText(source.sourceName, 'Brand source name');
  const sourceUri = requireText(source.sourceUrl, 'Brand source URL');
  const level = sourceAuthorityLevel(source);

  return {
    level,
    sourceName,
    sourceUri,
    rationale: [
      `Role=${source.sourceRole}.`,
      `Trust=${source.trustTier}.`,
      `Rights=${source.mediaRightsBasis}.`,
      `Status=${source.status}.`,
    ],
  };
}

function findProtectedManualAsset(
  brandId: string,
  kind: BrandIdentityAssetKind,
  existingAssets: readonly BrandAssetIntelligenceSnapshot[],
): BrandAssetIntelligenceSnapshot | undefined {
  return existingAssets.find(
    (asset) =>
      asset.brandId === brandId &&
      asset.kind === kind &&
      asset.status === 'ACTIVE' &&
      asset.isPrimary &&
      asset.approvalMode === 'MANUAL_VERIFIED',
  );
}

function dispositionFor(
  source: BrandIntelligenceSource,
  confidenceScore: number,
  protectedManual: BrandAssetIntelligenceSnapshot | undefined,
  candidateUrl: string,
): BrandAssetCandidateDisposition {
  if (source.status !== 'ACTIVE') return 'REJECTED_SOURCE';

  if (protectedManual?.publicUrl === candidateUrl) {
    return 'ALREADY_MANUAL_VERIFIED';
  }

  if (protectedManual) return 'MANUAL_IDENTITY_PROTECTED';

  const authoritativeSource =
    source.sourceRole === 'OFFICIAL_BRAND' &&
    source.trustTier !== 'TIER_3' &&
    source.mediaRightsBasis === 'BRAND_AUTHORIZED';

  if (authoritativeSource && confidenceScore >= 0.85) {
    return 'VERIFICATION_ELIGIBLE';
  }

  return 'REQUIRES_REVIEW';
}

function recommendationText(
  disposition: BrandAssetCandidateDisposition,
): {
  readonly actionType: string;
  readonly title: string;
  readonly explanation: string;
  readonly priority: IntelligenceRecommendation['priority'];
  readonly severity: IntelligenceRecommendation['severity'];
} {
  switch (disposition) {
    case 'REJECTED_SOURCE':
      return {
        actionType: 'REVIEW_REJECTED_BRAND_ASSET_SOURCE',
        title: 'Review rejected Brand Asset source',
        explanation:
          'The source is inactive and cannot support a canonical Brand Asset proposal.',
        priority: 'P3',
        severity: 'WARNING',
      };
    case 'MANUAL_IDENTITY_PROTECTED':
      return {
        actionType: 'REVIEW_MANUAL_BRAND_ASSET_REPLACEMENT',
        title: 'Review proposed replacement of manual Brand identity',
        explanation:
          'An ACTIVE MANUAL_VERIFIED primary asset already exists for this kind. Intelligence may propose evidence but cannot silently replace it.',
        priority: 'P1',
        severity: 'WARNING',
      };
    case 'ALREADY_MANUAL_VERIFIED':
      return {
        actionType: 'KEEP_MANUAL_BRAND_ASSET',
        title: 'Keep existing manual Brand identity',
        explanation:
          'The candidate resolves to the same URL as the ACTIVE MANUAL_VERIFIED primary asset. No canonical replacement is required.',
        priority: 'P4',
        severity: 'SUCCESS',
      };
    case 'VERIFICATION_ELIGIBLE':
      return {
        actionType: 'REVIEW_VERIFIED_BRAND_ASSET_CANDIDATE',
        title: 'Review high-authority Brand Asset candidate',
        explanation:
          'The candidate has sufficient source authority and confidence to be verification-eligible, but canonical Brand Asset mutation still requires governed human review.',
        priority: 'P2',
        severity: 'INFO',
      };
    case 'REQUIRES_REVIEW':
      return {
        actionType: 'REVIEW_BRAND_ASSET_CANDIDATE',
        title: 'Review Brand Asset candidate',
        explanation:
          'The candidate is evidence-backed but does not satisfy the strict high-authority verification threshold.',
        priority: 'P2',
        severity: 'INFO',
      };
  }
}

export function prepareBrandAssetCandidate(
  input: PrepareBrandAssetCandidateInput,
): PreparedBrandAssetCandidate {
  const correlationId = requireText(input.correlationId, 'Correlation ID');
  const evidenceId = requireText(input.evidenceId, 'Evidence ID');
  const candidateId = requireText(input.candidateId, 'Candidate ID');
  const recommendationId = requireText(
    input.recommendationId,
    'Recommendation ID',
  );
  const brandId = requireText(input.brandId, 'Brand ID');
  const candidateUrl = requireText(input.candidateUrl, 'Candidate URL');
  const fingerprint = requireText(input.fingerprint, 'Evidence fingerprint');
  const observation = requireText(input.observation, 'Evidence observation');
  const createdAt = requireText(input.createdAt, 'Created at');

  const mismatchedAsset = input.existingAssets.find(
    (asset) => asset.brandId !== brandId,
  );
  if (mismatchedAsset) {
    throw new Error(
      'All existing Brand Asset snapshots must belong to the requested brandId.',
    );
  }

  const confidence = confidenceFrom(input.confidenceScore);
  const sourceAuthority = resolveBrandSourceAuthority(input.source);
  const protectedManual = findProtectedManualAsset(
    brandId,
    input.assetKind,
    input.existingAssets,
  );
  const disposition = dispositionFor(
    input.source,
    confidence.score,
    protectedManual,
    candidateUrl,
  );

  const context: IntelligenceContext = {
    contextId: `brand:${brandId}`,
    type: 'BRAND',
    entityId: brandId,
    attributes: {},
  };

  const evidence: IntelligenceEvidence = {
    evidenceId,
    correlationId,
    context,
    capability: 'BRAND_INTELLIGENCE',
    sourceAuthority,
    observation,
    payload: {
      brandId,
      assetKind: input.assetKind,
      candidateUrl,
      sourceRole: input.source.sourceRole,
      trustTier: input.source.trustTier,
      mediaRightsBasis: input.source.mediaRightsBasis,
      disposition,
    },
    confidence,
    fingerprint,
    createdAt,
  };

  const candidatePayload: Record<string, unknown> = {
    brandId,
    assetKind: input.assetKind,
    candidateUrl,
    sourceUrl: input.source.sourceUrl,
    sourceRole: input.source.sourceRole,
    trustTier: input.source.trustTier,
    mediaRightsBasis: input.source.mediaRightsBasis,
    disposition,
  };
  if (protectedManual) {
    candidatePayload.protectedManualAssetId = protectedManual.id;
  }

  const candidate: IntelligenceCandidate = {
    candidateId,
    correlationId,
    type: 'BRAND_ASSET',
    context,
    payload: candidatePayload,
    evidenceIds: [evidenceId],
    confidence,
    status: 'IN_REVIEW',
    createdAt,
  };

  const message = recommendationText(disposition);
  const requiresHumanReview = disposition !== 'ALREADY_MANUAL_VERIFIED';
  const recommendation: IntelligenceRecommendation = {
    recommendationId,
    correlationId,
    context,
    actionType: message.actionType,
    title: message.title,
    explanation: message.explanation,
    priority: message.priority,
    severity: message.severity,
    source: 'BRAND_INTELLIGENCE',
    rationale: [
      ...sourceAuthority.rationale,
      `Disposition=${disposition}.`,
      ...(protectedManual
        ? [`Protected manual asset=${protectedManual.id}.`]
        : []),
      'Confidence is evidence quality, not authorization.',
    ],
    evidenceIds: [evidenceId],
    confidence,
    risk: {
      level: requiresHumanReview ? 'R3' : 'R0',
      reasons: requiresHumanReview
        ? [
            'Canonical Brand Asset changes are governed mutations.',
            'Human review precedes any controlled mutation.',
          ]
        : ['No canonical mutation is required.'],
      requiresHumanReview,
    },
    status: 'OPEN',
    createdAt,
  };

  const output: PreparedBrandAssetCandidate = {
    disposition,
    sourceAuthority,
    evidence,
    candidate,
    recommendation,
  };
  if (protectedManual) {
    return { ...output, protectedManualAssetId: protectedManual.id };
  }
  return output;
}
