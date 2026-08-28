import { describe, expect, it } from 'vitest';
import { evaluatePublishingCutoverIntegrity } from '../src/domain/publishing-cutover-integrity';

const prepared = {
  runId: 'run-1',
  catalogVersionId: 'catalog-1',
  status: 'PREPARED' as const,
  sourceCount: 10,
  eligibleCount: 10,
  blockedCount: 0,
  alreadyVisibleCount: 3,
  outsideVisibleBaselineCount: 2,
  affectedCount: 0,
  verificationMetrics: null,
};

describe('evaluatePublishingCutoverIntegrity', () => {
  it('passes a coherent prepared run', () => {
    expect(evaluatePublishingCutoverIntegrity({ expectedSnapshotCount: 10, cutover: prepared }).status).toBe('PASS');
  });

  it('blocks candidate accounting mismatches', () => {
    const result = evaluatePublishingCutoverIntegrity({
      expectedSnapshotCount: 10,
      cutover: { ...prepared, eligibleCount: 9, blockedCount: 0 },
    });
    expect(result.status).toBe('BLOCKED');
    expect(result.blockers).toContain('CUTOVER_CANDIDATE_ACCOUNTING_MISMATCH');
  });

  it('blocks prepared runs that still have blocked products', () => {
    const result = evaluatePublishingCutoverIntegrity({
      expectedSnapshotCount: 10,
      cutover: { ...prepared, eligibleCount: 9, blockedCount: 1 },
    });
    expect(result.status).toBe('BLOCKED');
    expect(result.blockers).toContain('CUTOVER_HAS_BLOCKED_PRODUCTS');
  });

  it('keeps executed runs in review until verification evidence exists', () => {
    const result = evaluatePublishingCutoverIntegrity({
      expectedSnapshotCount: 10,
      cutover: { ...prepared, status: 'EXECUTED', affectedCount: 7 },
    });
    expect(result.status).toBe('REVIEW');
    expect(result.warnings).toContain('CUTOVER_VERIFICATION_PENDING');
  });

  it('passes verified metrics that reproduce the canonical gate equation', () => {
    const result = evaluatePublishingCutoverIntegrity({
      expectedSnapshotCount: 10,
      cutover: {
        ...prepared,
        status: 'VERIFIED',
        affectedCount: 7,
        verificationMetrics: {
          expected_visible_count: 10,
          actual_visible_count: 10,
          missing_visible_count: 0,
          outside_visible_baseline_count: 2,
          outside_visible_current_count: 2,
          revalidation_failure_count: 0,
          storefront_projection_count: 12,
        },
      },
    });
    expect(result).toEqual({ status: 'PASS', blockers: [], warnings: [] });
  });

  it('blocks a VERIFIED run when stored metrics reveal drift', () => {
    const result = evaluatePublishingCutoverIntegrity({
      expectedSnapshotCount: 10,
      cutover: {
        ...prepared,
        status: 'VERIFIED',
        affectedCount: 7,
        verificationMetrics: {
          expected_visible_count: 10,
          actual_visible_count: 9,
          missing_visible_count: 1,
          outside_visible_baseline_count: 2,
          outside_visible_current_count: 3,
          revalidation_failure_count: 1,
          storefront_projection_count: 12,
        },
      },
    });
    expect(result.status).toBe('BLOCKED');
    expect(result.blockers).toContain('VERIFICATION_ACTUAL_COUNT_MISMATCH');
    expect(result.blockers).toContain('VERIFICATION_OUTSIDE_VISIBILITY_DRIFT');
    expect(result.blockers).toContain('VERIFICATION_REVALIDATION_FAILURES');
  });
});
