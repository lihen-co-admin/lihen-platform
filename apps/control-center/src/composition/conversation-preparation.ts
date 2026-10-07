import { getBrowserSupabaseClient } from '@lihen/database';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

const common = { id: z.string().uuid(), conversation_id: z.string().uuid(), previous_id: z.string().uuid().nullable(), revision: z.number().int(), created_by: z.string().uuid(), created_at: z.string() };
export const draftSchema = z.object({ ...common, body: z.string(), status: z.enum(['DRAFT', 'READY_FOR_REVIEW', 'APPROVED']), reviewed_by: z.string().nullable(), reviewed_at: z.string().nullable() });
export const followUpSchema = z.object({ ...common, reason: z.string(), status: z.enum(['OPEN', 'DONE', 'CANCELLED']), due_at: z.string().nullable(), completed_at: z.string().nullable() });
export type ReplyDraft = z.infer<typeof draftSchema>;
export type FollowUp = z.infer<typeof followUpSchema>;
export function createConversationPreparationRepository(client: SupabaseClient) {
  async function latest(table: string, conversationId: string) {
    const { data, error } = await client.from(table).select('*').eq('conversation_id', z.string().uuid().parse(conversationId)).order('revision', { ascending: false }).limit(1).maybeSingle();
    if (error) throw new Error(`Persistencia no disponible: ${error.message}`);
    return data;
  }
  async function save(name: string, args: Record<string, unknown>) {
    const { data, error } = await client.rpc(name, args);
    if (error) throw new Error(error.message);
    return data;
  }
  return {
    async read(conversationId: string) {
      const [draft, followUp] = await Promise.all([latest('conversation_reply_drafts', conversationId), latest('conversation_follow_ups', conversationId)]);
      return { draft: draft ? draftSchema.parse(draft) : null, followUp: followUp ? followUpSchema.parse(followUp) : null };
    },
    async saveDraft(id: string, conversationId: string, previousId: string | null, body: string, status: ReplyDraft['status']) {
      return draftSchema.parse(await save('save_conversation_reply_drafts_controlled', { p_id: id, p_conversation_id: conversationId, p_expected_id: previousId, p_body: body, p_status: status }));
    },
    async saveFollowUp(id: string, conversationId: string, previousId: string | null, reason: string, dueAt: string | null, status: FollowUp['status']) {
      return followUpSchema.parse(await save('save_conversation_follow_ups_controlled', { p_id: id, p_conversation_id: conversationId, p_expected_id: previousId, p_reason: reason, p_due_at: dueAt, p_status: status }));
    },
  };
}
export const conversationPreparationRepository = () => createConversationPreparationRepository(getBrowserSupabaseClient(import.meta.env));
