import {
  evaluateRecommendationAssurance,
} from '@lihen/intelligence-core';
import type {
  IntelligenceAssuranceIssue,
  IntelligenceAssuranceIssueCode,
  IntelligenceAssuranceResult,
  IntelligenceAssuranceStatus,
} from '@lihen/intelligence-core';
import type { LihenIntelligenceRecommendation } from './dashboard-intelligence';

export type {
  IntelligenceAssuranceIssue,
  IntelligenceAssuranceIssueCode,
  IntelligenceAssuranceResult,
  IntelligenceAssuranceStatus,
};

/**
 * Compatibility adapter for the current deterministic Dashboard Intelligence.
 *
 * GAP-005 moves the assurance engine to @lihen/intelligence-core without changing
 * Dashboard behavior. The legacy `execution-held` recommendation is translated into
 * the generic executionGuard signal here, so future producers are not required to use
 * that specific recommendation id.
 */
export function evaluateIntelligenceAssurance(
  recommendations: readonly LihenIntelligenceRecommendation[],
): IntelligenceAssuranceResult {
  return evaluateRecommendationAssurance(
    recommendations.map((recommendation) => ({
      id: recommendation.id,
      source: recommendation.source,
      rationale: recommendation.rationale,
      ...(recommendation.actionLabel === undefined
        ? {}
        : { actionLabel: recommendation.actionLabel }),
      ...(recommendation.targetRoute === undefined
        ? {}
        : { targetRoute: recommendation.targetRoute }),
      executionGuard: recommendation.id === 'execution-held',
    })),
  );
}
