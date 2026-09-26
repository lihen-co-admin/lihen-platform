-- SOCIAL-10 — Marketing Social Publication Execution Foundation
-- STATIC ONLY / NOT APPLIED BY THIS CHANGE.
-- Governs PublicationAttempt execution-state persistence.
-- Performs no external social publication.

create table if not exists
  lihen_private.marketing_publication_attempt_execution_operations (
    operation_key text primary key,
    actor_id uuid not null
      references auth.users(id) on delete restrict,
    attempt_id uuid not null,
    operation_type text not null,
    outcome text,
    result_value text,
    created_at timestamptz not null default now(),

    constraint marketing_publication_attempt_execution_key_not_blank
      check (length(btrim(operation_key)) > 0),

    constraint marketing_publication_attempt_execution_type_check
      check (
        operation_type in ('START', 'COMPLETE')
      ),

    constraint marketing_publication_attempt_execution_outcome_check
      check (
        outcome is null
        or outcome in ('SUCCEEDED', 'FAILED')
      )
  );

revoke all
on table
  lihen_private.marketing_publication_attempt_execution_operations
from public, anon, authenticated;


create or replace function
  public.start_marketing_publication_attempt_controlled(
    p_operation_key text,
    p_attempt_id uuid
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
  v_existing_operation_type text;
  v_status text;
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

  if p_attempt_id is null then
    raise exception using
      errcode = '22023',
      message = 'LIHEN_MARKETING_SOCIAL_ENTITY_ID_REQUIRED';
  end if;

  select
    o.actor_id,
    o.attempt_id,
    o.operation_type
  into
    v_existing_actor_id,
    v_existing_attempt_id,
    v_existing_operation_type
  from
    lihen_private.marketing_publication_attempt_execution_operations o
  where o.operation_key = btrim(p_operation_key);

  if v_existing_attempt_id is not null then
    if v_existing_actor_id <> v_actor_id
       or v_existing_attempt_id <> p_attempt_id
       or v_existing_operation_type <> 'START' then
      raise exception using
        errcode = '23505',
        message =
          'LIHEN_MARKETING_SOCIAL_WRITE_OPERATION_CONFLICT';
    end if;

    return query
    select attempt.*
    from public.marketing_publication_attempts attempt
    where attempt.id = p_attempt_id;

    return;
  end if;

  select attempt.status
  into v_status
  from public.marketing_publication_attempts attempt
  where attempt.id = p_attempt_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message =
        'LIHEN_MARKETING_SOCIAL_PUBLICATION_ATTEMPT_NOT_FOUND';
  end if;

  if v_status <> 'PENDING' then
    raise exception using
      errcode = '23514',
      message =
        'LIHEN_MARKETING_SOCIAL_PUBLICATION_ATTEMPT_NOT_PENDING';
  end if;

  update public.marketing_publication_attempts
  set
    status = 'IN_PROGRESS',
    started_at = now(),
    completed_at = null,
    external_publication_ref = null,
    failure_code = null
  where id = p_attempt_id;

  insert into
    lihen_private.marketing_publication_attempt_execution_operations (
      operation_key,
      actor_id,
      attempt_id,
      operation_type,
      outcome,
      result_value
    )
  values (
    btrim(p_operation_key),
    v_actor_id,
    p_attempt_id,
    'START',
    null,
    null
  );

  return query
  select attempt.*
  from public.marketing_publication_attempts attempt
  where attempt.id = p_attempt_id;
end;
$$;


create or replace function
  public.complete_marketing_publication_attempt_controlled(
    p_operation_key text,
    p_attempt_id uuid,
    p_outcome text,
    p_result_value text
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
  v_existing_operation_type text;
  v_existing_outcome text;
  v_existing_result_value text;
  v_status text;
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

  if p_attempt_id is null then
    raise exception using
      errcode = '22023',
      message = 'LIHEN_MARKETING_SOCIAL_ENTITY_ID_REQUIRED';
  end if;

  if p_outcome not in ('SUCCEEDED', 'FAILED') then
    raise exception using
      errcode = '22023',
      message =
        'LIHEN_MARKETING_SOCIAL_PUBLICATION_OUTCOME_INVALID';
  end if;

  if p_result_value is null
     or length(btrim(p_result_value)) = 0 then
    raise exception using
      errcode = '22023',
      message =
        'LIHEN_MARKETING_SOCIAL_PUBLICATION_RESULT_REQUIRED';
  end if;

  select
    o.actor_id,
    o.attempt_id,
    o.operation_type,
    o.outcome,
    o.result_value
  into
    v_existing_actor_id,
    v_existing_attempt_id,
    v_existing_operation_type,
    v_existing_outcome,
    v_existing_result_value
  from
    lihen_private.marketing_publication_attempt_execution_operations o
  where o.operation_key = btrim(p_operation_key);

  if v_existing_attempt_id is not null then
    if v_existing_actor_id <> v_actor_id
       or v_existing_attempt_id <> p_attempt_id
       or v_existing_operation_type <> 'COMPLETE'
       or v_existing_outcome <> p_outcome
       or v_existing_result_value <> p_result_value then
      raise exception using
        errcode = '23505',
        message =
          'LIHEN_MARKETING_SOCIAL_WRITE_OPERATION_CONFLICT';
    end if;

    return query
    select attempt.*
    from public.marketing_publication_attempts attempt
    where attempt.id = p_attempt_id;

    return;
  end if;

  select attempt.status
  into v_status
  from public.marketing_publication_attempts attempt
  where attempt.id = p_attempt_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message =
        'LIHEN_MARKETING_SOCIAL_PUBLICATION_ATTEMPT_NOT_FOUND';
  end if;

  if v_status <> 'IN_PROGRESS' then
    raise exception using
      errcode = '23514',
      message =
        'LIHEN_MARKETING_SOCIAL_PUBLICATION_ATTEMPT_NOT_IN_PROGRESS';
  end if;

  if p_outcome = 'SUCCEEDED' then
    update public.marketing_publication_attempts
    set
      status = 'SUCCEEDED',
      completed_at = now(),
      external_publication_ref = btrim(p_result_value),
      failure_code = null
    where id = p_attempt_id;
  else
    update public.marketing_publication_attempts
    set
      status = 'FAILED',
      completed_at = now(),
      external_publication_ref = null,
      failure_code = btrim(p_result_value)
    where id = p_attempt_id;
  end if;

  insert into
    lihen_private.marketing_publication_attempt_execution_operations (
      operation_key,
      actor_id,
      attempt_id,
      operation_type,
      outcome,
      result_value
    )
  values (
    btrim(p_operation_key),
    v_actor_id,
    p_attempt_id,
    'COMPLETE',
    p_outcome,
    btrim(p_result_value)
  );

  return query
  select attempt.*
  from public.marketing_publication_attempts attempt
  where attempt.id = p_attempt_id;
end;
$$;


revoke execute
on function public.start_marketing_publication_attempt_controlled(
  text, uuid
)
from public;

revoke execute
on function public.start_marketing_publication_attempt_controlled(
  text, uuid
)
from anon;

revoke execute
on function public.start_marketing_publication_attempt_controlled(
  text, uuid
)
from authenticated;


revoke execute
on function public.complete_marketing_publication_attempt_controlled(
  text, uuid, text, text
)
from public;

revoke execute
on function public.complete_marketing_publication_attempt_controlled(
  text, uuid, text, text
)
from anon;

revoke execute
on function public.complete_marketing_publication_attempt_controlled(
  text, uuid, text, text
)
from authenticated;


revoke insert, update, delete
on table public.marketing_publication_attempts
from anon, authenticated;


comment on function
  public.start_marketing_publication_attempt_controlled(
    text, uuid
  )
is
  'Transitions a governed publication attempt from PENDING to IN_PROGRESS. '
  'It performs no external provider execution.';

comment on function
  public.complete_marketing_publication_attempt_controlled(
    text, uuid, text, text
  )
is
  'Records the governed result of an IN_PROGRESS publication attempt. '
  'It performs no external provider execution.';
