import type {
  Confidence,
  CorrelationId,
  IntelligenceContext,
  IntelligenceEvidence,
  IntelligenceRecommendation,
  SourceAuthority,
} from '../contracts';

export interface MarketingIntelligenceSnapshot {
  readonly campaignId: string;
  readonly campaignName: string;
  readonly objective: string;
  readonly audienceDescription: string;
  readonly channelCount: number;
  readonly totalEngagement: number;
  readonly totalConversions: number;
  readonly engagementRate: number | null;
}

export interface PrepareMarketingIntelligenceInput {
  readonly correlationId: CorrelationId;
  readonly evidenceId: string;
  readonly recommendationId: string;
  readonly snapshot: MarketingIntelligenceSnapshot;
  readonly fingerprint: string;
  readonly createdAt: string;
}

export interface PreparedMarketingIntelligence {
  readonly evidence: IntelligenceEvidence;
  readonly recommendation: IntelligenceRecommendation;
}

function requireText(value: string, code: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(code);
  return normalized;
}

function confidenceFor(
  snapshot: MarketingIntelligenceSnapshot,
): Confidence {
  const hasPerformance =
    snapshot.channelCount > 0 &&
    (
      snapshot.totalEngagement > 0 ||
      snapshot.totalConversions > 0 ||
      snapshot.engagementRate !== null
    );

  return {
    score: hasPerformance ? 0.9 : 0.75,
    band: hasPerformance ? 'VERY_HIGH' : 'HIGH',
    rationale: [
      hasPerformance
        ? 'Recommendation is supported by governed campaign performance signals.'
        : 'Campaign context is available but performance evidence is still limited.',
      'Confidence does not authorize publishing or customer contact.',
    ],
  };
}

function sourceAuthority(): SourceAuthority {
  return {
    level: 'FIRST_PARTY',
    sourceName: 'LIHEN Marketing Read Model',
    sourceUri: 'lihen://marketing/read-model',
    rationale: [
      'Campaign and performance context originates from governed LIHEN read models.',
      'Marketing Intelligence remains advisory and provider-independent.',
    ],
  };
}

export function prepareMarketingIntelligence(
  input: PrepareMarketingIntelligenceInput,
): PreparedMarketingIntelligence {
  const correlationId = requireText(
    input.correlationId,
    'MARKETING_CORRELATION_ID_REQUIRED',
  );

  const evidenceId = requireText(
    input.evidenceId,
    'MARKETING_EVIDENCE_ID_REQUIRED',
  );

  const recommendationId = requireText(
    input.recommendationId,
    'MARKETING_RECOMMENDATION_ID_REQUIRED',
  );

  const campaignId = requireText(
    input.snapshot.campaignId,
    'MARKETING_CAMPAIGN_ID_REQUIRED',
  );

  requireText(
    input.snapshot.campaignName,
    'MARKETING_CAMPAIGN_NAME_REQUIRED',
  );

  requireText(
    input.snapshot.objective,
    'MARKETING_OBJECTIVE_REQUIRED',
  );

  requireText(
    input.snapshot.audienceDescription,
    'MARKETING_AUDIENCE_REQUIRED',
  );

  const createdAt = requireText(
    input.createdAt,
    'MARKETING_CREATED_AT_REQUIRED',
  );

  const fingerprint = requireText(
    input.fingerprint,
    'MARKETING_FINGERPRINT_REQUIRED',
  );

  const context: IntelligenceContext = {
    contextId: `marketing:${campaignId}`,
    type: 'MARKETING',
    entityId: campaignId,
    attributes: {},
  };

  const confidence = confidenceFor(input.snapshot);

  const evidence: IntelligenceEvidence = {
    evidenceId,
    correlationId,
    context,
    capability: 'MARKETING_INTELLIGENCE',
    sourceAuthority: sourceAuthority(),
    observation:
      'Marketing campaign context analyzed without autonomous publication or customer contact.',
    payload: {
      campaignId,
      campaignName: input.snapshot.campaignName,
      objective: input.snapshot.objective,
      audienceDescription: input.snapshot.audienceDescription,
      channelCount: input.snapshot.channelCount,
      totalEngagement: input.snapshot.totalEngagement,
      totalConversions: input.snapshot.totalConversions,
      engagementRate: input.snapshot.engagementRate,
    },
    confidence,
    fingerprint,
    createdAt,
  };

  const recommendation: IntelligenceRecommendation = {
    recommendationId,
    correlationId,
    context,
    actionType: 'REVIEW_MARKETING_STRATEGY',
    title: 'Review marketing strategy',
    explanation:
      'Review campaign strategy, AIDA execution, channel adaptation and performance before any governed publication action.',
    priority:
      input.snapshot.totalConversions === 0 ? 'P2' : 'P3',
    severity: 'INFO',
    source: 'MARKETING_INTELLIGENCE',
    rationale: [
      'Campaign strategy may be improved using first-party performance evidence.',
      'Creative generation is a separate capability and generated assets are not canonical assets.',
      'Publishing and customer contact remain outside Marketing Intelligence authority.',
    ],
    evidenceIds: [evidenceId],
    confidence,
    risk: {
      level: 'R2',
      reasons: [
        'Marketing recommendations may influence future commercial communication.',
        'Publication or direct customer contact requires a separately governed action.',
      ],
      requiresHumanReview: true,
    },
    status: 'OPEN',
    createdAt,
  };

  return {
    evidence,
    recommendation,
  };
}
