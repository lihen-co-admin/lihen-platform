export type PublishingCutoverIntegrityStatus = 'PASS' | 'REVIEW' | 'BLOCKED';

export interface PublishingCutoverState {
  readonly runId: string;
  readonly catalogVersionId: string;
  readonly status: 'PREPARED' | 'EXECUTED' | 'VERIFIED';
  readonly sourceCount: number;
  readonly eligibleCount: number;
  readonly blockedCount: number;
  readonly alreadyVisibleCount: number;
  readonly outsideVisibleBaselineCount: number;
  readonly affectedCount: number;
  readonly verificationMetrics: Record<string, unknown> | null;
}

export interface PublishingCutoverIntegrityResult {
  readonly status: PublishingCutoverIntegrityStatus;
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
}

function integerMetric(metrics: Record<string, unknown>, key: string): number | null {
  const value = metrics[key];
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) return Number(value);
  return null;
}

/**
 * Verifica coherencia interna del cutover Storefront sin ejecutar ni reparar nada.
 * La verificación de base de datos sigue siendo la autoridad; esta política interpreta
 * el run y su evidencia congelada para evitar que un estado VERIFIED se trate como PASS
 * cuando sus métricas no son explicables.
 */
export function evaluatePublishingCutoverIntegrity(input: {
  readonly expectedSnapshotCount: number;
  readonly cutover: PublishingCutoverState | null;
}): PublishingCutoverIntegrityResult {
  const { expectedSnapshotCount, cutover } = input;
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!cutover) {
    return { status: 'REVIEW', blockers, warnings: ['CUTOVER_NOT_PREPARED'] };
  }

  if (cutover.sourceCount !== expectedSnapshotCount) {
    blockers.push('CUTOVER_SOURCE_COUNT_MISMATCH');
  }
  if (cutover.sourceCount !== cutover.eligibleCount + cutover.blockedCount) {
    blockers.push('CUTOVER_CANDIDATE_ACCOUNTING_MISMATCH');
  }
  if (cutover.blockedCount > 0) {
    blockers.push('CUTOVER_HAS_BLOCKED_PRODUCTS');
  }
  if (cutover.alreadyVisibleCount < 0 || cutover.alreadyVisibleCount > cutover.eligibleCount) {
    blockers.push('CUTOVER_ALREADY_VISIBLE_COUNT_INVALID');
  }
  if (cutover.outsideVisibleBaselineCount < 0) {
    blockers.push('CUTOVER_OUTSIDE_BASELINE_INVALID');
  }
  if (cutover.affectedCount < 0 || cutover.affectedCount > cutover.eligibleCount) {
    blockers.push('CUTOVER_AFFECTED_COUNT_INVALID');
  }

  if (cutover.status === 'PREPARED') {
    if (cutover.verificationMetrics) {
      warnings.push('PREPARED_RUN_HAS_VERIFICATION_METRICS');
    }
    return {
      status: blockers.length > 0 ? 'BLOCKED' : warnings.length > 0 ? 'REVIEW' : 'PASS',
      blockers,
      warnings,
    };
  }

  if (cutover.status === 'EXECUTED') {
    if (!cutover.verificationMetrics) {
      warnings.push('CUTOVER_VERIFICATION_PENDING');
    }
    return {
      status: blockers.length > 0 ? 'BLOCKED' : 'REVIEW',
      blockers,
      warnings,
    };
  }

  const metrics = cutover.verificationMetrics;
  if (!metrics) {
    blockers.push('VERIFIED_CUTOVER_METRICS_MISSING');
    return { status: 'BLOCKED', blockers, warnings };
  }

  const expectedVisible = integerMetric(metrics, 'expected_visible_count');
  const actualVisible = integerMetric(metrics, 'actual_visible_count');
  const missingVisible = integerMetric(metrics, 'missing_visible_count');
  const outsideBaseline = integerMetric(metrics, 'outside_visible_baseline_count');
  const outsideCurrent = integerMetric(metrics, 'outside_visible_current_count');
  const revalidationFailure = integerMetric(metrics, 'revalidation_failure_count');
  const storefrontProjection = integerMetric(metrics, 'storefront_projection_count');

  if (
    expectedVisible == null ||
    actualVisible == null ||
    missingVisible == null ||
    outsideBaseline == null ||
    outsideCurrent == null ||
    revalidationFailure == null ||
    storefrontProjection == null
  ) {
    blockers.push('VERIFIED_CUTOVER_METRICS_INCOMPLETE');
    return { status: 'BLOCKED', blockers, warnings };
  }

  if (expectedVisible !== cutover.eligibleCount) blockers.push('VERIFICATION_EXPECTED_COUNT_MISMATCH');
  if (actualVisible !== expectedVisible) blockers.push('VERIFICATION_ACTUAL_COUNT_MISMATCH');
  if (missingVisible !== 0) blockers.push('VERIFICATION_HAS_MISSING_VISIBLE_PRODUCTS');
  if (outsideBaseline !== cutover.outsideVisibleBaselineCount) blockers.push('VERIFICATION_BASELINE_MISMATCH');
  if (outsideCurrent !== outsideBaseline) blockers.push('VERIFICATION_OUTSIDE_VISIBILITY_DRIFT');
  if (revalidationFailure !== 0) blockers.push('VERIFICATION_REVALIDATION_FAILURES');
  if (storefrontProjection !== expectedVisible + outsideBaseline) {
    blockers.push('VERIFICATION_STOREFRONT_PROJECTION_MISMATCH');
  }

  return {
    status: blockers.length > 0 ? 'BLOCKED' : 'PASS',
    blockers,
    warnings,
  };
}
