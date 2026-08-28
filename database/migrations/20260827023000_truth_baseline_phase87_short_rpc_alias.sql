-- Truth & Architecture Baseline closure: stable short alias for Phase 8.7 readiness.
-- PostgreSQL identifiers are limited to 63 bytes. Keep browser-facing RPC names safely below that boundary.

create or replace function public.get_phase87_release_readiness_controlled()
returns setof lihen_private.phase8_7_release_governance_hardening_closure_readiness
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'LIHEN_AUTH_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_actor
      and p.authorization_status = 'ACTIVE'
      and p.role_code in ('OWNER', 'ADMIN')
  ) then
    raise exception using errcode = '42501', message = 'LIHEN_PHASE8_7_READ_FORBIDDEN';
  end if;

  return query
  select *
  from lihen_private.phase8_7_release_governance_hardening_closure_readiness;
end;
$$;

revoke all on function public.get_phase87_release_readiness_controlled() from public, anon;
grant execute on function public.get_phase87_release_readiness_controlled() to authenticated, postgres;
