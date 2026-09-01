import type {
  CorrelationId,
  IntelligenceDecision,
  IntelligenceRecommendation,
} from './contracts';

/**
 * GAP-008 — Intelligence ↔ Existing Control Plane
 *
 * This module defines the governed handoff from an approved Intelligence recommendation
 * to LIHEN's existing operational control plane.
 *
 * It deliberately does not implement SQL, RPC, persistence, release, canary or mutation.
 * Those responsibilities remain behind ExistingControlPlanePort.
 */

export interface ControlledOperationPayloadValidation {
  readonly operationCode: string;
  readonly valid: boolean;
  readonly missingRequiredKeys: readonly string[];
  readonly unexpectedKeys: readonly string[];
  readonly executionEnabled: boolean;
  readonly validationNote: string;
}

export interface ControlledOperationPreview {
  readonly intentId: string;
  readonly operationKey: string;
  readonly operationCode: string;
  readonly domainCode: string;
  readonly riskLevel: string;
  readonly requiresConfirmation: boolean;
  readonly executionEnabled: boolean;
  readonly status: string;
  readonly confirmationToken: string;
  readonly previewSnapshot: Readonly<Record<string, unknown>>;
  readonly expiresAt: Date;
}

export interface ControlledOperationConfirmation {
  readonly intentId: string;
  readonly operationCode: string;
  readonly status: string;
  readonly confirmedAt: Date | null;
  readonly executionEnabled: boolean;
  readonly executionNote: string;
}

export interface ControlledOperationAuditEvent {
  readonly domainCode: string;
  readonly operationType: string;
  readonly operationKey: string;
  readonly actorId: string;
  readonly entityId: string | null;
  readonly requestFingerprint: string;
  readonly resultSnapshot: Readonly<Record<string, unknown>>;
  readonly occurredAt: Date;
}

export interface ExistingControlPlanePort {
  validateOperationPayload(
    operationCode: string,
    requestPayload: Record<string, unknown>,
  ): Promise<ControlledOperationPayloadValidation>;

  prepareOperation(
    operationKey: string,
    operationCode: string,
    requestPayload: Record<string, unknown>,
  ): Promise<ControlledOperationPreview>;

  confirmOperation(
    intentId: string,
    confirmationToken: string,
  ): Promise<ControlledOperationConfirmation>;

  getAuditTimeline(
    limit?: number,
    offset?: number,
    domainCode?: string | null,
  ): Promise<readonly ControlledOperationAuditEvent[]>;
}

export interface RecommendationOperationMapping {
  readonly operationCode: string;
  readonly operationKey: string;
  readonly requestPayload: Record<string, unknown>;
}

export interface ControlledActionRequest {
  readonly correlationId: CorrelationId;
  readonly recommendationId: string;
  readonly decisionId: string;
  readonly operationCode: string;
  readonly operationKey: string;
  readonly requestPayload: Record<string, unknown>;
}

export type ControlledActionPreparationStatus =
  | 'READY_FOR_CONFIRMATION'
  | 'BLOCKED';

export interface ControlledActionPreparation {
  readonly status: ControlledActionPreparationStatus;
  readonly request?: ControlledActionRequest;
  readonly validation?: ControlledOperationPayloadValidation;
  readonly preview?: ControlledOperationPreview;
  readonly reasons: readonly string[];
}

export type ControlledActionRequestBuildResult =
  | {
      readonly ok: true;
      readonly request: ControlledActionRequest;
    }
  | {
      readonly ok: false;
      readonly reasons: readonly string[];
    };

export function buildControlledActionRequest(
  recommendation: IntelligenceRecommendation,
  decision: IntelligenceDecision,
  mapping: RecommendationOperationMapping,
): ControlledActionRequestBuildResult {
  const reasons: string[] = [];

  if (decision.decision !== 'APPROVE') {
    reasons.push('HUMAN_DECISION_NOT_APPROVED');
  }

  if (!decision.recommendationId) {
    reasons.push('DECISION_RECOMMENDATION_REQUIRED');
  } else if (decision.recommendationId !== recommendation.recommendationId) {
    reasons.push('DECISION_RECOMMENDATION_MISMATCH');
  }

  if (decision.correlationId !== recommendation.correlationId) {
    reasons.push('CORRELATION_MISMATCH');
  }

  if (recommendation.status === 'REJECTED' || recommendation.status === 'SUPERSEDED') {
    reasons.push('RECOMMENDATION_NOT_ACTIONABLE');
  }

  if (!mapping.operationCode.trim()) {
    reasons.push('OPERATION_CODE_REQUIRED');
  }

  if (!mapping.operationKey.trim()) {
    reasons.push('OPERATION_KEY_REQUIRED');
  }

  if (reasons.length > 0) {
    return { ok: false, reasons };
  }

  return {
    ok: true,
    request: {
      correlationId: recommendation.correlationId,
      recommendationId: recommendation.recommendationId,
      decisionId: decision.decisionId,
      operationCode: mapping.operationCode,
      operationKey: mapping.operationKey,
      requestPayload: mapping.requestPayload,
    },
  };
}

/**
 * Prepares, but never confirms or executes, an operation.
 *
 * Required path:
 * Recommendation -> Human Decision(APPROVE) -> payload validation -> existing
 * Operation Intent/Preview.
 */
export async function prepareApprovedRecommendationForControlPlane(input: {
  readonly recommendation: IntelligenceRecommendation;
  readonly decision: IntelligenceDecision;
  readonly mapping: RecommendationOperationMapping;
  readonly controlPlane: ExistingControlPlanePort;
}): Promise<ControlledActionPreparation> {
  const built = buildControlledActionRequest(
    input.recommendation,
    input.decision,
    input.mapping,
  );

  if (!built.ok) {
    return {
      status: 'BLOCKED',
      reasons: built.reasons,
    };
  }

  const validation = await input.controlPlane.validateOperationPayload(
    built.request.operationCode,
    built.request.requestPayload,
  );

  if (!validation.valid) {
    return {
      status: 'BLOCKED',
      request: built.request,
      validation,
      reasons: ['CONTROL_PLANE_PAYLOAD_INVALID'],
    };
  }

  const preview = await input.controlPlane.prepareOperation(
    built.request.operationKey,
    built.request.operationCode,
    built.request.requestPayload,
  );

  return {
    status: 'READY_FOR_CONFIRMATION',
    request: built.request,
    validation,
    preview,
    reasons: [],
  };
}

/**
 * Confirmation is an explicit application/human-control step.
 * The Orchestrator does not call this automatically.
 */
export async function confirmPreparedControlPlaneIntent(input: {
  readonly preparation: ControlledActionPreparation;
  readonly confirmationToken: string;
  readonly controlPlane: ExistingControlPlanePort;
}): Promise<ControlledOperationConfirmation> {
  if (
    input.preparation.status !== 'READY_FOR_CONFIRMATION' ||
    !input.preparation.preview
  ) {
    throw new Error('CONTROL_PLANE_PREPARATION_NOT_CONFIRMABLE');
  }

  if (!input.confirmationToken.trim()) {
    throw new Error('CONFIRMATION_TOKEN_REQUIRED');
  }

  if (
    input.confirmationToken !== input.preparation.preview.confirmationToken
  ) {
    throw new Error('CONFIRMATION_TOKEN_MISMATCH');
  }

  return input.controlPlane.confirmOperation(
    input.preparation.preview.intentId,
    input.confirmationToken,
  );
}
