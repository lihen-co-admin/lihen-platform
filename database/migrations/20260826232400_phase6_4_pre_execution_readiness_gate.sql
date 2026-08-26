create or replace view lihen_private.phase6_4_pre_execution_readiness as
with gates as (
  select
    count(*) filter(where phase_code in ('6.1A','6.1B','6.1C','6.2','6.3'))::int as required_gates,
    count(*) filter(where phase_code in ('6.1A','6.1B','6.1C','6.2','6.3') and status='PASS')::int as passed_gates
  from lihen_private.phase_exit_gate_results
), catalog as (
  select count(*)::int as operations,
         count(*) filter(where execution_enabled=false)::int as execution_disabled
  from lihen_private.control_center_operation_catalog
), policies as (
  select count(*) filter(where release_status='HELD')::int as held,
         count(*) filter(where max_execution_attempts_per_hour=0)::int as zero_attempt_budget,
         count(*) filter(where allowed_environment='DEV_ONLY')::int as dev_only
  from lihen_private.control_center_operation_execution_policy
), contracts as (
  select count(*)::int as contracts,
         count(*) filter(where function_oid is not null and operation_key_first)::int as valid_contracts
  from lihen_private.control_center_operation_contract_registry
), style as (
  select count(*) filter(where status='ACTIVE')::int as active_products,
         count(*) filter(where status='ACTIVE' and visible_on_website)::int as visible_products
  from public.products where business_line='STYLE'
)
select
  case when g.required_gates=5
    and g.passed_gates=5
    and c.operations=14
    and c.execution_disabled=14
    and p.held=14
    and p.zero_attempt_budget=14
    and p.dev_only=14
    and k.contracts=14
    and k.valid_contracts=14
    and s.visible_products=0
  then 'PASS' else 'BLOCKED' end as readiness_status,
  g.required_gates,
  g.passed_gates,
  c.operations,
  c.execution_disabled,
  p.held,
  p.zero_attempt_budget,
  p.dev_only,
  k.contracts,
  k.valid_contracts,
  s.active_products as style_active_products,
  s.visible_products as style_visible_products,
  'HELD'::text as execution_release_status,
  jsonb_build_array(
    'ALL_PRE_EXECUTION_GATES_PASS',
    'EXECUTION_RELEASE_REMAINS_HELD',
    'ZERO_EXECUTION_ATTEMPT_BUDGET',
    'CONTRACTS_MATCH_BACKING_RPCS',
    'CONTROL_CENTER_PREVIEW_CONFIRM_AUDIT_FOUNDATION_PRESENT',
    'STYLE_REMAINS_HIDDEN',
    'NO_PRODUCTION_WRITES',
    'PHASE6_NOT_CLOSED_BY_THIS_GATE'
  ) as contract
from gates g cross join catalog c cross join policies p cross join contracts k cross join style s;

revoke all on lihen_private.phase6_4_pre_execution_readiness from public,anon,authenticated;
grant select on lihen_private.phase6_4_pre_execution_readiness to postgres;

create or replace function public.get_phase6_4_pre_execution_readiness_controlled()
returns setof lihen_private.phase6_4_pre_execution_readiness
language plpgsql
security definer
set search_path=''
as $$
declare v_actor uuid:=auth.uid();
begin
  if v_actor is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if;
  if not exists(
    select 1 from public.profiles p
    where p.id=v_actor and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN')
  ) then raise exception using errcode='42501',message='LIHEN_PHASE6_4_READ_FORBIDDEN'; end if;
  return query select * from lihen_private.phase6_4_pre_execution_readiness;
end;$$;

revoke all on function public.get_phase6_4_pre_execution_readiness_controlled() from public,anon;
grant execute on function public.get_phase6_4_pre_execution_readiness_controlled() to authenticated,postgres;

insert into lihen_private.phase_exit_gate_results(
  phase_code,status,gate_version,metrics,accepted_waivers,notes,evaluated_at
)
select
  '6.4',
  case when r.readiness_status='PASS' then 'PASS' else 'BLOCKED' end,
  'PHASE6_4_PRE_EXECUTION_READINESS_V1',
  jsonb_build_object(
    'required_gates',r.required_gates,
    'passed_gates',r.passed_gates,
    'operations',r.operations,
    'execution_disabled',r.execution_disabled,
    'held',r.held,
    'zero_attempt_budget',r.zero_attempt_budget,
    'dev_only',r.dev_only,
    'contracts',r.contracts,
    'valid_contracts',r.valid_contracts,
    'style_active_products',r.style_active_products,
    'style_visible_products',r.style_visible_products,
    'execution_release_status',r.execution_release_status,
    'contract',r.contract
  ),
  '[]'::jsonb,
  'FASE 6.4 pre-execution readiness gate. Technical prerequisites pass while execution release remains HELD. This gate does not close FASE 6 and does not enable business execution.',
  now()
from lihen_private.phase6_4_pre_execution_readiness r
on conflict (phase_code) do update set
  status=excluded.status,
  gate_version=excluded.gate_version,
  metrics=excluded.metrics,
  accepted_waivers=excluded.accepted_waivers,
  notes=excluded.notes,
  evaluated_at=excluded.evaluated_at;
