create or replace view lihen_private.control_center_operation_dispatch_contract as
select c.operation_code,c.domain_code,c.risk_level,c.function_name,r.identity_arguments,r.result_signature,r.payload_arguments,p.release_status,p.allowed_environment,p.max_execution_attempts_per_hour,false::boolean as dispatch_allowed,
case when c.execution_enabled then 'BLOCKED_CATALOG_ENABLED_UNEXPECTEDLY' when p.release_status <> 'HELD' then 'BLOCKED_RELEASE_NOT_HELD' when p.allowed_environment <> 'DEV_ONLY' then 'BLOCKED_ENVIRONMENT_POLICY' when p.max_execution_attempts_per_hour <> 0 then 'BLOCKED_ATTEMPT_BUDGET_NONZERO' when r.function_oid is null then 'BLOCKED_BACKING_RPC_MISSING' when not r.operation_key_first then 'BLOCKED_OPERATION_KEY_CONTRACT' else 'COMPILED_BUT_DISPATCH_HELD' end as dispatch_status
from lihen_private.control_center_operation_catalog c
join lihen_private.control_center_operation_contract_registry r using(operation_code)
join lihen_private.control_center_operation_execution_policy p using(operation_code);

revoke all on lihen_private.control_center_operation_dispatch_contract from public,anon,authenticated;
grant select on lihen_private.control_center_operation_dispatch_contract to postgres;

create or replace function public.get_control_center_operation_dispatch_contracts_controlled()
returns table(operation_code text,domain_code text,risk_level text,function_name text,identity_arguments text,result_signature text,payload_arguments jsonb,release_status text,allowed_environment text,max_execution_attempts_per_hour integer,dispatch_allowed boolean,dispatch_status text)
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();
begin
  if v_actor is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_actor and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN')) then raise exception using errcode='42501',message='LIHEN_OPERATION_DISPATCH_CONTRACT_READ_FORBIDDEN'; end if;
  return query select d.operation_code,d.domain_code,d.risk_level,d.function_name,d.identity_arguments,d.result_signature,d.payload_arguments,d.release_status,d.allowed_environment,d.max_execution_attempts_per_hour,d.dispatch_allowed,d.dispatch_status from lihen_private.control_center_operation_dispatch_contract d order by d.domain_code,d.operation_code;
end;$$;
revoke all on function public.get_control_center_operation_dispatch_contracts_controlled() from public,anon;
grant execute on function public.get_control_center_operation_dispatch_contracts_controlled() to authenticated,postgres;

create or replace view lihen_private.phase6_5_dispatch_contract_readiness as
with d as (select count(*)::int as contracts,count(*) filter(where dispatch_allowed=false)::int as dispatch_held,count(*) filter(where dispatch_status='COMPILED_BUT_DISPATCH_HELD')::int as compiled_but_held,count(*) filter(where release_status='HELD')::int as release_held,count(*) filter(where max_execution_attempts_per_hour=0)::int as zero_attempt_budget from lihen_private.control_center_operation_dispatch_contract),
style as (select count(*) filter(where status='ACTIVE')::int as active_products,count(*) filter(where status='ACTIVE' and visible_on_website)::int as visible_products from public.products where business_line='STYLE'),
p64 as (select status from lihen_private.phase_exit_gate_results where phase_code='6.4')
select case when (select status from p64)='PASS' and d.contracts=14 and d.dispatch_held=14 and d.compiled_but_held=14 and d.release_held=14 and d.zero_attempt_budget=14 and s.visible_products=0 then 'PASS' else 'BLOCKED' end as readiness_status,d.contracts,d.dispatch_held,d.compiled_but_held,d.release_held,d.zero_attempt_budget,s.active_products as style_active_products,s.visible_products as style_visible_products,jsonb_build_array('DISPATCH_CONTRACTS_COMPILED','DISPATCH_ALLOWED_FALSE_FOR_ALL_OPERATIONS','RELEASE_REMAINS_HELD','ZERO_EXECUTION_ATTEMPT_BUDGET','OWNER_ADMIN_READ_ONLY','NO_EXECUTE_RPC_INTRODUCED','STYLE_REMAINS_HIDDEN','NO_PRODUCTION_WRITES') as contract
from d cross join style s;
revoke all on lihen_private.phase6_5_dispatch_contract_readiness from public,anon,authenticated;
grant select on lihen_private.phase6_5_dispatch_contract_readiness to postgres;

insert into lihen_private.phase_exit_gate_results(phase_code,status,gate_version,metrics,accepted_waivers,notes,evaluated_at)
select '6.5',case when r.readiness_status='PASS' then 'PASS' else 'BLOCKED' end,'PHASE6_5_DISPATCH_CONTRACT_FOUNDATION_V1',
jsonb_build_object('contracts',r.contracts,'dispatch_held',r.dispatch_held,'compiled_but_held',r.compiled_but_held,'release_held',r.release_held,'zero_attempt_budget',r.zero_attempt_budget,'style_active_products',r.style_active_products,'style_visible_products',r.style_visible_products,'contract',r.contract),
'[]'::jsonb,'FASE 6.5 compiles read-only dispatch contracts from backing RPC metadata. Dispatch remains forbidden for all operations; no business execution is introduced.',now()
from lihen_private.phase6_5_dispatch_contract_readiness r
on conflict (phase_code) do update set status=excluded.status,gate_version=excluded.gate_version,metrics=excluded.metrics,accepted_waivers=excluded.accepted_waivers,notes=excluded.notes,evaluated_at=excluded.evaluated_at;
