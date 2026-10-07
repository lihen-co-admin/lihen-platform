import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createConversationPreparationRepository } from '../src/composition/conversation-preparation';

const id = '11111111-1111-4111-8111-111111111111';
const draft = { id, conversation_id: id, previous_id: null, revision: 1, body: 'Respuesta', status: 'DRAFT', created_by: id, created_at: '2026-10-07', reviewed_at: null, reviewed_by: null };
describe('conversation preparation persistence', () => {
  it('saves approved revisions through RPC without functions or message writes', async () => {
    const rpc = vi.fn().mockResolvedValue({data: {...draft, status: 'APPROVED', reviewed_by: id, reviewed_at: '2026-10-07'}, error: null});
    const repository = createConversationPreparationRepository({rpc} as unknown as SupabaseClient);
    expect((await repository.saveDraft(id, id, id, 'Respuesta', 'APPROVED')).status).toBe('APPROVED');
    expect(rpc).toHaveBeenCalledExactlyOnceWith('save_conversation_reply_drafts_controlled', {p_id: id, p_conversation_id: id, p_expected_id: id, p_body: 'Respuesta', p_status: 'APPROVED'});
  });
  it('reads latest durable revisions and preserves null absence', async () => {
    const query = {select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValueOnce({data: draft,error: null}).mockResolvedValueOnce({data: null,error: null})};
    const repository = createConversationPreparationRepository({from: vi.fn().mockReturnValue(query)} as unknown as SupabaseClient);
    expect(await repository.read(id)).toEqual({draft,followUp: null});
    expect(query.order).toHaveBeenCalledWith('revision', {ascending:false});
  });
  it('propagates stale revision errors and uses caller stable ID for retries', async () => {
    const rpc = vi.fn().mockResolvedValue({data: null,error: {message:'PREPARATION_STALE_REVISION'}});
    const repository = createConversationPreparationRepository({rpc} as unknown as SupabaseClient);
    await expect(repository.saveDraft(id,id,null,'Respuesta','DRAFT')).rejects.toThrow('PREPARATION_STALE_REVISION');
    await expect(repository.saveDraft(id,id,null,'Respuesta','DRAFT')).rejects.toThrow();
    expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1]);
  });
  it('persists follow-up reason, due date and completion', async () => {
    const row = {...draft,reason:'Revisar pedido',due_at:null,completed_at:'2026-10-07',status:'DONE'};
    const rpc = vi.fn().mockResolvedValue({data:row,error:null});
    const repository = createConversationPreparationRepository({rpc} as unknown as SupabaseClient);
    expect((await repository.saveFollowUp(id,id,id,row.reason,null,'DONE')).status).toBe('DONE');
    expect(rpc).toHaveBeenCalledWith('save_conversation_follow_ups_controlled',expect.objectContaining({p_due_at:null,p_reason:row.reason,p_status:'DONE'}));
  });
  it('requires a loaded revision and human review before approval; has no sending surface', () => {
    const page=readFileSync(new URL('../src/components/ConversationPreparation.tsx',import.meta.url),'utf8');
    expect(page).toContain('!allowed || busy || !loaded');
    expect(page).toContain("draft?.status !== 'READY_FOR_REVIEW' || body !== draft.body");
    expect(page).toContain('WHATSAPP_SENDING_ENABLED=false');
    expect(page).not.toMatch(/functions\.invoke|EXECUTE_WHATSAPP|conversation_whatsapp_attempts/);
  });
});
