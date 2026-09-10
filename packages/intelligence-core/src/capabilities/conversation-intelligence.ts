import type {
  Confidence,
  CorrelationId,
  IntelligenceContext,
  IntelligenceEvidence,
  IntelligenceRecommendation,
  SourceAuthority,
} from '../contracts';
import type {
  IntelligenceCapabilityExecutionInput,
  IntelligenceCapabilityExecutionOutput,
  IntelligenceCapabilityHandler,
} from '../orchestrator';

export interface ConversationIntelligenceSnapshot {
  readonly conversationId: string;
  readonly channel: string;
  readonly customerId: string | null;
  readonly orderId: string | null;
  readonly productIds: readonly string[];
  readonly messageCount: number;
  readonly inboundCount: number;
  readonly outboundCount: number;
  readonly lastMessageDirection:
    | 'INBOUND'
    | 'OUTBOUND'
    | null;
  readonly status: string;
  readonly intentKind?: string;
  readonly intentConfidence?: number;
  readonly intentRationale?: readonly string[];
  readonly suggestedReply?: string;
}

export interface PrepareConversationIntelligenceInput {
  readonly correlationId: CorrelationId;
  readonly evidenceId: string;
  readonly recommendationId: string;
  readonly snapshot: ConversationIntelligenceSnapshot;
  readonly fingerprint: string;
  readonly createdAt: string;
}

export interface PreparedConversationIntelligence {
  readonly evidence: IntelligenceEvidence;
  readonly recommendation: IntelligenceRecommendation;
}

function requireText(
  value: string,
  code: string,
): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(code);
  }

  return normalized;
}

function confidenceFor(
  snapshot: ConversationIntelligenceSnapshot,
): Confidence {
  const hasConversationEvidence =
    snapshot.messageCount > 0;

  return {
    score: hasConversationEvidence ? 0.9 : 0.7,
    band: hasConversationEvidence
      ? 'VERY_HIGH'
      : 'HIGH',
    rationale: [
      hasConversationEvidence
        ? 'Recommendation is derived from a governed first-party conversation snapshot.'
        : 'Conversation metadata exists but message evidence is limited.',
      'Confidence does not authorize sending a message or contacting a customer.',
    ],
  };
}

function authority(): SourceAuthority {
  return {
    level: 'FIRST_PARTY',
    sourceName: 'LIHEN Conversation Read Model',
    rationale: [
      'Conversation context originates from authorized first-party read models.',
      'Conversation Intelligence is advisory and does not send messages.',
    ],
  };
}

export function prepareConversationIntelligence(
  input: PrepareConversationIntelligenceInput,
): PreparedConversationIntelligence {
  const correlationId = requireText(
    input.correlationId,
    'CONVERSATION_CORRELATION_ID_REQUIRED',
  );

  const evidenceId = requireText(
    input.evidenceId,
    'CONVERSATION_EVIDENCE_ID_REQUIRED',
  );

  const recommendationId = requireText(
    input.recommendationId,
    'CONVERSATION_RECOMMENDATION_ID_REQUIRED',
  );

  const conversationId = requireText(
    input.snapshot.conversationId,
    'CONVERSATION_ID_REQUIRED',
  );

  requireText(
    input.snapshot.channel,
    'CONVERSATION_CHANNEL_REQUIRED',
  );

  requireText(
    input.snapshot.status,
    'CONVERSATION_STATUS_REQUIRED',
  );

  const fingerprint = requireText(
    input.fingerprint,
    'CONVERSATION_FINGERPRINT_REQUIRED',
  );

  const createdAt = requireText(
    input.createdAt,
    'CONVERSATION_CREATED_AT_REQUIRED',
  );

  const context: IntelligenceContext = {
    contextId: `conversation:${conversationId}`,
    type: 'CONVERSATION',
    entityId: conversationId,
    attributes: {},
  };

  const confidence = confidenceFor(input.snapshot);

  const evidence: IntelligenceEvidence = {
    evidenceId,
    correlationId,
    context,
    capability: 'CONVERSATION_INTELLIGENCE',
    sourceAuthority: authority(),
    observation:
      'Authorized conversation context analyzed without sending, publishing or mutating customer data.',
    payload: {
      conversationId,
      channel: input.snapshot.channel,
      customerId: input.snapshot.customerId,
      orderId: input.snapshot.orderId,
      productIds: input.snapshot.productIds,
      messageCount: input.snapshot.messageCount,
      inboundCount: input.snapshot.inboundCount,
      outboundCount: input.snapshot.outboundCount,
      lastMessageDirection:
        input.snapshot.lastMessageDirection,
      status: input.snapshot.status,
      ...(input.snapshot.intentKind
        ? { intentKind: input.snapshot.intentKind }
        : {}),
      ...(input.snapshot.intentConfidence !== undefined
        ? { intentConfidence: input.snapshot.intentConfidence }
        : {}),
      ...(input.snapshot.intentRationale
        ? { intentRationale: input.snapshot.intentRationale }
        : {}),
      ...(input.snapshot.suggestedReply
        ? { suggestedReply: input.snapshot.suggestedReply }
        : {}),
    },
    confidence,
    fingerprint,
    createdAt,
  };

  const needsHumanResponse =
    input.snapshot.lastMessageDirection === 'INBOUND'
    && input.snapshot.status !== 'RESOLVED'
    && input.snapshot.status !== 'CLOSED';

  const recommendation: IntelligenceRecommendation = {
    recommendationId,
    correlationId,
    context,
    actionType: needsHumanResponse
      ? 'REVIEW_CONVERSATION_RESPONSE'
      : 'REVIEW_CONVERSATION_STATE',
    title: needsHumanResponse
      ? 'Review conversation response'
      : 'Review conversation state',
    explanation: needsHumanResponse
      ? 'The latest governed snapshot contains an inbound message and may require a human-reviewed response.'
      : 'Review the current conversation state before deciding whether any follow-up is appropriate.',
    priority: needsHumanResponse ? 'P2' : 'P4',
    severity: 'INFO',
    source: 'CONVERSATION_INTELLIGENCE',
    rationale: [
      `Conversation channel: ${input.snapshot.channel}.`,
      `Message count: ${input.snapshot.messageCount}.`,
      needsHumanResponse
        ? 'Latest message direction is inbound.'
        : 'No automatic outbound response is warranted by this foundation.',
      ...(input.snapshot.intentKind
        ? [`Governed intent classification: ${input.snapshot.intentKind}.`]
        : []),
      ...(input.snapshot.suggestedReply
        ? ['A suggested reply is available for human review only.']
        : []),
      'Any drafted reply remains non-sent until a separately governed authorization exists.',
    ],
    evidenceIds: [evidenceId],
    confidence,
    risk: {
      level: 'R2',
      reasons: [
        'Conversation recommendations may influence customer communication.',
        'No outbound message is authorized by this recommendation.',
      ],
      requiresHumanReview: true,
    },
    status: 'OPEN',
    createdAt,
  };

  return {
    evidence,
    recommendation,
  };
}

function readConversationSnapshot(
  input: IntelligenceCapabilityExecutionInput,
): ConversationIntelligenceSnapshot {
  const raw = input.context.attributes.conversationSnapshot;

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('CONVERSATION_SNAPSHOT_REQUIRED');
  }

  const value = raw as Record<string, unknown>;

  if (
    typeof value.conversationId !== 'string'
    || typeof value.channel !== 'string'
    || (
      value.customerId !== null
      && typeof value.customerId !== 'string'
    )
    || (
      value.orderId !== null
      && typeof value.orderId !== 'string'
    )
    || !Array.isArray(value.productIds)
    || !value.productIds.every((item) => typeof item === 'string')
    || typeof value.messageCount !== 'number'
    || typeof value.inboundCount !== 'number'
    || typeof value.outboundCount !== 'number'
    || (
      value.lastMessageDirection !== null
      && value.lastMessageDirection !== 'INBOUND'
      && value.lastMessageDirection !== 'OUTBOUND'
    )
    || typeof value.status !== 'string'
  ) {
    throw new Error('CONVERSATION_SNAPSHOT_INVALID');
  }

  if (
    value.intentKind !== undefined
    && typeof value.intentKind !== 'string'
  ) {
    throw new Error('CONVERSATION_INTENT_KIND_INVALID');
  }

  if (
    value.intentConfidence !== undefined
    && (
      typeof value.intentConfidence !== 'number'
      || !Number.isFinite(value.intentConfidence)
      || value.intentConfidence < 0
      || value.intentConfidence > 1
    )
  ) {
    throw new Error('CONVERSATION_INTENT_CONFIDENCE_INVALID');
  }

  if (
    value.intentRationale !== undefined
    && (
      !Array.isArray(value.intentRationale)
      || !value.intentRationale.every(
        (item) => typeof item === 'string',
      )
    )
  ) {
    throw new Error('CONVERSATION_INTENT_RATIONALE_INVALID');
  }

  if (
    value.suggestedReply !== undefined
    && typeof value.suggestedReply !== 'string'
  ) {
    throw new Error('CONVERSATION_SUGGESTED_REPLY_INVALID');
  }

  return {
    conversationId: value.conversationId,
    channel: value.channel,
    customerId: value.customerId as string | null,
    orderId: value.orderId as string | null,
    productIds: value.productIds as string[],
    messageCount: value.messageCount,
    inboundCount: value.inboundCount,
    outboundCount: value.outboundCount,
    lastMessageDirection:
      value.lastMessageDirection as 'INBOUND' | 'OUTBOUND' | null,
    status: value.status,
    ...(typeof value.intentKind === 'string'
      ? { intentKind: value.intentKind }
      : {}),
    ...(typeof value.intentConfidence === 'number'
      ? { intentConfidence: value.intentConfidence }
      : {}),
    ...(Array.isArray(value.intentRationale)
      ? { intentRationale: value.intentRationale as string[] }
      : {}),
    ...(typeof value.suggestedReply === 'string'
      ? { suggestedReply: value.suggestedReply }
      : {}),
  };
}

export function createConversationIntelligenceHandler():
  IntelligenceCapabilityHandler {
  return {
    capability: 'CONVERSATION_INTELLIGENCE',
    async execute(
      input: IntelligenceCapabilityExecutionInput,
    ): Promise<IntelligenceCapabilityExecutionOutput> {
      const snapshot = readConversationSnapshot(input);

      const prepared = prepareConversationIntelligence({
        correlationId: input.correlationId,
        evidenceId:
          `conversation:${snapshot.conversationId}:evidence`,
        recommendationId:
          `conversation:${snapshot.conversationId}:recommendation`,
        snapshot,
        fingerprint:
          `conversation:${snapshot.conversationId}:${snapshot.messageCount}:${snapshot.status}`,
        createdAt: new Date(0).toISOString(),
      });

      return {
        capability: 'CONVERSATION_INTELLIGENCE',
        evidence: [prepared.evidence],
        candidates: [],
        recommendations: [prepared.recommendation],
        messages: [
          'Governed conversation snapshot analyzed.',
          snapshot.intentKind
            ? `Governed intent classification available: ${snapshot.intentKind}.`
            : 'No governed intent classification was supplied.',
          snapshot.suggestedReply
            ? 'Suggested reply is available for human review and remains non-sent.'
            : 'No suggested reply was supplied.',
        ],
      };
    },
  };
}
