-- SOCIAL-09 — Marketing Social Publication Orchestration Foundation
-- External Execution Blocked
--
-- Creates only governed PENDING publication-attempt persistence.
-- This migration does NOT publish content, contact providers, execute
-- schedules, send messages, or authorize external social operations.

create table if not exists
  lihen_private.marketing_publication_attempt_operations (
    operation_key text primary key,
    actor_id uuid not null
      references auth.users(id) on delete restrict,
    attempt_id uuid not null,
    prepared_publication_id uuid not null,
    created_at timestamptz not null default now(),

    constraint marketing_publication_attempt_operations_key_not_blank
      check (length(btrim(operation_key)) > 0),

    constraint marketing_publication_attempt_operations_attempt_unique
      unique (attempt_id)
  );

revoke all
on table lihen_private.marketing_publication_attempt_operations
from public, anon, authenticated;


create or replace function
  public.create_marketing_publication_attempt_controlled(
    p_operation_key text,
    p_id uuid,
    p_prepared_publication_id uuid
  )
returns setof public.marketing_publication_attempts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_existing_actor_id uuid;
  v_existing_attempt_id uuid;
  v_existing_prepared_publication_id uuid;
  v_schedule_id uuid;
  v_publication_status text;
  v_schedule_status text;
  v_scheduled_for timestamptz;
  v_attempt_number integer;
begin
  v_actor_id := (select auth.uid());

  if v_actor_id is null then
    raise exception using
      errcode = '42501',
      message = 'LIHEN_AUTH_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_actor_id
      and p.authorization_status = 'ACTIVE'
      and p.role_code in ('OWNER', 'ADMIN')
  ) then
    raise exception using
      errcode = '42501',
      message = 'LIHEN_MARKETING_SOCIAL_WRITE_FORBIDDEN';
  end if;

  if p_operation_key is null
     or length(btrim(p_operation_key)) = 0 then
    raise exception using
      errcode = '22023',
      message = 'LIHEN_OPERATION_KEY_REQUIRED';
  end if;

  if p_id is null or p_prepared_publication_id is null then
    raise exception using
      errcode = '22023',
      message = 'LIHEN_MARKETING_SOCIAL_ENTITY_ID_REQUIRED';
  end if;

  select
    o.actor_id,
    o.attempt_id,
    o.prepared_publication_id
  into
    v_existing_actor_id,
    v_existing_attempt_id,
    v_existing_prepared_publication_id
  from lihen_private.marketing_publication_attempt_operations o
  where o.operation_key = btrim(p_operation_key);

  if v_existing_attempt_id is not null then
    if v_existing_actor_id <> v_actor_id
       or v_existing_attempt_id <> p_id
       or v_existing_prepared_publication_id
            <> p_prepared_publication_id then
      raise exception using
        errcode = '23505',
        message =
          'LIHEN_MARKETING_SOCIAL_WRITE_OPERATION_CONFLICT';
    end if;

    if not exists (
      select 1
      from public.marketing_publication_attempts attempt
      where attempt.id = v_existing_attempt_id
        and attempt.prepared_publication_id =
          v_existing_prepared_publication_id
    ) then
      raise exception using
        errcode = '23505',
        message =
          'LIHEN_MARKETING_SOCIAL_WRITE_OPERATION_CONFLICT';
    end if;

    return query
    select attempt.*
    from public.marketing_publication_attempts attempt
    where attempt.id = v_existing_attempt_id
      and attempt.prepared_publication_id =
        v_existing_prepared_publication_id;

    return;
  end if;

  -- Lock the aggregate root so attempt-number allocation is
  -- serialized for this PreparedPublication.
  select
    publication.status,
    publication.schedule_id
  into
    v_publication_status,
    v_schedule_id
  from public.marketing_prepared_publications publication
  where publication.id = p_prepared_publication_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message =
        'LIHEN_MARKETING_SOCIAL_PREPARED_PUBLICATION_NOT_FOUND';
  end if;

  if v_publication_status <> 'APPROVED' then
    raise exception using
      errcode = '23514',
      message =
        'LIHEN_MARKETING_SOCIAL_PUBLICATION_NOT_APPROVED';
  end if;

  if v_schedule_id is null then
    raise exception using
      errcode = '23514',
      message =
        'LIHEN_MARKETING_SOCIAL_PUBLICATION_SCHEDULE_REQUIRED';
  end if;

  select
    schedule.status,
    schedule.scheduled_for
  into
    v_schedule_status,
    v_scheduled_for
  from public.marketing_content_schedules schedule
  where schedule.id = v_schedule_id;

  if not found then
    raise exception using
      errcode = 'P0002',
      message =
        'LIHEN_MARKETING_SOCIAL_SCHEDULE_NOT_FOUND';
  end if;

  if v_schedule_status <> 'APPROVED' then
    raise exception using
      errcode = '23514',
      message =
        'LIHEN_MARKETING_SOCIAL_SCHEDULE_NOT_APPROVED';
  end if;

  if v_scheduled_for > now() then
    raise exception using
      errcode = '23514',
      message =
        'LIHEN_MARKETING_SOCIAL_PUBLICATION_NOT_DUE';
  end if;

  if exists (
    select 1
    from public.marketing_publication_attempts attempt
    where attempt.id = p_id
  ) then
    raise exception using
      errcode = '23505',
      message =
        'LIHEN_MARKETING_SOCIAL_WRITE_OPERATION_CONFLICT';
  end if;

  select coalesce(max(attempt.attempt_number), 0) + 1
  into v_attempt_number
  from public.marketing_publication_attempts attempt
  where attempt.prepared_publication_id =
    p_prepared_publication_id;

  insert into public.marketing_publication_attempts (
    id,
    prepared_publication_id,
    attempt_number,
    status,
    started_at,
    completed_at,
    external_publication_ref,
    failure_code
  ) values (
    p_id,
    p_prepared_publication_id,
    v_attempt_number,
    'PENDING',
    null,
    null,
    null,
    null
  );

  insert into
    lihen_private.marketing_publication_attempt_operations (
      operation_key,
      actor_id,
      attempt_id,
      prepared_publication_id
    )
  values (
    btrim(p_operation_key),
    v_actor_id,
    p_id,
    p_prepared_publication_id
  );

  return query
  select attempt.*
  from public.marketing_publication_attempts attempt
  where attempt.id = p_id;
end;
$$;


revoke execute
on function public.create_marketing_publication_attempt_controlled(
  text, uuid, uuid
)
from public;

revoke execute
on function public.create_marketing_publication_attempt_controlled(
  text, uuid, uuid
)
from anon;

revoke execute
on function public.create_marketing_publication_attempt_controlled(
  text, uuid, uuid
)
from authenticated;


-- Direct attempt mutation remains unavailable to application roles.
revoke insert, update, delete
on table public.marketing_publication_attempts
from anon, authenticated;


comment on function
  public.create_marketing_publication_attempt_controlled(
    text, uuid, uuid
  )
is
  'Creates only a governed PENDING publication attempt. '
  'It performs no external publication or provider execution.';
