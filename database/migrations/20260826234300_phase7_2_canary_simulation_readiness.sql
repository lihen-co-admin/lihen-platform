create or replace view lihen_private.control_center_operation_canary_simulation as
select c.operation_code,c.domain_code,c.risk_level,c.function_name,p.canary_eligible,p.canary_enabled,p.max_canary_attempts_per_hour,p.requires_manual_release,p.allowed_environment,d.dispatch_allowed,d.dispatch_status,
case when not p.canary_eligible then 'NOT_ELIGIBLE_BY_RISK' when p.canary_enabled then 'BLOCKED_CANARY_ENABLED_UNEXPECTEDLY' when p.max_canary_attempts_per_hour <> 0 then 'BLOCKED_CANARY_BUDGET_NONZERO' when p.allowed_environment <> 'DEV_ONLY' then 'BLOCKED_ENVIRONMENT_POLICY' when d.dispatch_allowed then 'BLOCKED_DISPATCH_ALLOWED_UNEXPECTEDLY' when d.dispatch_status <> 'COMPILED_BUT_DISPATCH_HELD' then 'BLOCKED_DISPATCH_CONTRACT' else 'SIMULATION_READY_BUT_DISABLED' end as simulation_status
from lihen_private.control_center_operation_catalog c
join lihen_private.control_center_operation_canary_policy p using(operation_code)
join lihen_private.control_center_operation_dispatch_contract d using(operation_code);
revoke all on lihen_private.control_center_operation_canary_simulation from public,anon,authenticated;
grant select on lihen_private.control_center_operation_canary_simulation to postgres;

create or replace function public.get_control_center_operation_canary_simulation_controlled()
returns table(operation_code text,domain_code text,risk_level text,function_name text,canary_eligible boolean,canary_enabled boolean,max_canary_attempts_per_hour integer,requires_manual_release boolean,allowed_environment text,dispatch_allowed boolean,dispatch_status text,simulation_status text)
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();
begin
 if v_actor is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if;
 if not exists(select 1 from public.profiles p where p.id=v_actor and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN')) then raise exception using errcode='42501',message='LIHEN_CANARY_SIMULATION_READ_FORBIDDEN'; end if;
 return query select s.operation_code,s.domain_code,s.risk_level,s.function_name,s.canary_eligible,s.canary_enabled,s.max_canary_attempts_per_hour,s.requires_manual_release,s.allowed_environment,s.dispatch_allowed,s.dispatch_status,s.simulation_status from lihen_private.control_center_operation_canary_simulation s order by s.canary_eligible desc,s.domain_code,s.operation_code;
end;$$;
revoke all on function public.get_control_center_operation_canary_simulation_controlled() from public,anon;
grant execute on function public.get_control_center_operation_canary_simulation_controlled() to authenticated,postgres;

create or replace view lihen_private.phase7_2_canary_simulation_readiness as
with s as (select count(*)::int as operations,count(*) filter(where canary_eligible)::int as eligible,count(*) filter(where simulation_status='SIMULATION_READY_BUT_DISABLED')::int as simulation_ready_disabled,count(*) filter(where simulation_status='NOT_ELIGIBLE_BY_RISK')::int as excluded_by_risk,count(*) filter(where canary_enabled=false)::int as canary_disabled,count(*) filter(where dispatch_allowed=false)::int as dispatch_disabled from lihen_private.control_center_operation_canary_simulation),
style as (select count(*) filter(where status='ACTIVE')::int as active_products,count(*) filter(where status='ACTIVE' and visible_on_website)::int as visible_products from public.products where business_line='STYLE'),
p71 as (select status from lihen_private.phase_exit_gate_results where phase_code='7.1')
select case when (select status from p71)='PASS' and s.operations=14 and s.eligible=4 and s.simulation_ready_disabled=4 and s.excluded_by_risk=10 and s.canary_disabled=14 and s.dispatch_disabled=14 and st.visible_products=0 then 'PASS' else 'BLOCKED' end as readiness_status,s.operations,s.eligible,s.simulation_ready_disabled,s.excluded_by_risk,s.canary_disabled,s.dispatch_disabled,st.active_products as style_active_products,st.visible_products as style_visible_products,jsonb_build_array('CANARY_SIMULATION_READ_ONLY','FOUR_MEDIUM_RISK_OPERATIONS_SIMULATION_READY','TEN_HIGH_CRITICAL_OPERATIONS_EXCLUDED','CANARY_EXECUTION_DISABLED_FOR_ALL','DISPATCH_DISABLED_FOR_ALL','ZERO_BUSINESS_EXECUTION','STYLE_REMAINS_HIDDEN','NO_PRODUCTION_WRITES') as contract
from s cross join style st;
revoke all on lihen_private.phase7_2_canary_simulation_readiness from public,anon,authenticated;
grant select on lihen_private.phase7_2_canary_simulation_readiness to postgres;

insert into lihen_private.phase_exit_gate_results(phase_code,status,gate_version,metrics,accepted_waivers,notes,evaluated_at)
select '7.2',case when r.readiness_status='PASS' then 'PASS' else 'BLOCKED' end,'PHASE7_2_CANARY_SIMULATION_READINESS_V1',
jsonb_build_object('operations',r.operations,'eligible',r.eligible,'simulation_ready_disabled',r.simulation_ready_disabled,'excluded_by_risk',r.excluded_by_risk,'canary_disabled',r.canary_disabled,'dispatch_disabled',r.dispatch_disabled,'style_active_products',r.style_active_products,'style_visible_products',r.style_visible_products,'contract',r.contract),
'[]'::jsonb,'FASE 7.2 simulation readiness. Four MEDIUM-risk operations are simulation-ready, but canary execution and dispatch remain disabled for all operations. No business execution occurred.',now()
from lihen_private.phase7_2_canary_simulation_readiness r
on conflict (phase_code) do update set status=excluded.status,gate_version=excluded.gate_version,metrics=excluded.metrics,accepted_waivers=excluded.accepted_waivers,notes=excluded.notes,evaluated_at=excluded.evaluated_at;
