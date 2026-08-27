create or replace view lihen_private.phase7_5_canary_control_plane_closure_readiness as
with gates as (select count(*) filter(where phase_code in ('7.0','7.1','7.2','7.3','7.4'))::int as required_gates,count(*) filter(where phase_code in ('7.0','7.1','7.2','7.3','7.4') and status='PASS')::int as passed_gates from lihen_private.phase_exit_gate_results),
g as (select count(*)::int as operations,count(*) filter(where execution_allowed=false)::int as blocked from lihen_private.control_center_operation_canary_execution_guard),
p as (select count(*) filter(where canary_enabled=false)::int as canary_disabled,count(*) filter(where max_canary_attempts_per_hour=0)::int as zero_budget from lihen_private.control_center_operation_canary_policy),
s as (select count(*) filter(where status='ACTIVE' and visible_on_website)::int as visible_products from public.products where business_line='STYLE')
select case when gates.required_gates=5 and gates.passed_gates=5 and g.operations=14 and g.blocked=14 and p.canary_disabled=14 and p.zero_budget=14 and s.visible_products=0 then 'PASS' else 'BLOCKED' end as readiness_status,gates.required_gates,gates.passed_gates,g.operations,g.blocked,p.canary_disabled,p.zero_budget,s.visible_products as style_visible_products,'CANARY_CONTROL_PLANE_COMPLETE_EXECUTION_DEFERRED'::text as closure_mode,jsonb_build_array('PHASE7_CANARY_CONTROL_PLANE_COMPLETE','SIMULATION_READY','APPROVAL_POLICY_READY','EXECUTION_GUARD_READY','ALL_EXECUTION_BLOCKED','CANARY_DISABLED_FOR_ALL','ZERO_CANARY_BUDGET','NO_PRODUCTION_WRITES') as contract
from gates cross join g cross join p cross join s;
revoke all on lihen_private.phase7_5_canary_control_plane_closure_readiness from public,anon,authenticated;
grant select on lihen_private.phase7_5_canary_control_plane_closure_readiness to postgres;

create or replace function public.get_phase7_5_canary_control_plane_closure_readiness_controlled()
returns setof lihen_private.phase7_5_canary_control_plane_closure_readiness language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();
begin
 if v_actor is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if;
 if not exists(select 1 from public.profiles p where p.id=v_actor and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN')) then raise exception using errcode='42501',message='LIHEN_PHASE7_5_READ_FORBIDDEN'; end if;
 return query select * from lihen_private.phase7_5_canary_control_plane_closure_readiness;
end; $$;
revoke all on function public.get_phase7_5_canary_control_plane_closure_readiness_controlled() from public,anon;
grant execute on function public.get_phase7_5_canary_control_plane_closure_readiness_controlled() to authenticated,postgres;

insert into lihen_private.phase_exit_gate_results(phase_code,status,gate_version,metrics,accepted_waivers,notes,evaluated_at)
select '7.5',case when readiness_status='PASS' then 'PASS' else 'BLOCKED' end,'PHASE7_5_CANARY_CONTROL_PLANE_CLOSURE_V1',jsonb_build_object('required_gates',required_gates,'passed_gates',passed_gates,'operations',operations,'blocked',blocked,'canary_disabled',canary_disabled,'zero_budget',zero_budget,'style_visible_products',style_visible_products,'closure_mode',closure_mode,'contract',contract),'[]'::jsonb,'FASE 7 canary control-plane closure. Simulation, approval policy and guards are complete while all real execution remains deferred.',now()
from lihen_private.phase7_5_canary_control_plane_closure_readiness
on conflict(phase_code) do update set status=excluded.status,gate_version=excluded.gate_version,metrics=excluded.metrics,accepted_waivers=excluded.accepted_waivers,notes=excluded.notes,evaluated_at=excluded.evaluated_at;
