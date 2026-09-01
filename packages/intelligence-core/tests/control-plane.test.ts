import { describe, expect, it, vi } from 'vitest';
import type {
  ExistingControlPlanePort,
  IntelligenceDecision,
  IntelligenceRecommendation,
} from '../src';
import {
  buildControlledActionRequest,
  confirmPreparedControlPlaneIntent,
  prepareApprovedRecommendationForControlPlane,
} from '../src';

function recommendation(): IntelligenceRecommendation {
  return {
    recommendationId: 'rec-1',
    correlationId: 'corr-1',
    context: {
      contextId: 'ctx-1',
      type: 'PRODUCT',
      entityId: 'product-1',
      attributes: {},
    },
    actionType: 'PRODUCT.UPDATE',
    title: 'Update product',
    explanation: 'Evidence supports a controlled update.',
    priority: 'P2',
    severity: 'WARNING',
    source: 'test',
    rationale: ['controlled'],
    evidenceIds: ['ev-1'],
    confidence: {
      score: 0.9,
      band: 'VERY_HIGH',
      rationale: ['test'],
    },
    risk: {
      level: 'R3',
      reasons: ['master change'],
      requiresHumanReview: true,
    },
    status: 'APPROVED',
    createdAt: '2026-09-01T00:00:00.000Z',
  };
}

function decision(value: IntelligenceDecision['decision'] = 'APPROVE'): IntelligenceDecision {
  return {
    decisionId: 'dec-1',
    correlationId: 'corr-1',
    recommendationId: 'rec-1',
    decision: value,
    reason: 'Reviewed by human.',
    decidedBy: 'human-1',
    decidedAt: '2026-09-01T00:01:00.000Z',
  };
}

function controlPlane(valid = true): ExistingControlPlanePort {
  return {
    validateOperationPayload: vi.fn(async (operationCode) => ({
      operationCode,
      valid,
      missingRequiredKeys: valid ? [] : ['name'],
      unexpectedKeys: [],
      executionEnabled: false,
      validationNote: valid ? 'VALID' : 'INVALID',
    })),
    prepareOperation: vi.fn(async (operationKey, operationCode) => ({
      intentId: 'intent-1',
      operationKey,
      operationCode,
      domainCode: 'PRODUCT',
      riskLevel: 'HIGH',
      requiresConfirmation: true,
      executionEnabled: false,
      status: 'PREVIEWED',
      confirmationToken: 'token-1',
      previewSnapshot: {},
      expiresAt: new Date('2026-09-01T01:00:00.000Z'),
    })),
    confirmOperation: vi.fn(async (intentId, confirmationToken) => ({
      intentId,
      operationCode: 'PRODUCT.UPDATE',
      status: 'CONFIRMED',
      confirmedAt: new Date('2026-09-01T00:02:00.000Z'),
      executionEnabled: false,
      executionNote: confirmationToken,
    })),
    getAuditTimeline: vi.fn(async () => []),
  };
}

const mapping = {
  operationCode: 'PRODUCT.UPDATE',
  operationKey: 'corr-1:rec-1',
  requestPayload: { product_id: 'product-1', name: 'Updated' },
};

describe('GAP-008 Intelligence ↔ Existing Control Plane', () => {
  it('builds a controlled request only after an approved human decision', () => {
    const result = buildControlledActionRequest(
      recommendation(),
      decision(),
      mapping,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.request.recommendationId).toBe('rec-1');
      expect(result.request.decisionId).toBe('dec-1');
    }
  });

  it('blocks rejected/deferred decisions before touching the control plane', async () => {
    const port = controlPlane();
    const result = await prepareApprovedRecommendationForControlPlane({
      recommendation: recommendation(),
      decision: decision('DEFER'),
      mapping,
      controlPlane: port,
    });

    expect(result.status).toBe('BLOCKED');
    expect(result.reasons).toContain('HUMAN_DECISION_NOT_APPROVED');
    expect(port.validateOperationPayload).not.toHaveBeenCalled();
    expect(port.prepareOperation).not.toHaveBeenCalled();
  });

  it('blocks correlation mismatch', () => {
    const mismatched = {
      ...decision(),
      correlationId: 'other-correlation',
    };

    const result = buildControlledActionRequest(
      recommendation(),
      mismatched,
      mapping,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasons).toContain('CORRELATION_MISMATCH');
    }
  });

  it('uses existing control-plane validation before preparation', async () => {
    const port = controlPlane(false);
    const result = await prepareApprovedRecommendationForControlPlane({
      recommendation: recommendation(),
      decision: decision(),
      mapping,
      controlPlane: port,
    });

    expect(result.status).toBe('BLOCKED');
    expect(result.reasons).toEqual(['CONTROL_PLANE_PAYLOAD_INVALID']);
    expect(port.validateOperationPayload).toHaveBeenCalledTimes(1);
    expect(port.prepareOperation).not.toHaveBeenCalled();
  });

  it('prepares an existing operation intent but never confirms automatically', async () => {
    const port = controlPlane();
    const result = await prepareApprovedRecommendationForControlPlane({
      recommendation: recommendation(),
      decision: decision(),
      mapping,
      controlPlane: port,
    });

    expect(result.status).toBe('READY_FOR_CONFIRMATION');
    expect(result.preview?.intentId).toBe('intent-1');
    expect(port.prepareOperation).toHaveBeenCalledTimes(1);
    expect(port.confirmOperation).not.toHaveBeenCalled();
  });

  it('requires the exact confirmation token for the explicit confirmation step', async () => {
    const port = controlPlane();
    const preparation = await prepareApprovedRecommendationForControlPlane({
      recommendation: recommendation(),
      decision: decision(),
      mapping,
      controlPlane: port,
    });

    await expect(
      confirmPreparedControlPlaneIntent({
        preparation,
        confirmationToken: 'wrong',
        controlPlane: port,
      }),
    ).rejects.toThrow('CONFIRMATION_TOKEN_MISMATCH');

    expect(port.confirmOperation).not.toHaveBeenCalled();
  });

  it('confirms through the existing port when the explicit token matches', async () => {
    const port = controlPlane();
    const preparation = await prepareApprovedRecommendationForControlPlane({
      recommendation: recommendation(),
      decision: decision(),
      mapping,
      controlPlane: port,
    });

    const confirmation = await confirmPreparedControlPlaneIntent({
      preparation,
      confirmationToken: 'token-1',
      controlPlane: port,
    });

    expect(confirmation.status).toBe('CONFIRMED');
    expect(port.confirmOperation).toHaveBeenCalledTimes(1);
  });
});
