import { describe, expect, it } from 'vitest';
import {
  createControlledAutomationHandler,
  evaluateControlledAutomationPlan,
  INTELLIGENCE_PERMISSION,
  orchestrateIntelligenceRequest,
  prepareControlledAutomationForControlPlane,
} from '../src';
import type {
  ExistingControlPlanePort,
  PermissionPrincipal,
} from '../src';

const context = {
  contextId: 'ctx-automation',
  type: 'INVENTORY' as const,
  entityId: 'product-1',
  attributes: {
    automationPlan: {
      automationId: 'automation-low-stock',
      title: 'Low stock purchase preparation',
      purpose: 'Prepare a purchase operation for review when governed stock signals require it.',
      trigger: {
        kind: 'CONDITION' as const,
        description: 'Governed stock signal requires review.',
        source: 'inventory-intelligence',
      },
      action: {
        operationCode: 'procurement.prepare_purchase',
        operationKey: 'purchase:product-1',
        requestPayload: {
          productId: 'product-1',
          quantity: 5,
        },
      },
      approvalMode: 'ALWAYS_REQUIRED' as const,
      enabled: true,
    },
  },
};

const principal: PermissionPrincipal = {
  actorId: 'automation-intelligence',
  actorType: 'INTELLIGENCE',
  grants: [
    {
      permission: INTELLIGENCE_PERMISSION.READ_CONTEXT,
      effect: 'ALLOW',
      source: 'test',
    },
    {
      permission: INTELLIGENCE_PERMISSION.PREPARE_ACTION,
      effect: 'ALLOW',
      source: 'test',
    },
  ],
};

describe('WAVE 11 / GAP-038 Controlled Automation', () => {
  it('creates a review-only automation recommendation with mandatory approval', () => {
    const evaluated = evaluateControlledAutomationPlan({
      correlationId: 'corr-automation',
      context,
      plan: context.attributes.automationPlan,
    });

    expect(evaluated.plan.approvalMode).toBe('ALWAYS_REQUIRED');
    expect(evaluated.recommendation.actionType)
      .toBe('PREPARE_CONTROLLED_AUTOMATION');
    expect(evaluated.recommendation.risk.requiresHumanReview).toBe(true);
    expect(evaluated.recommendation.status).toBe('OPEN');
  });

  it('fails closed when an approval bypass is attempted', () => {
    expect(() =>
      evaluateControlledAutomationPlan({
        correlationId: 'corr-bypass',
        context,
        plan: {
          ...context.attributes.automationPlan,
          approvalMode: 'BYPASS' as never,
        },
      }),
    ).toThrow('AUTOMATION_APPROVAL_BYPASS_FORBIDDEN');
  });

  it('requires PREPARE_ACTION permission through the existing Orchestrator', async () => {
    const execution = await orchestrateIntelligenceRequest(
      {
        handlers: [createControlledAutomationHandler()],
      },
      {
        requestId: 'req-automation-denied',
        correlationId: 'corr-automation-denied',
        requestedBy: 'owner',
        principal: {
          actorId: 'automation-intelligence',
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
          intentId: 'intent-automation-denied',
          name: 'Prepare automation',
          description: 'Prepare a controlled automation for review.',
          requestedCapabilities: ['AUTOMATION'],
          requiresVerification: false,
          expectedOutput: 'RECOMMENDATION',
        },
      },
    );

    expect(execution.result.status).toBe('PERMISSION_DENIED');
    expect(execution.executedCapabilities).toEqual([]);
  });

  it('runs through the Orchestrator and always requires human review', async () => {
    const execution = await orchestrateIntelligenceRequest(
      {
        handlers: [createControlledAutomationHandler()],
      },
      {
        requestId: 'req-automation',
        correlationId: 'corr-automation-ok',
        requestedBy: 'owner',
        principal,
        context,
        intent: {
          intentId: 'intent-automation',
          name: 'Prepare automation',
          description: 'Prepare a controlled automation for review.',
          requestedCapabilities: ['AUTOMATION'],
          requiresVerification: false,
          expectedOutput: 'RECOMMENDATION',
        },
      },
    );

    expect(execution.executedCapabilities).toEqual(['AUTOMATION']);
    expect(execution.recommendations).toHaveLength(1);
    expect(execution.result.status).toBe('REQUIRES_REVIEW');
    expect(execution.candidates).toEqual([]);
  });

  it('blocks Control Plane preparation without an approved human decision', async () => {
    let prepareCalls = 0;

    const controlPlane: ExistingControlPlanePort = {
      async validateOperationPayload() {
        return {
          operationCode: 'procurement.prepare_purchase',
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
          operationKey: 'purchase:product-1',
          operationCode: 'procurement.prepare_purchase',
          domainCode: 'PROCUREMENT',
          riskLevel: 'R3',
          requiresConfirmation: true,
          executionEnabled: false,
          status: 'PREPARED',
          confirmationToken: 'confirm-1',
          previewSnapshot: {},
          expiresAt: new Date('2026-09-05T00:00:00Z'),
        };
      },
      async confirmOperation() {
        throw new Error('CONFIRM_MUST_REMAIN_SEPARATE');
      },
      async getAuditTimeline() {
        return [];
      },
    };

    const evaluated = evaluateControlledAutomationPlan({
      correlationId: 'corr-human',
      context,
      plan: context.attributes.automationPlan,
    });

    const blocked = await prepareControlledAutomationForControlPlane({
      plan: evaluated.plan,
      recommendation: evaluated.recommendation,
      decision: {
        decisionId: 'decision-reject',
        correlationId: 'corr-human',
        recommendationId: evaluated.recommendation.recommendationId,
        decision: 'REJECT',
        reason: 'Not approved',
        decidedBy: 'owner',
        decidedAt: '2026-09-04T12:00:00Z',
      },
      controlPlane,
    });

    expect(blocked.status).toBe('BLOCKED');
    expect(prepareCalls).toBe(0);
  });

  it('may prepare after approval but never confirms the operation automatically', async () => {
    let prepareCalls = 0;
    let confirmCalls = 0;

    const controlPlane: ExistingControlPlanePort = {
      async validateOperationPayload() {
        return {
          operationCode: 'procurement.prepare_purchase',
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
          intentId: 'intent-approved',
          operationKey: 'purchase:product-1',
          operationCode: 'procurement.prepare_purchase',
          domainCode: 'PROCUREMENT',
          riskLevel: 'R3',
          requiresConfirmation: true,
          executionEnabled: false,
          status: 'PREPARED',
          confirmationToken: 'confirm-approved',
          previewSnapshot: {},
          expiresAt: new Date('2026-09-05T00:00:00Z'),
        };
      },
      async confirmOperation() {
        confirmCalls += 1;
        throw new Error('SHOULD_NOT_CONFIRM_AUTOMATICALLY');
      },
      async getAuditTimeline() {
        return [];
      },
    };

    const evaluated = evaluateControlledAutomationPlan({
      correlationId: 'corr-approved',
      context,
      plan: context.attributes.automationPlan,
    });

    const preparation = await prepareControlledAutomationForControlPlane({
      plan: evaluated.plan,
      recommendation: evaluated.recommendation,
      decision: {
        decisionId: 'decision-approve',
        correlationId: 'corr-approved',
        recommendationId: evaluated.recommendation.recommendationId,
        decision: 'APPROVE',
        reason: 'Reviewed',
        decidedBy: 'owner',
        decidedAt: '2026-09-04T12:01:00Z',
      },
      controlPlane,
    });

    expect(preparation.status).toBe('READY_FOR_CONFIRMATION');
    expect(prepareCalls).toBe(1);
    expect(confirmCalls).toBe(0);
  });
});
