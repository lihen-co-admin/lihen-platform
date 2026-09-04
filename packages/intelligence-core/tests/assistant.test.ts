import { describe, expect, it } from 'vitest';
import {
  INTELLIGENCE_PERMISSION,
  prepareLihenAssistantRecommendation,
  runLihenAssistantTurn,
} from '../src';
import type {
  AssistantContextSource,
  ExistingControlPlanePort,
  ModelPort,
  PermissionPrincipal,
} from '../src';

const principal: PermissionPrincipal = {
  actorId: 'assistant',
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

const productSource: AssistantContextSource = {
  type: 'PRODUCT',
  async resolve() {
    return {
      source: 'ProductRepository',
      attributes: {
        name: 'Kit LIHEN',
        stock: 4,
      },
    };
  },
};

const model: ModelPort = {
  descriptor: {
    toolId: 'test-model',
    kind: 'MODEL',
    name: 'Test model',
    version: '1',
    description: 'Deterministic test model',
    readOnly: true,
  },
  async complete(request) {
    return {
      status: 'SUCCESS',
      data: {
        text: `Respuesta sobre ${String(request.context.attributes.name)}`,
      },
      messages: ['MODEL_OK'],
    };
  },
};

describe('WAVE 10 / GAP-034 LIHEN Assistant', () => {
  it('resolves governed context before using the model through the Orchestrator', async () => {
    const turn = await runLihenAssistantTurn(
      {
        context: { sources: [productSource] },
        model,
      },
      {
        requestId: 'req-1',
        correlationId: 'corr-1',
        requestedBy: 'owner',
        principal,
        prompt: '¿Qué debo saber de este producto?',
        contextQuery: {
          contextId: 'ctx-product-1',
          type: 'PRODUCT',
          entityId: 'product-1',
        },
      },
    );

    expect(turn.status).toBe('SUCCESS');
    expect(turn.answer).toBe('Respuesta sobre Kit LIHEN');
    expect(turn.contextSource).toBe('ProductRepository');
    expect(turn.orchestration?.executedCapabilities).toEqual(['ASSISTANT']);
    expect(turn.orchestration?.plan.permissionRequests.map((item) => item.permission))
      .toContain(INTELLIGENCE_PERMISSION.READ_CONTEXT);
    expect(turn.orchestration?.plan.permissionRequests.map((item) => item.permission))
      .toContain(INTELLIGENCE_PERMISSION.ANALYZE);
  });

  it('does not call a provider when context permission is denied', async () => {
    let modelCalls = 0;
    const trackingModel: ModelPort = {
      ...model,
      async complete(request) {
        modelCalls += 1;
        return model.complete(request);
      },
    };

    const turn = await runLihenAssistantTurn(
      {
        context: { sources: [productSource] },
        model: trackingModel,
      },
      {
        requestId: 'req-denied',
        correlationId: 'corr-denied',
        requestedBy: 'owner',
        principal: {
          actorId: 'assistant',
          actorType: 'INTELLIGENCE',
          grants: [],
        },
        prompt: 'Consulta',
        contextQuery: {
          contextId: 'ctx-denied',
          type: 'PRODUCT',
        },
      },
    );

    expect(turn.status).toBe('PERMISSION_DENIED');
    expect(modelCalls).toBe(0);
  });

  it('reports provider-not-configured without bypassing context governance', async () => {
    const turn = await runLihenAssistantTurn(
      {
        context: { sources: [productSource] },
      },
      {
        requestId: 'req-no-provider',
        correlationId: 'corr-no-provider',
        requestedBy: 'owner',
        principal,
        prompt: 'Consulta',
        contextQuery: {
          contextId: 'ctx-no-provider',
          type: 'PRODUCT',
        },
      },
    );

    expect(turn.status).toBe('PROVIDER_NOT_CONFIGURED');
    expect(turn.contextSource).toBe('ProductRepository');
    expect(turn.answer).toBeUndefined();
  });

  it('surfaces provider failure as a governed failure', async () => {
    const failingModel: ModelPort = {
      ...model,
      async complete() {
        return {
          status: 'UNAVAILABLE',
          messages: ['MODEL_DOWN'],
        };
      },
    };

    const turn = await runLihenAssistantTurn(
      {
        context: { sources: [productSource] },
        model: failingModel,
      },
      {
        requestId: 'req-provider-fail',
        correlationId: 'corr-provider-fail',
        requestedBy: 'owner',
        principal,
        prompt: 'Consulta',
        contextQuery: {
          contextId: 'ctx-provider-fail',
          type: 'PRODUCT',
        },
      },
    );

    expect(turn.status).toBe('PROVIDER_FAILED');
    expect(turn.messages.join(' ')).toContain('MODEL_DOWN');
  });

  it('requires the existing human-approved Control Plane path for mutations', async () => {
    let prepareCalls = 0;

    const controlPlane: ExistingControlPlanePort = {
      async validateOperationPayload() {
        return {
          operationCode: 'pricing.change',
          valid: true,
          missingRequiredKeys: [],
          unexpectedKeys: [],
          executionEnabled: false,
          validationNote: 'VALID',
        };
      },
      async prepareOperation() {
        prepareCalls += 1;
        return {
          intentId: 'intent-1',
          operationKey: 'pricing:1',
          operationCode: 'pricing.change',
          domainCode: 'PRICING',
          riskLevel: 'R4',
          requiresConfirmation: true,
          executionEnabled: false,
          status: 'PREPARED',
          confirmationToken: 'token-1',
          previewSnapshot: {},
          expiresAt: new Date('2026-09-05T00:00:00Z'),
        };
      },
      async confirmOperation() {
        throw new Error('SHOULD_NOT_CONFIRM');
      },
      async getAuditTimeline() {
        return [];
      },
    };

    const recommendation = {
      recommendationId: 'rec-1',
      correlationId: 'corr-1',
      context: {
        contextId: 'ctx-1',
        type: 'PRICING' as const,
        attributes: {},
      },
      actionType: 'CHANGE_PRICE',
      title: 'Review price',
      explanation: 'Review',
      priority: 'P2' as const,
      severity: 'WARNING' as const,
      source: 'assistant',
      rationale: [],
      evidenceIds: [],
      confidence: {
        score: 0.8,
        band: 'HIGH' as const,
        rationale: [],
      },
      risk: {
        level: 'R4' as const,
        reasons: [],
        requiresHumanReview: true,
      },
      status: 'OPEN' as const,
      createdAt: '2026-09-04T00:00:00Z',
    };

    const blocked = await prepareLihenAssistantRecommendation({
      recommendation,
      decision: {
        decisionId: 'decision-reject',
        correlationId: 'corr-1',
        recommendationId: 'rec-1',
        decision: 'REJECT',
        reason: 'No',
        decidedBy: 'owner',
        decidedAt: '2026-09-04T00:01:00Z',
      },
      mapping: {
        operationCode: 'pricing.change',
        operationKey: 'pricing:1',
        requestPayload: {},
      },
      controlPlane,
    });

    expect(blocked.status).toBe('BLOCKED');
    expect(prepareCalls).toBe(0);

    const approved = await prepareLihenAssistantRecommendation({
      recommendation,
      decision: {
        decisionId: 'decision-approve',
        correlationId: 'corr-1',
        recommendationId: 'rec-1',
        decision: 'APPROVE',
        reason: 'Reviewed',
        decidedBy: 'owner',
        decidedAt: '2026-09-04T00:02:00Z',
      },
      mapping: {
        operationCode: 'pricing.change',
        operationKey: 'pricing:1',
        requestPayload: {},
      },
      controlPlane,
    });

    expect(approved.status).toBe('READY_FOR_CONFIRMATION');
    expect(prepareCalls).toBe(1);
  });
});
