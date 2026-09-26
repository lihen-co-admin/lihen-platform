-- Marketing Social — Server-Controlled Publication Execution Foundation
--
-- Adds service-role-only bridges for the existing governed START/COMPLETE RPCs.
-- External provider execution remains controlled by the Edge Function and is
-- disabled unless explicitly enabled through server-side configuration.

create or replace function public.start_marketing_publication_attempt_server_controlled(
  p_actor_id uuid,
  p_operation_key text,
  p_attempt_id uuid
)
returns setof public.marketing_publication_attempts
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_actor_id is null then
    raise exception using errcode = '42501', message = 'LIHEN_AUTH_REQUIRED';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = p_actor_id
      and p.authorization_status = 'ACTIVE'
      and p.role_code in ('OWNER', 'ADMIN')
  ) then
    raise exception using
      errcode = '42501',
      message = 'LIHEN_MARKETING_SOCIAL_SERVER_EXECUTION_FORBIDDEN';
  end if;

  perform set_config('request.jwt.claim.sub', p_actor_id::text, true);

  return query
  select * from public.start_marketing_publication_attempt_controlled(
    p_operation_key,
    p_attempt_id
  );
end;
$$;

revoke execute on function
  public.start_marketing_publication_attempt_server_controlled(uuid, text, uuid)
from public, anon, authenticated;

grant execute on function
  public.start_marketing_publication_attempt_server_controlled(uuid, text, uuid)
to service_role;

create or replace function public.complete_marketing_publication_attempt_server_controlled(
  p_actor_id uuid,
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
begin
  if p_actor_id is null then
    raise exception using errcode = '42501', message = 'LIHEN_AUTH_REQUIRED';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = p_actor_id
      and p.authorization_status = 'ACTIVE'
      and p.role_code in ('OWNER', 'ADMIN')
  ) then
    raise exception using
      errcode = '42501',
      message = 'LIHEN_MARKETING_SOCIAL_SERVER_EXECUTION_FORBIDDEN';
  end if;

  perform set_config('request.jwt.claim.sub', p_actor_id::text, true);

  return query
  select * from public.complete_marketing_publication_attempt_controlled(
    p_operation_key,
    p_attempt_id,
    p_outcome,
    p_result_value
  );
end;
$$;

revoke execute on function
  public.complete_marketing_publication_attempt_server_controlled(uuid, text, uuid, text, text)
from public, anon, authenticated;

grant execute on function
  public.complete_marketing_publication_attempt_server_controlled(uuid, text, uuid, text, text)
to service_role;

comment on function public.start_marketing_publication_attempt_server_controlled(uuid, text, uuid)
is 'Service-role-only bridge for governed START transition. Performs no provider call.';

comment on function public.complete_marketing_publication_attempt_server_controlled(uuid, text, uuid, text, text)
is 'Service-role-only bridge for governed COMPLETE transition after a provider result.';
