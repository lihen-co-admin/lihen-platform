import { describe, expect, it, vi } from 'vitest';
import {
  buildIntelligenceOrchestrationPlan,
  INTELLIGENCE_PERMISSION,
  orchestrateIntelligenceRequest,
} from '../src';
import type {
  IntelligenceCapabilityHandler,
  IntelligenceContext,
  IntelligenceIntent,
  PermissionGrant,
  PermissionPrincipal,
} from '../src';

const context: IntelligenceContext = {
  contextId: 'product-ctx-1',
  type: 'PRODUCT',
  entityId: 'product-1',
  businessLine: 'BEAUTY_CARE',
  attributes: {},
};

const intent: IntelligenceIntent = {
  intentId: 'audit-product',
  name: 'Audit product',
  description: 'Audit product evidence and verify findings.',
  requestedCapabilities: ['PRODUCT_INTELLIGENCE'],
  requiresVerification: true,
  expectedOutput: 'RECOMMENDATION',
};

function grant(permission: PermissionGrant['permission']): PermissionGrant {
  return {
    permission,
    effect: 'ALLOW',
    source: 'test',
  };
}

function principal(
  grants: readonly PermissionGrant[] = [
    grant(INTELLIGENCE_PERMISSION.READ_CONTEXT),
    grant(INTELLIGENCE_PERMISSION.ANALYZE),
    grant(INTELLIGENCE_PERMISSION.VERIFY),
  ],
): PermissionPrincipal {
  return {
    actorId: 'human-1',
    actorType: 'HUMAN',
    grants,
  };
}

function handler(
  capability: IntelligenceCapabilityHandler['capability'],
  execute: IntelligenceCapabilityHandler['execute'],
): IntelligenceCapabilityHandler {
  return { capability, execute };
}

describe('LIHEN Intelligence Orchestrator — GAP-006', () => {
  it('builds a deterministic plan and injects verification when required', () => {
    const plan = buildIntelligenceOrchestrationPlan(context, intent);

    expect(plan.capabilities).toEqual([
      'PRODUCT_INTELLIGENCE',
      'VERIFICATION',
    ]);
    expect(plan.permissionRequests.map((item) => item.permission)).toEqual([
      INTELLIGENCE_PERMISSION.READ_CONTEXT,
      INTELLIGENCE_PERMISSION.ANALYZE,
      INTELLIGENCE_PERMISSION.VERIFY,
    ]);
  });

  it('deduplicates requested capabilities without changing their order', () => {
    const plan = buildIntelligenceOrchestrationPlan(context, {
      ...intent,
      requestedCapabilities: [
        'SEARCH',
        'SEARCH',
        'PRODUCT_INTELLIGENCE',
        'SEARCH',
      ],
      requiresVerification: false,
    });

    expect(plan.capabilities).toEqual([
      'SEARCH',
      'PRODUCT_INTELLIGENCE',
    ]);
  });

  it('fails closed before execution when permission is denied', async () => {
    const execute = vi.fn();

    const result = await orchestrateIntelligenceRequest(
      {
        handlers: [
          handler('PRODUCT_INTELLIGENCE', execute),
          handler('VERIFICATION', execute),
        ],
      },
      {
        requestId: 'request-1',
        correlationId: 'correlation-1',
        requestedBy: 'human-1',
        principal: principal([
          grant(INTELLIGENCE_PERMISSION.READ_CONTEXT),
          grant(INTELLIGENCE_PERMISSION.ANALYZE),
        ]),
        context,
        intent,
      },
    );

    expect(result.result.status).toBe('PERMISSION_DENIED');
    expect(result.executedCapabilities).toEqual([]);
    expect(execute).not.toHaveBeenCalled();
  });

  it('preflights missing handlers before running any capability', async () => {
    const productExecute = vi.fn();

    const result = await orchestrateIntelligenceRequest(
      {
        handlers: [
          handler('PRODUCT_INTELLIGENCE', productExecute),
        ],
      },
      {
        requestId: 'request-2',
        correlationId: 'correlation-2',
        requestedBy: 'human-1',
        principal: principal(),
        context,
        intent,
      },
    );

    expect(result.result.status).toBe('DEPENDENCY_FAILED');
    expect(result.executedCapabilities).toEqual([]);
    expect(productExecute).not.toHaveBeenCalled();
  });

  it('executes capabilities sequentially and passes accumulated evidence forward', async () => {
    const productExecute = vi.fn(async () => ({
      capability: 'PRODUCT_INTELLIGENCE' as const,
      evidence: [
        {
          evidenceId: 'evidence-product',
          correlationId: 'correlation-3',
          context,
          capability: 'PRODUCT_INTELLIGENCE' as const,
          sourceAuthority: {
            level: 'FIRST_PARTY' as const,
            sourceName: 'Product Master',
            rationale: ['Canonical read context'],
          },
          observation: 'Product evidence collected.',
          confidence: {
            score: 0.9,
            band: 'VERY_HIGH' as const,
            rationale: ['Canonical source'],
          },
          fingerprint: 'fingerprint-product',
          createdAt: '2026-09-01T00:00:00Z',
        },
      ],
      candidates: [],
      recommendations: [],
      messages: ['product done'],
    }));

    const verificationExecute = vi.fn(async (input) => ({
      capability: 'VERIFICATION' as const,
      evidence: [],
      candidates: [],
      recommendations: [],
      messages: [`verified ${input.priorEvidence.length}`],
    }));

    const result = await orchestrateIntelligenceRequest(
      {
        handlers: [
          handler('PRODUCT_INTELLIGENCE', productExecute),
          handler('VERIFICATION', verificationExecute),
        ],
      },
      {
        requestId: 'request-3',
        correlationId: 'correlation-3',
        requestedBy: 'human-1',
        principal: principal(),
        context,
        intent,
      },
    );

    expect(result.result.status).toBe('SUCCESS');
    expect(result.executedCapabilities).toEqual([
      'PRODUCT_INTELLIGENCE',
      'VERIFICATION',
    ]);
    expect(verificationExecute.mock.calls[0]?.[0].priorEvidence).toHaveLength(1);
    expect(result.result.evidenceIds).toEqual(['evidence-product']);
  });

  it('returns REQUIRES_REVIEW when a recommendation carries human-review risk', async () => {
    const productExecute = vi.fn(async () => ({
      capability: 'PRODUCT_INTELLIGENCE' as const,
      evidence: [],
      candidates: [],
      recommendations: [
        {
          recommendationId: 'recommendation-1',
          correlationId: 'correlation-4',
          context,
          actionType: 'REVIEW_PRODUCT_ASSET',
          title: 'Review product asset',
          explanation: 'Asset identity needs human confirmation.',
          priority: 'P2' as const,
          severity: 'WARNING' as const,
          source: 'product intelligence',
          rationale: ['Ambiguous visual match'],
          evidenceIds: [],
          confidence: {
            score: 0.6,
            band: 'MEDIUM' as const,
            rationale: ['Conflicting signals'],
          },
          risk: {
            level: 'R3' as const,
            reasons: ['Governed asset selection'],
            requiresHumanReview: true,
          },
          status: 'OPEN' as const,
          createdAt: '2026-09-01T00:00:00Z',
        },
      ],
      messages: [],
    }));

    const verificationExecute = vi.fn(async () => ({
      capability: 'VERIFICATION' as const,
      evidence: [],
      candidates: [],
      recommendations: [],
      messages: [],
    }));

    const result = await orchestrateIntelligenceRequest(
      {
        handlers: [
          handler('PRODUCT_INTELLIGENCE', productExecute),
          handler('VERIFICATION', verificationExecute),
        ],
      },
      {
        requestId: 'request-4',
        correlationId: 'correlation-4',
        requestedBy: 'human-1',
        principal: principal(),
        context,
        intent,
      },
    );

    expect(result.result.status).toBe('REQUIRES_REVIEW');
    expect(result.recommendations).toHaveLength(1);
  });

  it('does not execute any controlled command or mutation surface', async () => {
    const result = await orchestrateIntelligenceRequest(
      {
        handlers: [
          handler('PRODUCT_INTELLIGENCE', async () => ({
            capability: 'PRODUCT_INTELLIGENCE',
            evidence: [],
            candidates: [],
            recommendations: [],
            messages: [],
          })),
          handler('VERIFICATION', async () => ({
            capability: 'VERIFICATION',
            evidence: [],
            candidates: [],
            recommendations: [],
            messages: [],
          })),
        ],
      },
      {
        requestId: 'request-5',
        correlationId: 'correlation-5',
        requestedBy: 'human-1',
        principal: principal(),
        context,
        intent,
      },
    );

    expect(result.result.status).toBe('NO_RESULT');
    expect(result.result.status).not.toBe('COMMAND_FAILED');
  });

  it('fails a capability dependency without fabricating a successful result', async () => {
    const result = await orchestrateIntelligenceRequest(
      {
        handlers: [
          handler('PRODUCT_INTELLIGENCE', async () => {
            throw new Error('provider unavailable');
          }),
          handler('VERIFICATION', async () => ({
            capability: 'VERIFICATION',
            evidence: [],
            candidates: [],
            recommendations: [],
            messages: [],
          })),
        ],
      },
      {
        requestId: 'request-6',
        correlationId: 'correlation-6',
        requestedBy: 'human-1',
        principal: principal(),
        context,
        intent,
      },
    );

    expect(result.result.status).toBe('DEPENDENCY_FAILED');
    expect(result.result.messages).toContain('provider unavailable');
  });
});
