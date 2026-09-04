import type {
  Confidence,
  IntelligenceContext,
  IntelligenceEvidence,
  IntelligenceRecommendation,
} from '../contracts';
import type {
  IntelligenceCapabilityExecutionInput,
  IntelligenceCapabilityExecutionOutput,
  IntelligenceCapabilityHandler,
} from '../orchestrator';

export interface AnalyticsMetricPoint {
  readonly metricId: string;
  readonly label: string;
  readonly value: number;
  readonly previousValue?: number;
  readonly unit?: string;
  readonly expectedMin?: number;
  readonly expectedMax?: number;
}

export interface AnalyticsSnapshot {
  readonly snapshotId: string;
  readonly sourceName: string;
  readonly capturedAt: string;
  readonly metrics: readonly AnalyticsMetricPoint[];
}

export type AnalyticsSignalKind =
  | 'CURRENT_VALUE'
  | 'DELTA'
  | 'RATIO_CHANGE'
  | 'OUT_OF_EXPECTED_RANGE';

export interface AnalyticsSignal {
  readonly signalId: string;
  readonly metricId: string;
  readonly kind: AnalyticsSignalKind;
  readonly value: number;
  readonly previousValue?: number;
  readonly delta?: number;
  readonly ratioChange?: number;
  readonly expectedMin?: number;
  readonly expectedMax?: number;
  readonly requiresReview: boolean;
}

export interface AnalyticsIntelligenceResult {
  readonly snapshotId: string;
  readonly signals: readonly AnalyticsSignal[];
  readonly evidence: readonly IntelligenceEvidence[];
  readonly recommendations: readonly IntelligenceRecommendation[];
}

function requiredText(value: string, code: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(code);
  return normalized;
}

function assertFinite(value: number, code: string): number {
  if (!Number.isFinite(value)) throw new Error(code);
  return value;
}

function metricConfidence(metric: AnalyticsMetricPoint): Confidence {
  const hasPrevious = metric.previousValue !== undefined;
  const hasExpectedRange =
    metric.expectedMin !== undefined || metric.expectedMax !== undefined;

  return {
    score: hasPrevious || hasExpectedRange ? 0.9 : 0.75,
    band: hasPrevious || hasExpectedRange ? 'VERY_HIGH' : 'HIGH',
    rationale: [
      'Signal is computed deterministically from the governed metric snapshot.',
      'Confidence describes calculation quality; it does not authorize mutation.',
    ],
  };
}

function metricSignals(metric: AnalyticsMetricPoint): readonly AnalyticsSignal[] {
  const signals: AnalyticsSignal[] = [
    {
      signalId: `${metric.metricId}:current`,
      metricId: metric.metricId,
      kind: 'CURRENT_VALUE',
      value: metric.value,
      requiresReview: false,
    },
  ];

  if (metric.previousValue !== undefined) {
    const delta = metric.value - metric.previousValue;

    signals.push({
      signalId: `${metric.metricId}:delta`,
      metricId: metric.metricId,
      kind: 'DELTA',
      value: metric.value,
      previousValue: metric.previousValue,
      delta,
      requiresReview: false,
    });

    if (metric.previousValue !== 0) {
      signals.push({
        signalId: `${metric.metricId}:ratio-change`,
        metricId: metric.metricId,
        kind: 'RATIO_CHANGE',
        value: metric.value,
        previousValue: metric.previousValue,
        delta,
        ratioChange: delta / Math.abs(metric.previousValue),
        requiresReview: false,
      });
    }
  }

  const belowMin =
    metric.expectedMin !== undefined && metric.value < metric.expectedMin;
  const aboveMax =
    metric.expectedMax !== undefined && metric.value > metric.expectedMax;

  if (belowMin || aboveMax) {
    signals.push({
      signalId: `${metric.metricId}:range`,
      metricId: metric.metricId,
      kind: 'OUT_OF_EXPECTED_RANGE',
      value: metric.value,
      ...(metric.expectedMin === undefined
        ? {}
        : { expectedMin: metric.expectedMin }),
      ...(metric.expectedMax === undefined
        ? {}
        : { expectedMax: metric.expectedMax }),
      requiresReview: true,
    });
  }

  return signals;
}

function metricEvidence(
  input: {
    readonly correlationId: string;
    readonly context: IntelligenceContext;
    readonly snapshot: AnalyticsSnapshot;
    readonly metric: AnalyticsMetricPoint;
    readonly signals: readonly AnalyticsSignal[];
  },
): IntelligenceEvidence {
  const confidence = metricConfidence(input.metric);

  return {
    evidenceId: `analytics:${input.snapshot.snapshotId}:${input.metric.metricId}`,
    correlationId: input.correlationId,
    context: input.context,
    capability: 'ANALYTICS',
    sourceAuthority: {
      level: 'FIRST_PARTY',
      sourceName: input.snapshot.sourceName,
      rationale: [
        'Analytics consumes a governed first-party metric snapshot.',
        'Computed signals are derived observations, not a replacement for source metrics.',
      ],
    },
    observation:
      `Analytics computed ${input.signals.length} signal(s) for ${input.metric.label}.`,
    payload: {
      metricId: input.metric.metricId,
      label: input.metric.label,
      value: input.metric.value,
      ...(input.metric.previousValue === undefined
        ? {}
        : { previousValue: input.metric.previousValue }),
      ...(input.metric.unit === undefined ? {} : { unit: input.metric.unit }),
      signals: input.signals,
      snapshotCapturedAt: input.snapshot.capturedAt,
    },
    confidence,
    fingerprint:
      `analytics|${input.snapshot.snapshotId}|${input.metric.metricId}|${input.metric.value}|${input.metric.previousValue ?? ''}`,
    createdAt: input.snapshot.capturedAt,
  };
}

function reviewRecommendation(
  input: {
    readonly correlationId: string;
    readonly context: IntelligenceContext;
    readonly snapshot: AnalyticsSnapshot;
    readonly metric: AnalyticsMetricPoint;
    readonly evidenceId: string;
    readonly signal: AnalyticsSignal;
  },
): IntelligenceRecommendation {
  const confidence = metricConfidence(input.metric);

  return {
    recommendationId:
      `analytics-review:${input.snapshot.snapshotId}:${input.metric.metricId}`,
    correlationId: input.correlationId,
    context: input.context,
    actionType: 'REVIEW_ANALYTICS_SIGNAL',
    title: `Review analytics signal: ${input.metric.label}`,
    explanation:
      'A deterministic metric signal is outside the configured expected range and requires human review.',
    priority: 'P2',
    severity: 'WARNING',
    source: 'ANALYTICS',
    rationale: [
      `Observed value: ${input.signal.value}.`,
      ...(input.signal.expectedMin === undefined
        ? []
        : [`Expected minimum: ${input.signal.expectedMin}.`]),
      ...(input.signal.expectedMax === undefined
        ? []
        : [`Expected maximum: ${input.signal.expectedMax}.`]),
      'Analytics does not execute corrective actions automatically.',
    ],
    evidenceIds: [input.evidenceId],
    confidence,
    risk: {
      level: 'R1',
      reasons: [
        'The signal may require operational investigation.',
        'No domain mutation is authorized by the analytics result.',
      ],
      requiresHumanReview: true,
    },
    status: 'OPEN',
    createdAt: input.snapshot.capturedAt,
  };
}

export function evaluateAnalyticsSnapshot(
  input: {
    readonly correlationId: string;
    readonly context: IntelligenceContext;
    readonly snapshot: AnalyticsSnapshot;
  },
): AnalyticsIntelligenceResult {
  const snapshotId = requiredText(
    input.snapshot.snapshotId,
    'ANALYTICS_SNAPSHOT_ID_REQUIRED',
  );
  requiredText(input.snapshot.sourceName, 'ANALYTICS_SOURCE_NAME_REQUIRED');
  requiredText(input.snapshot.capturedAt, 'ANALYTICS_CAPTURED_AT_REQUIRED');

  const metricIds = new Set<string>();
  const allSignals: AnalyticsSignal[] = [];
  const evidence: IntelligenceEvidence[] = [];
  const recommendations: IntelligenceRecommendation[] = [];

  for (const metric of input.snapshot.metrics) {
    const metricId = requiredText(
      metric.metricId,
      'ANALYTICS_METRIC_ID_REQUIRED',
    );
    requiredText(metric.label, 'ANALYTICS_METRIC_LABEL_REQUIRED');
    assertFinite(metric.value, 'ANALYTICS_METRIC_VALUE_INVALID');

    if (metric.previousValue !== undefined) {
      assertFinite(
        metric.previousValue,
        'ANALYTICS_METRIC_PREVIOUS_VALUE_INVALID',
      );
    }
    if (metric.expectedMin !== undefined) {
      assertFinite(metric.expectedMin, 'ANALYTICS_EXPECTED_MIN_INVALID');
    }
    if (metric.expectedMax !== undefined) {
      assertFinite(metric.expectedMax, 'ANALYTICS_EXPECTED_MAX_INVALID');
    }
    if (
      metric.expectedMin !== undefined
      && metric.expectedMax !== undefined
      && metric.expectedMin > metric.expectedMax
    ) {
      throw new Error('ANALYTICS_EXPECTED_RANGE_INVALID');
    }
    if (metricIds.has(metricId)) {
      throw new Error('ANALYTICS_METRIC_ID_DUPLICATE');
    }
    metricIds.add(metricId);

    const signals = metricSignals(metric);
    allSignals.push(...signals);

    const metricEvidenceItem = metricEvidence({
      correlationId: input.correlationId,
      context: input.context,
      snapshot: { ...input.snapshot, snapshotId },
      metric,
      signals,
    });
    evidence.push(metricEvidenceItem);

    const reviewSignal = signals.find(
      (signal) =>
        signal.kind === 'OUT_OF_EXPECTED_RANGE' && signal.requiresReview,
    );
    if (reviewSignal) {
      recommendations.push(
        reviewRecommendation({
          correlationId: input.correlationId,
          context: input.context,
          snapshot: { ...input.snapshot, snapshotId },
          metric,
          evidenceId: metricEvidenceItem.evidenceId,
          signal: reviewSignal,
        }),
      );
    }
  }

  return {
    snapshotId,
    signals: allSignals,
    evidence,
    recommendations,
  };
}

function readAnalyticsSnapshot(
  input: IntelligenceCapabilityExecutionInput,
): AnalyticsSnapshot {
  const raw = input.context.attributes.analyticsSnapshot;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('ANALYTICS_SNAPSHOT_REQUIRED');
  }

  const value = raw as Record<string, unknown>;
  if (
    typeof value.snapshotId !== 'string'
    || typeof value.sourceName !== 'string'
    || typeof value.capturedAt !== 'string'
    || !Array.isArray(value.metrics)
  ) {
    throw new Error('ANALYTICS_SNAPSHOT_INVALID');
  }

  const metrics: AnalyticsMetricPoint[] = value.metrics.map((rawMetric) => {
    if (!rawMetric || typeof rawMetric !== 'object' || Array.isArray(rawMetric)) {
      throw new Error('ANALYTICS_METRIC_INVALID');
    }

    const metric = rawMetric as Record<string, unknown>;
    if (
      typeof metric.metricId !== 'string'
      || typeof metric.label !== 'string'
      || typeof metric.value !== 'number'
    ) {
      throw new Error('ANALYTICS_METRIC_INVALID');
    }

    return {
      metricId: metric.metricId,
      label: metric.label,
      value: metric.value,
      ...(typeof metric.previousValue === 'number'
        ? { previousValue: metric.previousValue }
        : {}),
      ...(typeof metric.unit === 'string' ? { unit: metric.unit } : {}),
      ...(typeof metric.expectedMin === 'number'
        ? { expectedMin: metric.expectedMin }
        : {}),
      ...(typeof metric.expectedMax === 'number'
        ? { expectedMax: metric.expectedMax }
        : {}),
    };
  });

  return {
    snapshotId: value.snapshotId,
    sourceName: value.sourceName,
    capturedAt: value.capturedAt,
    metrics,
  };
}

export function createAnalyticsIntelligenceHandler(): IntelligenceCapabilityHandler {
  return {
    capability: 'ANALYTICS',
    async execute(
      input: IntelligenceCapabilityExecutionInput,
    ): Promise<IntelligenceCapabilityExecutionOutput> {
      const analytics = evaluateAnalyticsSnapshot({
        correlationId: input.correlationId,
        context: input.context,
        snapshot: readAnalyticsSnapshot(input),
      });

      return {
        capability: 'ANALYTICS',
        evidence: analytics.evidence,
        candidates: [],
        recommendations: analytics.recommendations,
        messages: [
          `${analytics.signals.length} deterministic analytics signal(s) computed from governed context.`,
          'Analytics remains read-only and does not execute corrective actions.',
        ],
      };
    },
  };
}
