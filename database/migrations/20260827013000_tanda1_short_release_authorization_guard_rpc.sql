-- TANDA 1 · Stable short RPC alias for the Phase 8 release authorization guard.
-- PostgreSQL identifiers are limited to NAMEDATALEN-1 bytes (63 by default), so the
-- original long function name is unsafe through PostgREST schema discovery.
create or replace function public.get_cc_release_auth_guard_controlled()
returns table(
  operation_code text,
  domain_code text,
  risk_level text,
  canary_eligible boolean,
  canary_enabled boolean,
  max_canary_attempts_per_hour integer,
  dispatch_allowed boolean,
  approval_state text,
  release_request_id uuid,
  request_status text,
  requested_environment text,
  expires_at timestamptz,
  release_authorized boolean,
  guard_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception using errcode='42501', message='LIHEN_AUTH_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_actor
      and p.authorization_status = 'ACTIVE'
      and p.role_code in ('OWNER','ADMIN')
  ) then
    raise exception using errcode='42501', message='LIHEN_RELEASE_AUTHORIZATION_GUARD_READ_FORBIDDEN';
  end if;

  return query
  select
    g.operation_code,
    g.domain_code,
    g.risk_level,
    g.canary_eligible,
    g.canary_enabled,
    g.max_canary_attempts_per_hour,
    g.dispatch_allowed,
    g.approval_state,
    g.release_request_id,
    g.request_status,
    g.requested_environment,
    g.expires_at,
    g.release_authorized,
    g.guard_status
  from lihen_private.control_center_operation_release_authorization_guard g
  order by g.domain_code, g.operation_code;
end;
$$;

revoke all on function public.get_cc_release_auth_guard_controlled() from public, anon;
grant execute on function public.get_cc_release_auth_guard_controlled() to authenticated, postgres;
