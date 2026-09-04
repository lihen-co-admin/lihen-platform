import { describe, expect, it } from 'vitest';
import {
  createAnalyticsIntelligenceHandler,
  evaluateAnalyticsSnapshot,
  INTELLIGENCE_PERMISSION,
  orchestrateIntelligenceRequest,
} from '../src';
import type { PermissionPrincipal } from '../src';

const context = {
  contextId: 'ctx-analytics',
  type: 'GLOBAL' as const,
  attributes: {
    analyticsSnapshot: {
      snapshotId: 'snapshot-1',
      sourceName: 'operational_dashboard_summary',
      capturedAt: '2026-09-04T12:00:00Z',
      metrics: [
        {
          metricId: 'sales_total_cop',
          label: 'Sales total',
          value: 1200000,
          previousValue: 1000000,
          unit: 'COP',
        },
        {
          metricId: 'integrity_issue_count',
          label: 'Integrity issues',
          value: 3,
          previousValue: 0,
          expectedMin: 0,
          expectedMax: 0,
        },
      ],
    },
  },
};

const allowedPrincipal: PermissionPrincipal = {
  actorId: 'analytics-intelligence',
  actorType: 'INTELLIGENCE',
  grants: [
    {
      permission: INTELLIGENCE_PERMISSION.READ_CONTEXT,
      effect: 'ALLOW',
      source: 'test',
    },
    {
      permission: INTELLIGENCE_PERMISSION.ANALYZE,
      effect: 'ALLOW',
      source: 'test',
    },
  ],
};

describe('WAVE 11 / GAP-037 Analytics Intelligence', () => {
  it('computes deterministic current, delta, ratio and range signals', () => {
    const result = evaluateAnalyticsSnapshot({
      correlationId: 'corr-analytics',
      context,
      snapshot: context.attributes.analyticsSnapshot,
    });

    expect(result.signals.some((item) => item.kind === 'CURRENT_VALUE')).toBe(true);
    expect(result.signals.some((item) => item.kind === 'DELTA')).toBe(true);
    expect(result.signals.some((item) => item.kind === 'RATIO_CHANGE')).toBe(true);
    expect(result.signals.some((item) => item.kind === 'OUT_OF_EXPECTED_RANGE')).toBe(true);
    expect(result.evidence).toHaveLength(2);
  });

  it('creates human-review recommendations only for configured range violations', () => {
    const result = evaluateAnalyticsSnapshot({
      correlationId: 'corr-analytics-review',
      context,
      snapshot: context.attributes.analyticsSnapshot,
    });

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0]?.actionType).toBe('REVIEW_ANALYTICS_SIGNAL');
    expect(result.recommendations[0]?.risk.requiresHumanReview).toBe(true);
    expect(result.recommendations[0]?.status).toBe('OPEN');
  });

  it('uses first-party source authority without replacing metric authority', () => {
    const result = evaluateAnalyticsSnapshot({
      correlationId: 'corr-analytics-source',
      context,
      snapshot: context.attributes.analyticsSnapshot,
    });

    expect(result.evidence[0]?.sourceAuthority.level).toBe('FIRST_PARTY');
    expect(result.evidence[0]?.sourceAuthority.sourceName)
      .toBe('operational_dashboard_summary');
  });

  it('fails closed on duplicate metric ids or invalid expected ranges', () => {
    expect(() =>
      evaluateAnalyticsSnapshot({
        correlationId: 'corr-duplicate',
        context,
        snapshot: {
          snapshotId: 'duplicate',
          sourceName: 'test',
          capturedAt: '2026-09-04T12:00:00Z',
          metrics: [
            { metricId: 'x', label: 'X', value: 1 },
            { metricId: 'x', label: 'X2', value: 2 },
          ],
        },
      }),
    ).toThrow('ANALYTICS_METRIC_ID_DUPLICATE');

    expect(() =>
      evaluateAnalyticsSnapshot({
        correlationId: 'corr-range',
        context,
        snapshot: {
          snapshotId: 'range',
          sourceName: 'test',
          capturedAt: '2026-09-04T12:00:00Z',
          metrics: [
            {
              metricId: 'x',
              label: 'X',
              value: 1,
              expectedMin: 10,
              expectedMax: 2,
            },
          ],
        },
      }),
    ).toThrow('ANALYTICS_EXPECTED_RANGE_INVALID');
  });

  it('is permission-gated by the existing Orchestrator', async () => {
    const execution = await orchestrateIntelligenceRequest(
      {
        handlers: [createAnalyticsIntelligenceHandler()],
      },
      {
        requestId: 'req-analytics-denied',
        correlationId: 'corr-analytics-denied',
        requestedBy: 'owner',
        principal: {
          actorId: 'analytics-intelligence',
          actorType: 'INTELLIGENCE',
          grants: [
            {
              permission: INTELLIGENCE_PERMISSION.READ_CONTEXT,
              effect: 'ALLOW',
              source: 'test',
            },
          ],
        },
        context,
        intent: {
          intentId: 'intent-analytics-denied',
          name: 'Analyze metrics',
          description: 'Analyze governed metrics',
          requestedCapabilities: ['ANALYTICS'],
          requiresVerification: false,
          expectedOutput: 'EVIDENCE',
        },
      },
    );

    expect(execution.result.status).toBe('PERMISSION_DENIED');
    expect(execution.executedCapabilities).toEqual([]);
  });

  it('runs through the existing Orchestrator without candidates or mutations', async () => {
    const execution = await orchestrateIntelligenceRequest(
      {
        handlers: [createAnalyticsIntelligenceHandler()],
      },
      {
        requestId: 'req-analytics',
        correlationId: 'corr-analytics-ok',
        requestedBy: 'owner',
        principal: allowedPrincipal,
        context,
        intent: {
          intentId: 'intent-analytics',
          name: 'Analyze metrics',
          description: 'Analyze governed metrics',
          requestedCapabilities: ['ANALYTICS'],
          requiresVerification: false,
          expectedOutput: 'EVIDENCE',
        },
      },
    );

    expect(execution.executedCapabilities).toEqual(['ANALYTICS']);
    expect(execution.evidence).toHaveLength(2);
    expect(execution.candidates).toEqual([]);
    expect(execution.recommendations).toHaveLength(1);
    expect(execution.result.status).toBe('REQUIRES_REVIEW');
  });
});
