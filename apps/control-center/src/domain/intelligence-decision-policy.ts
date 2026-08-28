import type { IntelligenceAssuranceStatus } from './intelligence-assurance';
import type { LihenIntelligenceRecommendation } from './dashboard-intelligence';

export type IntelligenceDecisionState = 'OBSERVE' | 'REVIEW' | 'APPROVABLE' | 'BLOCKED';

export interface IntelligenceDecisionPolicyResult {
  readonly state: IntelligenceDecisionState;
  readonly recommendationId: string;
  readonly mayOpenSuggestedRoute: boolean;
  readonly mayRequestHumanDecision: boolean;
  readonly mayExecuteAutomatically: false;
  readonly explanation: string;
}

export interface IntelligenceDecisionPolicyInput {
  readonly assuranceStatus: IntelligenceAssuranceStatus;
  readonly recommendation: LihenIntelligenceRecommendation;
}

export function evaluateIntelligenceDecisionPolicy(
  input: IntelligenceDecisionPolicyInput,
): IntelligenceDecisionPolicyResult {
  const { assuranceStatus, recommendation } = input;
  const hasSuggestedAction = Boolean(
    recommendation.actionLabel && recommendation.targetRoute,
  );

  if (assuranceStatus === 'BLOCKED') {
    return {
      state: 'BLOCKED',
      recommendationId: recommendation.id,
      mayOpenSuggestedRoute: false,
      mayRequestHumanDecision: false,
      mayExecuteAutomatically: false,
      explanation:
        'La recomendación queda bloqueada porque el assurance de Intelligence presenta inconsistencias críticas.',
    };
  }

  if (assuranceStatus === 'REVIEW') {
    return {
      state: 'REVIEW',
      recommendationId: recommendation.id,
      mayOpenSuggestedRoute: hasSuggestedAction,
      mayRequestHumanDecision: false,
      mayExecuteAutomatically: false,
      explanation:
        'La recomendación puede revisarse, pero no debe presentarse como lista para decisión mientras el assurance requiera revisión.',
    };
  }

  if (!hasSuggestedAction) {
    return {
      state: 'OBSERVE',
      recommendationId: recommendation.id,
      mayOpenSuggestedRoute: false,
      mayRequestHumanDecision: false,
      mayExecuteAutomatically: false,
      explanation:
        'La recomendación es informativa y no propone una ruta de actuación.',
    };
  }

  return {
    state: 'APPROVABLE',
    recommendationId: recommendation.id,
    mayOpenSuggestedRoute: true,
    mayRequestHumanDecision: true,
    mayExecuteAutomatically: false,
    explanation:
      'La recomendación es coherente y puede presentarse para decisión humana; cualquier cambio real debe continuar por el comando y gate correspondientes.',
  };
}

export function summarizeIntelligenceDecisionPolicy(
  assuranceStatus: IntelligenceAssuranceStatus,
  recommendations: readonly LihenIntelligenceRecommendation[],
): {
  readonly approvableCount: number;
  readonly reviewCount: number;
  readonly blockedCount: number;
  readonly observeCount: number;
  readonly executionMustRemainManual: true;
} {
  const decisions = recommendations.map((recommendation) =>
    evaluateIntelligenceDecisionPolicy({ assuranceStatus, recommendation }),
  );

  return {
    approvableCount: decisions.filter((item) => item.state === 'APPROVABLE').length,
    reviewCount: decisions.filter((item) => item.state === 'REVIEW').length,
    blockedCount: decisions.filter((item) => item.state === 'BLOCKED').length,
    observeCount: decisions.filter((item) => item.state === 'OBSERVE').length,
    executionMustRemainManual: true,
  };
}
