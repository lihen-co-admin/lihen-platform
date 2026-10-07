-- Local-only governed preparation. Immutable revisions; approval has no sending side effect.
begin;

create table public.conversation_reply_drafts (
 id uuid primary key,
 conversation_id uuid not null references public.conversations(id) on delete restrict,
 previous_id uuid references public.conversation_reply_drafts(id) on delete restrict,
 revision integer not null check (revision > 0),
 body text not null check (length(btrim(body)) between 1 and 20000),
 status text not null check (status in ('DRAFT','READY_FOR_REVIEW','APPROVED')),
 created_by uuid not null references public.profiles(id),
 created_at timestamptz not null default clock_timestamp(),
 reviewed_by uuid references public.profiles(id), reviewed_at timestamptz,
 constraint conversation_draft_review_check check ((status = 'APPROVED') = (reviewed_by is not null and reviewed_at is not null)),
 unique (conversation_id, revision)
);
alter table public.conversation_reply_drafts enable row level security;
revoke all on public.conversation_reply_drafts from public, anon, authenticated;
grant select on public.conversation_reply_drafts to authenticated;
create policy conversation_reply_drafts_owner_admin_read on public.conversation_reply_drafts for select to authenticated using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.authorization_status = 'ACTIVE' and p.role_code in ('OWNER', 'ADMIN')));

create function public.save_conversation_reply_drafts_controlled(
 p_id uuid, p_conversation_id uuid, p_expected_id uuid, p_body text, p_status text
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
 v_actor uuid := auth.uid();
 v_previous public.conversation_reply_drafts%rowtype;
 v_existing public.conversation_reply_drafts%rowtype;
 v_result public.conversation_reply_drafts%rowtype;
begin
 if v_actor is null or not (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.authorization_status = 'ACTIVE' and p.role_code in ('OWNER', 'ADMIN'))) then raise exception 'PREPARATION_PERMISSION_DENIED' using errcode = '42501'; end if;
 if p_id is null or p_conversation_id is null or p_body is null or length(btrim(p_body)) not between 1 and 20000 or p_status is null or p_status not in ('DRAFT','READY_FOR_REVIEW','APPROVED') then raise exception 'PREPARATION_INVALID_INPUT'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_conversation_id::text, 0));
 select * into v_existing from public.conversation_reply_drafts where id = p_id;
 if found then
   if v_existing.conversation_id <> p_conversation_id or v_existing.created_by <> v_actor or v_existing.previous_id is distinct from p_expected_id or v_existing.body <> btrim(p_body) or v_existing.status <> p_status  then raise exception 'PREPARATION_IDEMPOTENCY_CONFLICT'; end if;
   return to_jsonb(v_existing);
 end if;
 select * into v_previous from public.conversation_reply_drafts where conversation_id = p_conversation_id order by revision desc limit 1;
 if v_previous.id is distinct from p_expected_id then raise exception 'PREPARATION_STALE_REVISION'; end if;
 if v_previous.id is null and p_status <> 'DRAFT' then raise exception 'PREPARATION_DRAFT_REQUIRED'; end if;
 if p_status = 'APPROVED' and (v_previous.status is distinct from 'READY_FOR_REVIEW' or v_previous.body is distinct from btrim(p_body)) then raise exception 'PREPARATION_REVIEW_REQUIRED'; end if;
 insert into public.conversation_reply_drafts (id, conversation_id, previous_id, revision, body, status, created_by, reviewed_by, reviewed_at)
 values (p_id, p_conversation_id, v_previous.id, coalesce(v_previous.revision,0)+1, btrim(p_body), p_status, v_actor,
 case when p_status = 'APPROVED' then v_actor end, case when p_status = 'APPROVED' then clock_timestamp() end) returning * into v_result;
 return to_jsonb(v_result);
end;
$$;
revoke all on function public.save_conversation_reply_drafts_controlled(uuid,uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.save_conversation_reply_drafts_controlled(uuid,uuid,uuid,text,text) to authenticated;

create table public.conversation_follow_ups (
 id uuid primary key,
 conversation_id uuid not null references public.conversations(id) on delete restrict,
 previous_id uuid references public.conversation_follow_ups(id) on delete restrict,
 revision integer not null check (revision > 0),
 reason text not null check (length(btrim(reason)) between 1 and 20000),
 status text not null check (status in ('OPEN','DONE','CANCELLED')),
 created_by uuid not null references public.profiles(id),
 created_at timestamptz not null default clock_timestamp(),
 due_at timestamptz, completed_at timestamptz,
 constraint conversation_follow_up_completion_check check ((status = 'DONE') = (completed_at is not null)),
 unique (conversation_id, revision)
);
alter table public.conversation_follow_ups enable row level security;
revoke all on public.conversation_follow_ups from public, anon, authenticated;
grant select on public.conversation_follow_ups to authenticated;
create policy conversation_follow_ups_owner_admin_read on public.conversation_follow_ups for select to authenticated using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.authorization_status = 'ACTIVE' and p.role_code in ('OWNER', 'ADMIN')));

create function public.save_conversation_follow_ups_controlled(
 p_id uuid, p_conversation_id uuid, p_expected_id uuid, p_reason text, p_status text, p_due_at timestamptz default null
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
 v_actor uuid := auth.uid();
 v_previous public.conversation_follow_ups%rowtype;
 v_existing public.conversation_follow_ups%rowtype;
 v_result public.conversation_follow_ups%rowtype;
begin
 if v_actor is null or not (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.authorization_status = 'ACTIVE' and p.role_code in ('OWNER', 'ADMIN'))) then raise exception 'PREPARATION_PERMISSION_DENIED' using errcode = '42501'; end if;
 if p_id is null or p_conversation_id is null or p_reason is null or length(btrim(p_reason)) not between 1 and 20000 or p_status is null or p_status not in ('OPEN','DONE','CANCELLED') then raise exception 'PREPARATION_INVALID_INPUT'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_conversation_id::text, 0));
 select * into v_existing from public.conversation_follow_ups where id = p_id;
 if found then
   if v_existing.conversation_id <> p_conversation_id or v_existing.created_by <> v_actor or v_existing.previous_id is distinct from p_expected_id or v_existing.reason <> btrim(p_reason) or v_existing.status <> p_status or v_existing.due_at is distinct from p_due_at then raise exception 'PREPARATION_IDEMPOTENCY_CONFLICT'; end if;
   return to_jsonb(v_existing);
 end if;
 select * into v_previous from public.conversation_follow_ups where conversation_id = p_conversation_id order by revision desc limit 1;
 if v_previous.id is distinct from p_expected_id then raise exception 'PREPARATION_STALE_REVISION'; end if;
 if v_previous.id is null and p_status <> 'OPEN' then raise exception 'PREPARATION_OPEN_REQUIRED'; end if;
 insert into public.conversation_follow_ups (id, conversation_id, previous_id, revision, reason, status, created_by, due_at, completed_at)
 values (p_id, p_conversation_id, v_previous.id, coalesce(v_previous.revision,0)+1, btrim(p_reason), p_status, v_actor,
 p_due_at, case when p_status = 'DONE' then clock_timestamp() end) returning * into v_result;
 return to_jsonb(v_result);
end;
$$;
revoke all on function public.save_conversation_follow_ups_controlled(uuid,uuid,uuid,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.save_conversation_follow_ups_controlled(uuid,uuid,uuid,text,text,timestamptz) to authenticated;

grant select on public.conversations to authenticated;
create policy conversations_preparation_owner_admin_read on public.conversations for select to authenticated using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.authorization_status = 'ACTIVE' and p.role_code in ('OWNER', 'ADMIN')));

grant select on public.conversation_messages to authenticated;
create policy conversation_messages_preparation_owner_admin_read on public.conversation_messages for select to authenticated using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.authorization_status = 'ACTIVE' and p.role_code in ('OWNER', 'ADMIN')));

grant select on public.conversation_products to authenticated;
create policy conversation_products_preparation_owner_admin_read on public.conversation_products for select to authenticated using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.authorization_status = 'ACTIVE' and p.role_code in ('OWNER', 'ADMIN')));

commit;
