-- Run only against an EMPTY disposable PostgreSQL database with psql -v ON_ERROR_STOP=1.
-- Synthetic auth fixtures; never run against Supabase DEV or PROD.
\set ON_ERROR_STOP on
do $$ begin
  if to_regclass('public.profiles') is not null or to_regnamespace('auth') is not null then
    raise exception 'EMPTY_DISPOSABLE_DATABASE_REQUIRED';
  end if;
end $$;
create role anon;
create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated, anon;
create table public.profiles(id uuid primary key, role_code text, authorization_status text);
create table public.conversations(id uuid primary key);
create table public.conversation_messages(id uuid primary key);
create table public.conversation_products(id uuid primary key);
alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;
alter table public.conversation_products enable row level security;
grant select on public.profiles to authenticated;
insert into public.profiles values
('00000000-0000-4000-8000-000000000001','OWNER','ACTIVE'),
('00000000-0000-4000-8000-000000000002','STAFF','ACTIVE'),
('00000000-0000-4000-8000-000000000003','ADMIN','INACTIVE');
insert into public.conversations values ('00000000-0000-4000-8000-000000000010');
\ir ../../database/migrations/20261007213713_conversation_preparation_durability.sql

create function pg_temp.expect_error(statement text, expected text) returns void language plpgsql as $$
begin
  execute statement;
  raise exception 'EXPECTED_ERROR_NOT_RAISED';
exception when others then
  if position(expected in sqlerrm) = 0 then raise; end if;
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
select public.save_conversation_reply_drafts_controlled('00000000-0000-4000-8000-000000000020','00000000-0000-4000-8000-000000000010',null,'Reply','DRAFT');
-- Identical retry returns the same revision.
select public.save_conversation_reply_drafts_controlled('00000000-0000-4000-8000-000000000020','00000000-0000-4000-8000-000000000010',null,'Reply','DRAFT');
select pg_temp.expect_error($q$select public.save_conversation_reply_drafts_controlled('00000000-0000-4000-8000-000000000020','00000000-0000-4000-8000-000000000010',null,'Changed','DRAFT')$q$,'PREPARATION_IDEMPOTENCY_CONFLICT');
select pg_temp.expect_error($q$select public.save_conversation_reply_drafts_controlled('00000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000010',null,'Reply','DRAFT')$q$,'PREPARATION_STALE_REVISION');
select pg_temp.expect_error($q$select public.save_conversation_reply_drafts_controlled('00000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000020','Reply','APPROVED')$q$,'PREPARATION_REVIEW_REQUIRED');
select public.save_conversation_reply_drafts_controlled('00000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000020','Reply','READY_FOR_REVIEW');
select pg_temp.expect_error($q$select public.save_conversation_reply_drafts_controlled('00000000-0000-4000-8000-000000000022','00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000021','Changed','APPROVED')$q$,'PREPARATION_REVIEW_REQUIRED');
select public.save_conversation_reply_drafts_controlled('00000000-0000-4000-8000-000000000022','00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000021','Reply','APPROVED');
select public.save_conversation_follow_ups_controlled('00000000-0000-4000-8000-000000000030','00000000-0000-4000-8000-000000000010',null,'Review order','OPEN',null);
select public.save_conversation_follow_ups_controlled('00000000-0000-4000-8000-000000000031','00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000030','Review order','DONE',null);
select pg_temp.expect_error('delete from public.conversation_reply_drafts','permission denied');
select pg_temp.expect_error('update public.conversation_follow_ups set reason = ''tampered''','permission denied');
do $$ begin
  if (select count(*) from public.conversation_reply_drafts) <> 3 then raise exception 'REVISION_COUNT'; end if;
  if not exists(select 1 from public.conversation_reply_drafts where status='APPROVED' and reviewed_by=auth.uid() and reviewed_at is not null) then raise exception 'REVIEW_AUDIT'; end if;
  if not exists(select 1 from public.conversation_follow_ups where status='DONE' and completed_at is not null) then raise exception 'COMPLETION_AUDIT'; end if;
  if (select count(*) from public.conversation_messages) <> 0 then raise exception 'APPROVAL_SENT_MESSAGE'; end if;
end $$;
-- RLS and RPC deny active non-admin and inactive admin.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
do $$ begin if exists(select 1 from public.conversation_reply_drafts) then raise exception 'RLS_DENY_FAILED'; end if; end $$;
select pg_temp.expect_error($q$select public.save_conversation_reply_drafts_controlled('00000000-0000-4000-8000-000000000040','00000000-0000-4000-8000-000000000010',null,'Reply','DRAFT')$q$,'PREPARATION_PERMISSION_DENIED');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',false);
select pg_temp.expect_error($q$select public.save_conversation_follow_ups_controlled('00000000-0000-4000-8000-000000000040','00000000-0000-4000-8000-000000000010',null,'Review','OPEN',null)$q$,'PREPARATION_PERMISSION_DENIED');
reset role;
do $$ begin
  if has_function_privilege('anon','public.save_conversation_reply_drafts_controlled(uuid,uuid,uuid,text,text)','execute') then raise exception 'ANON_EXECUTE'; end if;
  if has_table_privilege('authenticated','public.conversation_reply_drafts','insert') then raise exception 'DIRECT_INSERT'; end if;
end $$;
select 'PASS: durability, audit, review, idempotency, concurrency, RLS, grants, no sending' as result;
