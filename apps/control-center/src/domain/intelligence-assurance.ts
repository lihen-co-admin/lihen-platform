import type { LihenIntelligenceRecommendation } from './dashboard-intelligence';

export type IntelligenceAssuranceStatus = 'PASS' | 'REVIEW' | 'BLOCKED';

export type IntelligenceAssuranceIssueCode =
  | 'DUPLICATE_RECOMMENDATION_ID'
  | 'MISSING_SOURCE'
  | 'MISSING_RATIONALE'
  | 'ACTION_ROUTE_MISMATCH'
  | 'EXECUTION_GUARD_MISSING'
  | 'RECOMMENDATION_SET_EMPTY';

export interface IntelligenceAssuranceIssue {
  readonly code: IntelligenceAssuranceIssueCode;
  readonly severity: 'WARNING' | 'CRITICAL';
  readonly message: string;
  readonly recommendationId?: string;
}

export interface IntelligenceAssuranceResult {
  readonly status: IntelligenceAssuranceStatus;
  readonly checkedRecommendations: number;
  readonly issueCount: number;
  readonly criticalIssueCount: number;
  readonly warningIssueCount: number;
  readonly issues: readonly IntelligenceAssuranceIssue[];
  readonly explanation: string;
}

/**
 * Assurance verifica trazabilidad y guardas, no recalcula una segunda política
 * de prioridad. La prioridad es semántica y pertenece al productor de señales.
 * Así se evita que dos módulos mantengan umbrales o scores duplicados.
 */
export function evaluateIntelligenceAssurance(
  recommendations: readonly LihenIntelligenceRecommendation[],
): IntelligenceAssuranceResult {
  const issues: IntelligenceAssuranceIssue[] = [];

  if (recommendations.length === 0) {
    issues.push({
      code: 'RECOMMENDATION_SET_EMPTY',
      severity: 'WARNING',
      message: 'No hay recomendaciones disponibles para evaluar.',
    });
  }

  const seenIds = new Set<string>();

  for (const recommendation of recommendations) {
    if (seenIds.has(recommendation.id)) {
      issues.push({
        code: 'DUPLICATE_RECOMMENDATION_ID',
        severity: 'CRITICAL',
        message: `La recomendación ${recommendation.id} aparece más de una vez.`,
        recommendationId: recommendation.id,
      });
    }
    seenIds.add(recommendation.id);

    if (!recommendation.source.trim()) {
      issues.push({
        code: 'MISSING_SOURCE',
        severity: 'CRITICAL',
        message: 'La recomendación no declara su fuente.',
        recommendationId: recommendation.id,
      });
    }

    if (
      recommendation.rationale.length === 0
      || recommendation.rationale.some((item) => !item.trim())
    ) {
      issues.push({
        code: 'MISSING_RATIONALE',
        severity: 'CRITICAL',
        message: 'La recomendación no contiene rationale explicable completo.',
        recommendationId: recommendation.id,
      });
    }

    const hasActionLabel = Boolean(recommendation.actionLabel);
    const hasTargetRoute = Boolean(recommendation.targetRoute);
    if (hasActionLabel !== hasTargetRoute) {
      issues.push({
        code: 'ACTION_ROUTE_MISMATCH',
        severity: 'WARNING',
        message: 'La acción sugerida debe declarar label y ruta juntos, o ninguno.',
        recommendationId: recommendation.id,
      });
    }
  }

  if (!recommendations.some((item) => item.id === 'execution-held')) {
    issues.push({
      code: 'EXECUTION_GUARD_MISSING',
      severity: 'CRITICAL',
      message: 'Falta la señal explícita que recuerda que Intelligence no ejecuta cambios.',
    });
  }

  const criticalIssueCount = issues.filter((issue) => issue.severity === 'CRITICAL').length;
  const warningIssueCount = issues.filter((issue) => issue.severity === 'WARNING').length;
  const status: IntelligenceAssuranceStatus =
    criticalIssueCount > 0 ? 'BLOCKED' : warningIssueCount > 0 ? 'REVIEW' : 'PASS';

  return {
    status,
    checkedRecommendations: recommendations.length,
    issueCount: issues.length,
    criticalIssueCount,
    warningIssueCount,
    issues,
    explanation:
      status === 'PASS'
        ? 'Las recomendaciones son coherentes, explicables, trazables y mantienen la ejecución bajo control humano.'
        : status === 'REVIEW'
          ? 'Las recomendaciones son utilizables, pero requieren revisión de calidad antes de ampliar su uso.'
          : 'La capa de Intelligence presenta inconsistencias que deben resolverse antes de confiar en sus recomendaciones.',
  };
}
