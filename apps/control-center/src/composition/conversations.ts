import { getBrowserSupabaseClient } from '@lihen/database';
import type { Conversation, ConversationMessage } from '@lihen/conversation';

// Uses the existing CONVERSATION-01 tables and the caller's RLS session.
// No service key, inbound ingestion or send operation is part of this surface.
export async function readConversations() {
  const client = getBrowserSupabaseClient(import.meta.env);
  const [threads, messages, products] = await Promise.all([
    client
      .from('conversations')
      .select('*')
      .order('last_activity_at', { ascending: false })
      .limit(100),
    client
      .from('conversation_messages')
      .select('*')
      .order('occurred_at', { ascending: false })
      .limit(500),
    client.from('conversation_products').select('conversation_id,product_id').limit(1000),
  ]);
  for (const result of [threads, messages, products])
    if (result.error)
      throw new Error(
        'Lectura de Conversation no habilitada para esta sesión. La base durable requiere permisos de lectura; no se han modificado remotamente.',
      );
  return {
    conversations: (threads.data ?? []).map((row): Conversation => ({
      id: row.id,
      channel: row.channel,
      externalThreadRef: row.external_thread_ref,
      customerId: row.customer_id,
      orderId: row.order_id,
      productIds: (products.data ?? [])
        .filter((entry) => entry.conversation_id === row.id)
        .map((entry) => entry.product_id),
      status: row.status,
      startedAt: new Date(row.started_at),
      lastActivityAt: new Date(row.last_activity_at),
    })),
    messages: (messages.data ?? []).map((row): ConversationMessage => ({
      id: row.id,
      conversationId: row.conversation_id,
      direction: row.direction,
      senderRole: row.sender_role,
      body: row.body,
      occurredAt: new Date(row.occurred_at),
    })),
  };
}
