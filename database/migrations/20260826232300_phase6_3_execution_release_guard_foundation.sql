create table if not exists lihen_private.control_center_operation_execution_policy (
  operation_code text primary key references lihen_private.control_center_operation_catalog(operation_code),
  release_status text not null default 'HELD' check (release_status in ('HELD','READY_FOR_ENABLEMENT','ENABLED')),
  allowed_environment text not null default 'DEV_ONLY' check (allowed_environment in ('DEV_ONLY','PRODUCTION_APPROVED')),
  requires_explicit_release boolean not null default true,
  max_execution_attempts_per_hour integer not null default 0 check (max_execution_attempts_per_hour >= 0),
  notes text not null default 'Execution remains held.',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

revoke all on lihen_private.control_center_operation_execution_policy from public,anon,authenticated;
grant select on lihen_private.control_center_operation_execution_policy to postgres;

insert into lihen_private.control_center_operation_execution_policy(
  operation_code,release_status,allowed_environment,requires_explicit_release,max_execution_attempts_per_hour,notes
)
select c.operation_code,'HELD','DEV_ONLY',true,0,'FASE 6.3 guard: no execution enablement in this cut.'
from lihen_private.control_center_operation_catalog c
on conflict (operation_code) do update set
  release_status='HELD',
  allowed_environment='DEV_ONLY',
  requires_explicit_release=true,
  max_execution_attempts_per_hour=0,
  notes='FASE 6.3 guard: no execution enablement in this cut.',
  updated_at=now();

create or replace view lihen_private.control_center_operation_execution_readiness as
select
  c.operation_code,
  c.domain_code,
  c.risk_level,
  c.execution_enabled as catalog_execution_enabled,
  p.release_status,
  p.allowed_environment,
  p.requires_explicit_release,
  p.max_execution_attempts_per_hour,
  r.function_oid is not null as backing_function_present,
  r.operation_key_first,
  r.payload_arguments,
  case
    when c.execution_enabled then 'BLOCKED_CATALOG_ENABLED_UNEXPECTEDLY'
    when p.release_status <> 'HELD' then 'BLOCKED_RELEASE_NOT_HELD'
    when p.allowed_environment <> 'DEV_ONLY' then 'BLOCKED_ENVIRONMENT_POLICY'
    when p.max_execution_attempts_per_hour <> 0 then 'BLOCKED_ATTEMPT_LIMIT_NONZERO'
    when r.function_oid is null then 'BLOCKED_BACKING_RPC_MISSING'
    when not r.operation_key_first then 'BLOCKED_OPERATION_KEY_CONTRACT'
    else 'READY_BUT_HELD'
  end as readiness_status
from lihen_private.control_center_operation_catalog c
join lihen_private.control_center_operation_execution_policy p using(operation_code)
join lihen_private.control_center_operation_contract_registry r using(operation_code);

revoke all on lihen_private.control_center_operation_execution_readiness from public,anon,authenticated;
grant select on lihen_private.control_center_operation_execution_readiness to postgres;

create or replace function public.get_control_center_operation_execution_readiness_controlled()
returns table(
  operation_code text,
  domain_code text,
  risk_level text,
  catalog_execution_enabled boolean,
  release_status text,
  allowed_environment text,
  requires_explicit_release boolean,
  max_execution_attempts_per_hour integer,
  readiness_status text
)
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
  ) then raise exception using errcode='42501',message='LIHEN_OPERATION_EXECUTION_READINESS_FORBIDDEN'; end if;
  return query
  select r.operation_code,r.domain_code,r.risk_level,r.catalog_execution_enabled,
         r.release_status,r.allowed_environment,r.requires_explicit_release,
         r.max_execution_attempts_per_hour,r.readiness_status
  from lihen_private.control_center_operation_execution_readiness r
  order by r.domain_code,r.operation_code;
end;$$;

revoke all on function public.get_control_center_operation_execution_readiness_controlled() from public,anon;
grant execute on function public.get_control_center_operation_execution_readiness_controlled() to authenticated,postgres;

create or replace view lihen_private.phase6_3_execution_release_guard_readiness as
with x as (
  select count(*)::int as operations,
         count(*) filter(where readiness_status='READY_BUT_HELD')::int as ready_but_held,
         count(*) filter(where release_status='HELD')::int as held,
         count(*) filter(where catalog_execution_enabled=false)::int as catalog_disabled,
         count(*) filter(where max_execution_attempts_per_hour=0)::int as zero_attempt_budget
  from lihen_private.control_center_operation_execution_readiness
), style as (
  select count(*) filter(where status='ACTIVE')::int as active_products,
         count(*) filter(where status='ACTIVE' and visible_on_website)::int as visible_products
  from public.products where business_line='STYLE'
), p62 as (
  select status from lihen_private.phase_exit_gate_results where phase_code='6.2'
)
select
  case when (select status from p62)='PASS'
    and x.operations=14
    and x.ready_but_held=14
    and x.held=14
    and x.catalog_disabled=14
    and x.zero_attempt_budget=14
    and s.visible_products=0
  then 'PASS' else 'BLOCKED' end as readiness_status,
  x.operations,
  x.ready_but_held,
  x.held,
  x.catalog_disabled,
  x.zero_attempt_budget,
  s.active_products as style_active_products,
  s.visible_products as style_visible_products,
  jsonb_build_array(
    'EXECUTION_RELEASE_EXPLICITLY_HELD',
    'ZERO_EXECUTION_ATTEMPT_BUDGET',
    'DEV_ONLY_RELEASE_POLICY',
    'OWNER_ADMIN_READINESS_ONLY',
    'NO_EXECUTE_RPC_INTRODUCED',
    'CATALOG_EXECUTION_REMAINS_DISABLED',
    'STYLE_REMAINS_HIDDEN',
    'NO_PRODUCTION_WRITES'
  ) as contract
from x cross join style s;

revoke all on lihen_private.phase6_3_execution_release_guard_readiness from public,anon,authenticated;
grant select on lihen_private.phase6_3_execution_release_guard_readiness to postgres;

insert into lihen_private.phase_exit_gate_results(
  phase_code,status,gate_version,metrics,accepted_waivers,notes,evaluated_at
)
select
  '6.3',
  case when r.readiness_status='PASS' then 'PASS' else 'BLOCKED' end,
  'PHASE6_3_EXECUTION_RELEASE_GUARD_FOUNDATION_V1',
  jsonb_build_object(
    'operations',r.operations,
    'ready_but_held',r.ready_but_held,
    'held',r.held,
    'catalog_disabled',r.catalog_disabled,
    'zero_attempt_budget',r.zero_attempt_budget,
    'style_active_products',r.style_active_products,
    'style_visible_products',r.style_visible_products,
    'contract',r.contract
  ),
  '[]'::jsonb,
  'FASE 6.3 guard foundation. All operations are structurally ready but explicitly HELD with zero execution attempt budget. No execute RPC exists in this cut.',
  now()
from lihen_private.phase6_3_execution_release_guard_readiness r
on conflict (phase_code) do update set
  status=excluded.status,
  gate_version=excluded.gate_version,
  metrics=excluded.metrics,
  accepted_waivers=excluded.accepted_waivers,
  notes=excluded.notes,
  evaluated_at=excluded.evaluated_at;
