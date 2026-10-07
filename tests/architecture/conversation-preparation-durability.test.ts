import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const sql = readFileSync('database/migrations/20261007213713_conversation_preparation_durability.sql','utf8');
describe('governed conversation preparation migration', () => {
  it('preserves immutable audited revisions with canonical conversations', () => {
    for(const table of ['conversation_reply_drafts','conversation_follow_ups']) {
      expect(sql).toContain(`create table public.${table}`);
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      expect(sql).toContain(`revoke all on public.${table} from public, anon, authenticated`);
      expect(sql).toContain(`grant select on public.${table} to authenticated`);
    }
    expect(sql.match(/unique \(conversation_id, revision\)/g)).toHaveLength(2);
    expect(sql.match(/references public.conversations\(id\) on delete restrict/g)).toHaveLength(2);
    expect(sql).not.toMatch(/grant (insert|update|delete|all)\b/i);
    expect(sql).toContain('created_by uuid not null references public.profiles(id)');
  });
  it('enforces authorization, idempotency, concurrency and explicit review', () => {
    expect(sql.match(/security definer set search_path = public, pg_temp/g)).toHaveLength(2);
    expect(sql).toContain("p.authorization_status = 'ACTIVE' and p.role_code in ('OWNER', 'ADMIN')");
    expect(sql).toContain('v_actor is null');
    expect(sql).toContain('PREPARATION_IDEMPOTENCY_CONFLICT');
    expect(sql).toContain('PREPARATION_STALE_REVISION');
    expect(sql).toContain('pg_advisory_xact_lock');
    expect(sql).toContain("v_previous.status is distinct from 'READY_FOR_REVIEW'");
    expect(sql).toContain('v_previous.body is distinct from btrim(p_body)');
    expect(sql.match(/revoke all on function/g)).toHaveLength(2);
  });
  it('never inserts messages or attempts and has no sending/provider side effects', () => {
    expect(sql).not.toMatch(/insert into public\.(conversation_messages|conversation_whatsapp_attempts)/i);
    expect(sql).not.toMatch(/http_|net\.|cron\.|access_token|execute_whatsapp/i);
  });
});
