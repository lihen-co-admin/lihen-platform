import { describe, expect, it } from 'vitest';
import {
  createConversationIntelligenceHandler,
  INTELLIGENCE_PERMISSION,
  orchestrateIntelligenceRequest,
  prepareConversationIntelligence,
} from '../src';
import type { PermissionPrincipal } from '../src';

const conversationSnapshot = {
  conversationId: 'conversation-1',
  channel: 'WHATSAPP',
  customerId: 'customer-1',
  orderId: 'order-1',
  productIds: ['product-1'],
  messageCount: 4,
  inboundCount: 3,
  outboundCount: 1,
  lastMessageDirection: 'INBOUND' as const,
  status: 'WAITING_LIHEN',
  intentKind: 'PRICE_INQUIRY',
  intentConfidence: 0.94,
  intentRationale: [
    'Classification was supplied by the governed conversation projection.',
  ],
  suggestedReply:
    'Hola. Con gusto te compartimos la información del producto.',
};

const context = {
  contextId: 'conversation:conversation-1',
  type: 'CONVERSATION' as const,
  entityId: 'conversation-1',
  attributes: {
    conversationSnapshot,
  },
};

const allowedPrincipal: PermissionPrincipal = {
  actorId: 'conversation-intelligence',
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

describe('Conversation Intelligence', () => {
  it('preserves governed semantic context as evidence without sending anything', () => {
    const result = prepareConversationIntelligence({
      correlationId: 'corr-conversation',
      evidenceId: 'evidence-conversation',
      recommendationId: 'recommendation-conversation',
      snapshot: conversationSnapshot,
      fingerprint: 'conversation-fingerprint',
      createdAt: '2026-09-09T12:00:00Z',
    });

    expect(result.evidence.payload?.intentKind)
      .toBe('PRICE_INQUIRY');
    expect(result.evidence.payload?.suggestedReply)
      .toBe(conversationSnapshot.suggestedReply);
    expect(result.recommendation.risk.level).toBe('R2');
    expect(result.recommendation.risk.requiresHumanReview)
      .toBe(true);
    expect(result.recommendation.actionType)
      .toBe('REVIEW_CONVERSATION_RESPONSE');
  });

  it('fails closed when the governed conversation snapshot is missing', async () => {
    const execution = await orchestrateIntelligenceRequest(
      {
        handlers: [createConversationIntelligenceHandler()],
      },
      {
        requestId: 'req-conversation-missing',
        correlationId: 'corr-conversation-missing',
        requestedBy: 'owner',
        principal: allowedPrincipal,
        context: {
          ...context,
          attributes: {},
        },
        intent: {
          intentId: 'intent-conversation-missing',
          name: 'Analyze conversation',
          description: 'Analyze governed conversation context',
          requestedCapabilities: ['CONVERSATION_INTELLIGENCE'],
          requiresVerification: false,
          expectedOutput: 'RECOMMENDATION',
        },
      },
    );

    expect(execution.result.status).toBe('DEPENDENCY_FAILED');
    expect(execution.result.messages.join(' '))
      .toContain('CONVERSATION_SNAPSHOT_REQUIRED');
  });

  it('is permission-gated before Conversation Intelligence executes', async () => {
    const execution = await orchestrateIntelligenceRequest(
      {
        handlers: [createConversationIntelligenceHandler()],
      },
      {
        requestId: 'req-conversation-denied',
        correlationId: 'corr-conversation-denied',
        requestedBy: 'owner',
        principal: {
          actorId: 'conversation-intelligence',
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
          intentId: 'intent-conversation-denied',
          name: 'Analyze conversation',
          description: 'Analyze governed conversation context',
          requestedCapabilities: ['CONVERSATION_INTELLIGENCE'],
          requiresVerification: false,
          expectedOutput: 'RECOMMENDATION',
        },
      },
    );

    expect(execution.result.status).toBe('PERMISSION_DENIED');
    expect(execution.executedCapabilities).toEqual([]);
    expect(execution.evidence).toEqual([]);
  });

  it('runs through the Orchestrator as ANALYZE and requires human review', async () => {
    const execution = await orchestrateIntelligenceRequest(
      {
        handlers: [createConversationIntelligenceHandler()],
      },
      {
        requestId: 'req-conversation',
        correlationId: 'corr-conversation-ok',
        requestedBy: 'owner',
        principal: allowedPrincipal,
        context,
        intent: {
          intentId: 'intent-conversation',
          name: 'Analyze conversation',
          description: 'Analyze governed conversation context',
          requestedCapabilities: ['CONVERSATION_INTELLIGENCE'],
          requiresVerification: false,
          expectedOutput: 'RECOMMENDATION',
        },
      },
    );

    expect(execution.executedCapabilities)
      .toEqual(['CONVERSATION_INTELLIGENCE']);
    expect(execution.evidence).toHaveLength(1);
    expect(execution.candidates).toEqual([]);
    expect(execution.recommendations).toHaveLength(1);
    expect(execution.recommendations[0]?.risk.requiresHumanReview)
      .toBe(true);
    expect(execution.result.status).toBe('REQUIRES_REVIEW');
  });
});
