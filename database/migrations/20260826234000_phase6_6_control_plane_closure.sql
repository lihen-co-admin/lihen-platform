create or replace view lihen_private.phase6_6_control_plane_closure_readiness as
with gates as (select count(*) filter(where phase_code in ('6.0','6.1','6.1A','6.1B','6.1C','6.2','6.3','6.4','6.5'))::int as required_gates,count(*) filter(where phase_code in ('6.0','6.1','6.1A','6.1B','6.1C','6.2','6.3','6.4','6.5') and status='PASS')::int as passed_gates from lihen_private.phase_exit_gate_results),
catalog as (select count(*)::int as operations,count(*) filter(where execution_enabled=false)::int as execution_disabled from lihen_private.control_center_operation_catalog),
policy as (select count(*) filter(where release_status='HELD')::int as release_held,count(*) filter(where allowed_environment='DEV_ONLY')::int as dev_only,count(*) filter(where max_execution_attempts_per_hour=0)::int as zero_attempt_budget from lihen_private.control_center_operation_execution_policy),
dispatch as (select count(*)::int as contracts,count(*) filter(where dispatch_allowed=false and dispatch_status='COMPILED_BUT_DISPATCH_HELD')::int as dispatch_held from lihen_private.control_center_operation_dispatch_contract),
style as (select count(*) filter(where status='ACTIVE')::int as active_products,count(*) filter(where status='ACTIVE' and visible_on_website)::int as visible_products from public.products where business_line='STYLE')
select case when g.required_gates=9 and g.passed_gates=9 and c.operations=14 and c.execution_disabled=14 and p.release_held=14 and p.dev_only=14 and p.zero_attempt_budget=14 and d.contracts=14 and d.dispatch_held=14 and s.visible_products=0 then 'PASS' else 'BLOCKED' end as readiness_status,g.required_gates,g.passed_gates,c.operations,c.execution_disabled,p.release_held,p.dev_only,p.zero_attempt_budget,d.contracts as dispatch_contracts,d.dispatch_held,s.active_products as style_active_products,s.visible_products as style_visible_products,'CONTROL_PLANE_COMPLETE_EXECUTION_DEFERRED'::text as closure_mode,jsonb_build_array('PHASE6_CONTROL_PLANE_COMPLETE','CONTROL_CENTER_PREVIEW_CONFIRM_AUDIT_READY','PAYLOAD_CONTRACT_VALIDATION_READY','DISPATCH_CONTRACTS_COMPILED','EXECUTION_RELEASE_EXPLICITLY_DEFERRED','ZERO_EXECUTION_ATTEMPT_BUDGET','STYLE_REMAINS_HIDDEN','NO_PRODUCTION_WRITES') as contract
from gates g cross join catalog c cross join policy p cross join dispatch d cross join style s;
revoke all on lihen_private.phase6_6_control_plane_closure_readiness from public,anon,authenticated;
grant select on lihen_private.phase6_6_control_plane_closure_readiness to postgres;

create or replace function public.get_phase6_6_control_plane_closure_readiness_controlled()
returns setof lihen_private.phase6_6_control_plane_closure_readiness language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();
begin
 if v_actor is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if;
 if not exists(select 1 from public.profiles p where p.id=v_actor and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN')) then raise exception using errcode='42501',message='LIHEN_PHASE6_6_READ_FORBIDDEN'; end if;
 return query select * from lihen_private.phase6_6_control_plane_closure_readiness;
end;$$;
revoke all on function public.get_phase6_6_control_plane_closure_readiness_controlled() from public,anon;
grant execute on function public.get_phase6_6_control_plane_closure_readiness_controlled() to authenticated,postgres;

insert into lihen_private.phase_exit_gate_results(phase_code,status,gate_version,metrics,accepted_waivers,notes,evaluated_at)
select '6.6',case when r.readiness_status='PASS' then 'PASS' else 'BLOCKED' end,'PHASE6_6_CONTROL_PLANE_CLOSURE_V1',
jsonb_build_object('required_gates',r.required_gates,'passed_gates',r.passed_gates,'operations',r.operations,'execution_disabled',r.execution_disabled,'release_held',r.release_held,'dev_only',r.dev_only,'zero_attempt_budget',r.zero_attempt_budget,'dispatch_contracts',r.dispatch_contracts,'dispatch_held',r.dispatch_held,'style_active_products',r.style_active_products,'style_visible_products',r.style_visible_products,'closure_mode',r.closure_mode,'contract',r.contract),
'[]'::jsonb,'FASE 6 control-plane closure. Technical control plane is complete; real business execution remains explicitly deferred to a future separately released phase. Production remains untouched.',now()
from lihen_private.phase6_6_control_plane_closure_readiness r
on conflict (phase_code) do update set status=excluded.status,gate_version=excluded.gate_version,metrics=excluded.metrics,accepted_waivers=excluded.accepted_waivers,notes=excluded.notes,evaluated_at=excluded.evaluated_at;
