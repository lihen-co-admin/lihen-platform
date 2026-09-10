export const conversationChannels = [
  'WHATSAPP',
  'INSTAGRAM',
  'FACEBOOK',
  'TIKTOK',
  'WEB',
  'OTHER',
] as const;

export type ConversationChannel =
  (typeof conversationChannels)[number];

export const conversationStatuses = [
  'OPEN',
  'WAITING_CUSTOMER',
  'WAITING_LIHEN',
  'RESOLVED',
  'CLOSED',
] as const;

export type ConversationStatus =
  (typeof conversationStatuses)[number];

export const conversationIntentKinds = [
  'GENERAL_INQUIRY',
  'PRODUCT_INQUIRY',
  'PRICE_INQUIRY',
  'PURCHASE_INTENT',
  'ORDER_STATUS',
  'ORDER_PROBLEM',
  'DISSATISFACTION',
  'FOLLOW_UP',
  'OTHER',
] as const;

export type ConversationIntentKind =
  (typeof conversationIntentKinds)[number];

export interface Conversation {
  readonly id: string;
  readonly channel: ConversationChannel;
  readonly externalThreadRef: string | null;
  readonly customerId: string | null;
  readonly orderId: string | null;
  readonly productIds: readonly string[];
  readonly status: ConversationStatus;
  readonly startedAt: Date;
  readonly lastActivityAt: Date;
}

export interface ConversationMessage {
  readonly id: string;
  readonly conversationId: string;
  readonly direction: 'INBOUND' | 'OUTBOUND';
  readonly senderRole: 'CUSTOMER' | 'LIHEN' | 'SYSTEM';
  readonly body: string;
  readonly occurredAt: Date;
}

export interface ConversationIntent {
  readonly conversationId: string;
  readonly kind: ConversationIntentKind;
  readonly confidence: number;
  readonly rationale: readonly string[];
}

export interface SuggestedReply {
  readonly conversationId: string;
  readonly body: string;
  readonly status: 'DRAFT' | 'READY_FOR_REVIEW' | 'APPROVED';
  readonly generatedAt: Date;
}

export interface ConversationFollowUp {
  readonly conversationId: string;
  readonly reason: string;
  readonly dueAt: Date | null;
  readonly status: 'OPEN' | 'DONE' | 'CANCELLED';
}
