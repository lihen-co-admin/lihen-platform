import type {
  Conversation,
  ConversationMessage,
} from '../../domain/conversation';

export interface ConversationSummaryReadModel {
  readonly conversation: Conversation;
  readonly messageCount: number;
  readonly inboundCount: number;
  readonly outboundCount: number;
  readonly lastMessage:
    | ConversationMessage
    | null;
}

export function buildConversationSummaryReadModel(
  conversation: Conversation,
  messages: readonly ConversationMessage[],
): ConversationSummaryReadModel {
  const scoped = messages
    .filter(
      (message) =>
        message.conversationId === conversation.id,
    )
    .sort(
      (left, right) =>
        left.occurredAt.getTime()
        - right.occurredAt.getTime(),
    );

  return {
    conversation,
    messageCount: scoped.length,
    inboundCount: scoped.filter(
      (message) => message.direction === 'INBOUND',
    ).length,
    outboundCount: scoped.filter(
      (message) => message.direction === 'OUTBOUND',
    ).length,
    lastMessage:
      scoped.length === 0
        ? null
        : scoped[scoped.length - 1] ?? null,
  };
}
