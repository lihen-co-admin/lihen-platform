import { describe, expect, it } from 'vitest';
import {
  buildUnifiedIntelligenceAuditTrail,
  createAuditIntelligenceHandler,
  INTELLIGENCE_PERMISSION,
  orchestrateIntelligenceRequest,
} from '../src';
import type {
  IntelligenceDecision,
  IntelligenceOrchestratorExecution,
  IntelligenceOrchestratorRequest,
  PermissionPrincipal,
} from '../src';

const request: IntelligenceOrchestratorRequest = {
  requestId: 'req-audit-1',
  correlationId: 'corr-audit-1',
  requestedBy: 'owner',
  principal: {
    actorId: 'owner',
    actorType: 'HUMAN',
    grants: [],
  },
  context: {
    contextId: 'ctx-audit-source',
    type: 'PRODUCT',
    entityId: 'product-1',
    attributes: {},
  },
  intent: {
    intentId: 'intent-audit-source',
    name: 'Analyze product',
    description: 'Source orchestration for audit test.',
    requestedCapabilities: ['PRODUCT_INTELLIGENCE'],
    requiresVerification: false,
    expectedOutput: 'RECOMMENDATION',
  },
};

const execution: IntelligenceOrchestratorExecution = {
  plan: {
    capabilities: ['PRODUCT_INTELLIGENCE'],
    permissionRequests: [],
  },
  permissionDecisions: [
    {
      allowed: true,
      permission: INTELLIGENCE_PERMISSION.READ_CONTEXT,
      actionClass: 'READ',
      reason: 'GRANT_ALLOWED',
    },
  ],
  executedCapabilities: ['PRODUCT_INTELLIGENCE'],
  evidence: [
    {
      evidenceId: 'evidence-1',
      correlationId: 'corr-audit-1',
      context: request.context,
      capability: 'PRODUCT_INTELLIGENCE',
      sourceAuthority: {
        level: 'FIRST_PARTY',
        sourceName: 'product-master',
        rationale: ['test'],
      },
      observation: 'Product observed.',
      confidence: {
        score: 1,
        band: 'VERY_HIGH',
        rationale: ['test'],
      },
      fingerprint: 'fp-1',
      createdAt: '2026-09-04T13:00:01Z',
    },
  ],
  candidates: [],
  recommendations: [
    {
      recommendationId: 'rec-1',
      correlationId: 'corr-audit-1',
      context: request.context,
      actionType: 'REVIEW_PRODUCT',
      title: 'Review product',
      explanation: 'Review.',
      priority: 'P2',
      severity: 'WARNING',
      source: 'PRODUCT_INTELLIGENCE',
      rationale: ['test'],
      evidenceIds: ['evidence-1'],
      confidence: {
        score: 1,
        band: 'VERY_HIGH',
        rationale: ['test'],
      },
      risk: {
        level: 'R2',
        reasons: ['test'],
        requiresHumanReview: true,
      },
      status: 'OPEN',
      createdAt: '2026-09-04T13:00:02Z',
    },
  ],
  result: {
    correlationId: 'corr-audit-1',
    status: 'REQUIRES_REVIEW',
    data: {
      requestId: 'req-audit-1',
      expectedOutput: 'RECOMMENDATION',
    },
    evidenceIds: ['evidence-1'],
    candidateIds: [],
    recommendationIds: ['rec-1'],
    messages: ['review required'],
  },
};

const decision: IntelligenceDecision = {
  decisionId: 'decision-1',
  correlationId: 'corr-audit-1',
  recommendationId: 'rec-1',
  decision: 'APPROVE',
  reason: 'Reviewed by owner.',
  decidedBy: 'owner',
  decidedAt: '2026-09-04T13:01:00Z',
};

describe('WAVE 12 / GAP-039 Unified Intelligence Audit', () => {
  it('normalizes orchestration, human decision and Control Plane events into one trail', () => {
    const trail = buildUnifiedIntelligenceAuditTrail({
      orchestrations: [
        {
          request,
          execution,
          observedAt: '2026-09-04T13:00:03Z',
        },
      ],
      decisions: [decision],
      controlPlaneEvents: [
        {
          correlationId: 'corr-audit-1',
          event: {
            domainCode: 'PRODUCT',
            operationType: 'UPDATE',
            operationKey: 'product:update',
            actorId: 'owner',
            entityId: 'product-1',
            requestFingerprint: 'request-fp-1',
            resultSnapshot: {
              status: 'CONFIRMED',
            },
            occurredAt: new Date('2026-09-04T13:02:00Z'),
          },
        },
      ],
    });

    expect(trail.correlationIds).toEqual(['corr-audit-1']);
    expect(trail.sourceCounts.INTELLIGENCE_ORCHESTRATOR).toBeGreaterThan(0);
    expect(trail.sourceCounts.HUMAN_REVIEW).toBe(1);
    expect(trail.sourceCounts.CONTROL_PLANE).toBe(1);
    expect(trail.events.some((event) => event.kind === 'HUMAN_DECISION')).toBe(true);
    expect(trail.events.some((event) => event.kind === 'CONTROL_PLANE_EVENT')).toBe(true);
  });

  it('preserves source ownership instead of creating a second audit authority', () => {
    const trail = buildUnifiedIntelligenceAuditTrail({
      decisions: [decision],
      controlPlaneEvents: [
        {
          correlationId: 'corr-audit-1',
          event: {
            domainCode: 'PRODUCT',
            operationType: 'UPDATE',
            operationKey: 'product:update',
            actorId: 'owner',
            entityId: 'product-1',
            requestFingerprint: 'request-fp-1',
            resultSnapshot: {},
            occurredAt: new Date('2026-09-04T13:02:00Z'),
          },
        },
      ],
    });

    expect(trail.events.map((event) => event.source)).toEqual([
      'HUMAN_REVIEW',
      'CONTROL_PLANE',
    ]);
  });

  it('fails closed on orchestration correlation mismatches', () => {
    expect(() =>
      buildUnifiedIntelligenceAuditTrail({
        orchestrations: [
          {
            request,
            execution: {
              ...execution,
              result: {
                ...execution.result,
                correlationId: 'corr-other',
              },
            },
            observedAt: '2026-09-04T13:00:03Z',
          },
        ],
      }),
    ).toThrow('AUDIT_ORCHESTRATION_CORRELATION_MISMATCH');
  });

  it('fails closed on duplicate unified event ids', () => {
    expect(() =>
      buildUnifiedIntelligenceAuditTrail({
        decisions: [decision, decision],
      }),
    ).toThrow('DUPLICATE_AUDIT_EVENT_ID');
  });

  it('permission-gates AUDIT_INTELLIGENCE through the existing Orchestrator', async () => {
    const auditContext = {
      contextId: 'ctx-audit',
      type: 'AUDIT' as const,
      attributes: {
        auditSnapshot: {
          snapshotId: 'snapshot-audit-1',
          events: [],
        },
      },
    };

    const executionDenied = await orchestrateIntelligenceRequest(
      {
        handlers: [createAuditIntelligenceHandler()],
      },
      {
        requestId: 'req-audit-denied',
        correlationId: 'corr-audit-denied',
        requestedBy: 'owner',
        principal: {
          actorId: 'audit-intelligence',
          actorType: 'INTELLIGENCE',
          grants: [
            {
              permission: INTELLIGENCE_PERMISSION.READ_CONTEXT,
              effect: 'ALLOW',
              source: 'test',
            },
          ],
        },
        context: auditContext,
        intent: {
          intentId: 'intent-audit-denied',
          name: 'Read unified audit',
          description: 'Summarize audit snapshot.',
          requestedCapabilities: ['AUDIT_INTELLIGENCE'],
          requiresVerification: false,
          expectedOutput: 'EVIDENCE',
        },
      },
    );

    expect(executionDenied.result.status).toBe('PERMISSION_DENIED');
    expect(executionDenied.executedCapabilities).toEqual([]);
  });

  it('summarizes a governed audit snapshot without candidates, recommendations or mutations', async () => {
    const trail = buildUnifiedIntelligenceAuditTrail({
      orchestrations: [
        {
          request,
          execution,
          observedAt: '2026-09-04T13:00:03Z',
        },
      ],
      decisions: [decision],
    });

    const principal: PermissionPrincipal = {
      actorId: 'audit-intelligence',
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

    const result = await orchestrateIntelligenceRequest(
      {
        handlers: [createAuditIntelligenceHandler()],
      },
      {
        requestId: 'req-audit-summary',
        correlationId: 'corr-audit-summary',
        requestedBy: 'owner',
        principal,
        context: {
          contextId: 'ctx-audit-summary',
          type: 'AUDIT',
          attributes: {
            auditSnapshot: {
              snapshotId: 'snapshot-audit-summary',
              events: trail.events,
            },
          },
        },
        intent: {
          intentId: 'intent-audit-summary',
          name: 'Summarize audit',
          description: 'Summarize unified audit trail.',
          requestedCapabilities: ['AUDIT_INTELLIGENCE'],
          requiresVerification: false,
          expectedOutput: 'EVIDENCE',
        },
      },
    );

    expect(result.result.status).toBe('SUCCESS');
    expect(result.evidence).toHaveLength(1);
    expect(result.evidence[0]?.capability).toBe('AUDIT_INTELLIGENCE');
    expect(result.candidates).toEqual([]);
    expect(result.recommendations).toEqual([]);
  });
});
