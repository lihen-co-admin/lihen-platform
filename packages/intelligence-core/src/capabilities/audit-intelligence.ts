import type {
  CorrelationId,
  IntelligenceDecision,
  IntelligenceEvidence,
} from '../contracts';
import type {
  IntelligenceOrchestratorExecution,
  IntelligenceOrchestratorRequest,
  IntelligenceCapabilityExecutionInput,
  IntelligenceCapabilityExecutionOutput,
  IntelligenceCapabilityHandler,
} from '../orchestrator';
import type {
  ControlledOperationAuditEvent,
} from '../control-plane';

export type UnifiedIntelligenceAuditEventKind =
  | 'REQUEST'
  | 'PERMISSION_DECISION'
  | 'CAPABILITY_EXECUTED'
  | 'EVIDENCE_CREATED'
  | 'CANDIDATE_CREATED'
  | 'RECOMMENDATION_CREATED'
  | 'RESULT'
  | 'HUMAN_DECISION'
  | 'CONTROL_PLANE_EVENT';

export type UnifiedIntelligenceAuditSource =
  | 'INTELLIGENCE_ORCHESTRATOR'
  | 'HUMAN_REVIEW'
  | 'CONTROL_PLANE';

export interface UnifiedIntelligenceAuditEvent {
  readonly eventId: string;
  readonly correlationId: CorrelationId;
  readonly kind: UnifiedIntelligenceAuditEventKind;
  readonly source: UnifiedIntelligenceAuditSource;
  readonly occurredAt: string;
  readonly actorId?: string;
  readonly capability?: string;
  readonly subjectId?: string;
  readonly status?: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface IntelligenceOrchestrationAuditInput {
  readonly request: IntelligenceOrchestratorRequest;
  readonly execution: IntelligenceOrchestratorExecution;
  readonly observedAt: string;
}

export interface ControlPlaneAuditBinding {
  readonly correlationId: CorrelationId;
  readonly event: ControlledOperationAuditEvent;
}

export interface UnifiedIntelligenceAuditTrail {
  readonly events: readonly UnifiedIntelligenceAuditEvent[];
  readonly correlationIds: readonly CorrelationId[];
  readonly sourceCounts: Readonly<
    Record<UnifiedIntelligenceAuditSource, number>
  >;
}

function requiredText(value: string, code: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(code);
  return normalized;
}

function toIsoString(value: Date | string, code: string): string {
  const raw = value instanceof Date ? value.toISOString() : value;
  const normalized = requiredText(raw, code);
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) throw new Error(code);
  return parsed.toISOString();
}

function orchestrationEvents(
  input: IntelligenceOrchestrationAuditInput,
): readonly UnifiedIntelligenceAuditEvent[] {
  if (
    input.execution.result.correlationId !== input.request.correlationId
  ) {
    throw new Error('AUDIT_ORCHESTRATION_CORRELATION_MISMATCH');
  }

  const occurredAt = toIsoString(
    input.observedAt,
    'AUDIT_OBSERVED_AT_INVALID',
  );
  const base = `orchestration:${input.request.requestId}`;
  const events: UnifiedIntelligenceAuditEvent[] = [
    {
      eventId: `${base}:request`,
      correlationId: input.request.correlationId,
      kind: 'REQUEST',
      source: 'INTELLIGENCE_ORCHESTRATOR',
      occurredAt,
      actorId: input.request.requestedBy,
      payload: {
        requestId: input.request.requestId,
        intentId: input.request.intent.intentId,
        expectedOutput: input.request.intent.expectedOutput,
        requestedCapabilities: input.request.intent.requestedCapabilities,
        contextType: input.request.context.type,
        ...(input.request.context.entityId === undefined
          ? {}
          : { entityId: input.request.context.entityId }),
      },
    },
  ];

  input.execution.permissionDecisions.forEach((decision, index) => {
    events.push({
      eventId: `${base}:permission:${index + 1}:${decision.permission}`,
      correlationId: input.request.correlationId,
      kind: 'PERMISSION_DECISION',
      source: 'INTELLIGENCE_ORCHESTRATOR',
      occurredAt,
      actorId: input.request.principal.actorId,
      status: decision.allowed ? 'ALLOWED' : 'DENIED',
      payload: {
        permission: decision.permission,
        actionClass: decision.actionClass,
        reason: decision.reason,
      },
    });
  });

  input.execution.executedCapabilities.forEach((capability, index) => {
    events.push({
      eventId: `${base}:capability:${index + 1}:${capability}`,
      correlationId: input.request.correlationId,
      kind: 'CAPABILITY_EXECUTED',
      source: 'INTELLIGENCE_ORCHESTRATOR',
      occurredAt,
      actorId: input.request.requestedBy,
      capability,
      payload: {
        capability,
      },
    });
  });

  for (const evidence of input.execution.evidence) {
    if (evidence.correlationId !== input.request.correlationId) {
      throw new Error('AUDIT_EVIDENCE_CORRELATION_MISMATCH');
    }
    events.push({
      eventId: `${base}:evidence:${evidence.evidenceId}`,
      correlationId: evidence.correlationId,
      kind: 'EVIDENCE_CREATED',
      source: 'INTELLIGENCE_ORCHESTRATOR',
      occurredAt: toIsoString(
        evidence.createdAt,
        'AUDIT_EVIDENCE_CREATED_AT_INVALID',
      ),
      capability: evidence.capability,
      subjectId: evidence.evidenceId,
      payload: {
        fingerprint: evidence.fingerprint,
        sourceAuthority: evidence.sourceAuthority.level,
        confidence: evidence.confidence.score,
      },
    });
  }

  for (const candidate of input.execution.candidates) {
    if (candidate.correlationId !== input.request.correlationId) {
      throw new Error('AUDIT_CANDIDATE_CORRELATION_MISMATCH');
    }
    events.push({
      eventId: `${base}:candidate:${candidate.candidateId}`,
      correlationId: candidate.correlationId,
      kind: 'CANDIDATE_CREATED',
      source: 'INTELLIGENCE_ORCHESTRATOR',
      occurredAt: toIsoString(
        candidate.createdAt,
        'AUDIT_CANDIDATE_CREATED_AT_INVALID',
      ),
      subjectId: candidate.candidateId,
      status: candidate.status,
      payload: {
        candidateType: candidate.type,
        evidenceIds: candidate.evidenceIds,
        confidence: candidate.confidence.score,
      },
    });
  }

  for (const recommendation of input.execution.recommendations) {
    if (recommendation.correlationId !== input.request.correlationId) {
      throw new Error('AUDIT_RECOMMENDATION_CORRELATION_MISMATCH');
    }
    events.push({
      eventId: `${base}:recommendation:${recommendation.recommendationId}`,
      correlationId: recommendation.correlationId,
      kind: 'RECOMMENDATION_CREATED',
      source: 'INTELLIGENCE_ORCHESTRATOR',
      occurredAt: toIsoString(
        recommendation.createdAt,
        'AUDIT_RECOMMENDATION_CREATED_AT_INVALID',
      ),
      subjectId: recommendation.recommendationId,
      status: recommendation.status,
      payload: {
        actionType: recommendation.actionType,
        riskLevel: recommendation.risk.level,
        requiresHumanReview: recommendation.risk.requiresHumanReview,
        evidenceIds: recommendation.evidenceIds,
      },
    });
  }

  events.push({
    eventId: `${base}:result`,
    correlationId: input.request.correlationId,
    kind: 'RESULT',
    source: 'INTELLIGENCE_ORCHESTRATOR',
    occurredAt,
    actorId: input.request.requestedBy,
    status: input.execution.result.status,
    payload: {
      executedCapabilities: input.execution.executedCapabilities,
      evidenceIds: input.execution.result.evidenceIds,
      candidateIds: input.execution.result.candidateIds,
      recommendationIds: input.execution.result.recommendationIds,
      messages: input.execution.result.messages,
    },
  });

  return events;
}

function decisionEvent(
  decision: IntelligenceDecision,
): UnifiedIntelligenceAuditEvent {
  return {
    eventId: `human-decision:${decision.decisionId}`,
    correlationId: decision.correlationId,
    kind: 'HUMAN_DECISION',
    source: 'HUMAN_REVIEW',
    occurredAt: toIsoString(
      decision.decidedAt,
      'AUDIT_DECISION_DECIDED_AT_INVALID',
    ),
    actorId: decision.decidedBy,
    subjectId:
      decision.recommendationId
      ?? decision.candidateId
      ?? decision.decisionId,
    status: decision.decision,
    payload: {
      decisionId: decision.decisionId,
      reason: decision.reason,
      ...(decision.recommendationId === undefined
        ? {}
        : { recommendationId: decision.recommendationId }),
      ...(decision.candidateId === undefined
        ? {}
        : { candidateId: decision.candidateId }),
    },
  };
}

function controlPlaneEvent(
  binding: ControlPlaneAuditBinding,
): UnifiedIntelligenceAuditEvent {
  const event = binding.event;
  const occurredAt = toIsoString(
    event.occurredAt,
    'AUDIT_CONTROL_PLANE_OCCURRED_AT_INVALID',
  );
  const status =
    typeof event.resultSnapshot.status === 'string'
      ? event.resultSnapshot.status
      : undefined;

  return {
    eventId:
      `control-plane:${event.domainCode}:${event.operationType}:`
      + `${event.requestFingerprint}:${occurredAt}`,
    correlationId: requiredText(
      binding.correlationId,
      'AUDIT_CONTROL_PLANE_CORRELATION_REQUIRED',
    ),
    kind: 'CONTROL_PLANE_EVENT',
    source: 'CONTROL_PLANE',
    occurredAt,
    actorId: event.actorId,
    ...(event.entityId === null
      ? {}
      : { subjectId: event.entityId }),
    ...(status === undefined ? {} : { status }),
    payload: {
      domainCode: event.domainCode,
      operationType: event.operationType,
      operationKey: event.operationKey,
      requestFingerprint: event.requestFingerprint,
      resultSnapshot: event.resultSnapshot,
    },
  };
}

export function buildUnifiedIntelligenceAuditTrail(input: {
  readonly orchestrations?: readonly IntelligenceOrchestrationAuditInput[];
  readonly decisions?: readonly IntelligenceDecision[];
  readonly controlPlaneEvents?: readonly ControlPlaneAuditBinding[];
}): UnifiedIntelligenceAuditTrail {
  const events: UnifiedIntelligenceAuditEvent[] = [
    ...(input.orchestrations ?? []).flatMap(orchestrationEvents),
    ...(input.decisions ?? []).map(decisionEvent),
    ...(input.controlPlaneEvents ?? []).map(controlPlaneEvent),
  ];

  const seen = new Set<string>();
  for (const event of events) {
    requiredText(event.correlationId, 'AUDIT_CORRELATION_REQUIRED');
    if (seen.has(event.eventId)) {
      throw new Error(`DUPLICATE_AUDIT_EVENT_ID:${event.eventId}`);
    }
    seen.add(event.eventId);
  }

  const sorted = [...events].sort((left, right) => {
    const time = left.occurredAt.localeCompare(right.occurredAt);
    return time !== 0 ? time : left.eventId.localeCompare(right.eventId);
  });

  const correlationIds = [...new Set(sorted.map((event) => event.correlationId))];

  const sourceCounts: Record<UnifiedIntelligenceAuditSource, number> = {
    INTELLIGENCE_ORCHESTRATOR: 0,
    HUMAN_REVIEW: 0,
    CONTROL_PLANE: 0,
  };
  for (const event of sorted) sourceCounts[event.source] += 1;

  return {
    events: sorted,
    correlationIds,
    sourceCounts,
  };
}

export interface AuditSnapshot {
  readonly snapshotId: string;
  readonly events: readonly UnifiedIntelligenceAuditEvent[];
}

function readAuditSnapshot(
  input: IntelligenceCapabilityExecutionInput,
): AuditSnapshot {
  const raw = input.context.attributes.auditSnapshot;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('AUDIT_SNAPSHOT_REQUIRED');
  }

  const value = raw as Record<string, unknown>;
  if (
    typeof value.snapshotId !== 'string'
    || !Array.isArray(value.events)
  ) {
    throw new Error('AUDIT_SNAPSHOT_INVALID');
  }

  const events = value.events as UnifiedIntelligenceAuditEvent[];
  for (const event of events) {
    if (
      !event
      || typeof event.eventId !== 'string'
      || typeof event.correlationId !== 'string'
      || typeof event.kind !== 'string'
      || typeof event.source !== 'string'
      || typeof event.occurredAt !== 'string'
      || !event.payload
      || typeof event.payload !== 'object'
    ) {
      throw new Error('AUDIT_SNAPSHOT_EVENT_INVALID');
    }
  }

  return {
    snapshotId: value.snapshotId,
    events,
  };
}

function auditSummaryEvidence(input: {
  readonly correlationId: CorrelationId;
  readonly capabilityInput: IntelligenceCapabilityExecutionInput;
  readonly snapshot: AuditSnapshot;
}): IntelligenceEvidence {
  const sourceCounts: Record<UnifiedIntelligenceAuditSource, number> = {
    INTELLIGENCE_ORCHESTRATOR: 0,
    HUMAN_REVIEW: 0,
    CONTROL_PLANE: 0,
  };
  const correlationIds = new Set<string>();

  for (const event of input.snapshot.events) {
    correlationIds.add(event.correlationId);
    if (event.source in sourceCounts) {
      sourceCounts[event.source as UnifiedIntelligenceAuditSource] += 1;
    }
  }

  return {
    evidenceId: `audit-summary:${input.snapshot.snapshotId}`,
    correlationId: input.correlationId,
    context: input.capabilityInput.context,
    capability: 'AUDIT_INTELLIGENCE',
    sourceAuthority: {
      level: 'FIRST_PARTY',
      sourceName: 'unified-intelligence-audit',
      rationale: [
        'Summary is derived from governed first-party audit projections.',
        'The audit projection does not replace source-system audit authorities.',
      ],
    },
    observation:
      `Unified audit snapshot contains ${input.snapshot.events.length} event(s) across ${correlationIds.size} correlation id(s).`,
    payload: {
      snapshotId: input.snapshot.snapshotId,
      eventCount: input.snapshot.events.length,
      correlationIds: [...correlationIds],
      sourceCounts,
    },
    confidence: {
      score: 1,
      band: 'VERY_HIGH',
      rationale: [
        'Counts are deterministic over the supplied governed audit snapshot.',
        'Audit confidence does not grant execution or mutation authority.',
      ],
    },
    fingerprint:
      `audit-summary|${input.snapshot.snapshotId}|${input.snapshot.events.length}`,
    createdAt: new Date().toISOString(),
  };
}

export function createAuditIntelligenceHandler(): IntelligenceCapabilityHandler {
  return {
    capability: 'AUDIT_INTELLIGENCE',
    async execute(
      input: IntelligenceCapabilityExecutionInput,
    ): Promise<IntelligenceCapabilityExecutionOutput> {
      const snapshot = readAuditSnapshot(input);
      const evidence = auditSummaryEvidence({
        correlationId: input.correlationId,
        capabilityInput: input,
        snapshot,
      });

      return {
        capability: 'AUDIT_INTELLIGENCE',
        evidence: [evidence],
        candidates: [],
        recommendations: [],
        messages: [
          'Unified Intelligence audit snapshot summarized in read-only mode.',
          'No source audit record, decision or controlled operation was mutated.',
        ],
      };
    },
  };
}
