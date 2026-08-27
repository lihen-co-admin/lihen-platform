create or replace view lihen_private.phase8_4_release_control_plane_closure_readiness as
with gates as (select count(*) filter(where phase_code in ('8.0','8.1','8.2','8.3'))::int as required_gates,count(*) filter(where phase_code in ('8.0','8.1','8.2','8.3') and status='PASS')::int as passed_gates from lihen_private.phase_exit_gate_results),
g as (select count(*)::int as operations,count(*) filter(where release_authorized=false)::int as blocked from lihen_private.control_center_operation_release_authorization_guard),
r as (select count(*)::int as requests,count(*) filter(where request_status='APPROVED')::int as approved_requests from lihen_private.control_center_operation_release_requests),
s as (select count(*) filter(where status='ACTIVE' and visible_on_website)::int as visible_products from public.products where business_line='STYLE')
select case when gates.required_gates=4 and gates.passed_gates=4 and g.operations=14 and g.blocked=14 and r.requests=0 and r.approved_requests=0 and s.visible_products=0 then 'PASS' else 'BLOCKED' end as readiness_status,gates.required_gates,gates.passed_gates,g.operations,g.blocked,r.requests,r.approved_requests,s.visible_products as style_visible_products,'RELEASE_CONTROL_PLANE_COMPLETE_FINAL_EXECUTION_NOT_IMPLEMENTED'::text as closure_mode,jsonb_build_array('PHASE8_RELEASE_CONTROL_PLANE_COMPLETE','RELEASE_LEDGER_READY','RELEASE_GUARD_READY','REQUEST_DECISION_RPC_READY','SEPARATION_OF_DUTIES_READY','ZERO_RELEASE_REQUESTS','ZERO_RELEASE_AUTHORIZED','FINAL_EXECUTION_RELEASE_NOT_IMPLEMENTED','NO_PRODUCTION_WRITES') as contract
from gates cross join g cross join r cross join s;
revoke all on lihen_private.phase8_4_release_control_plane_closure_readiness from public,anon,authenticated;
grant select on lihen_private.phase8_4_release_control_plane_closure_readiness to postgres;

create or replace function public.get_phase8_4_release_control_plane_closure_readiness_controlled()
returns setof lihen_private.phase8_4_release_control_plane_closure_readiness language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();
begin
 if v_actor is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if;
 if not exists(select 1 from public.profiles p where p.id=v_actor and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN')) then raise exception using errcode='42501',message='LIHEN_PHASE8_4_READ_FORBIDDEN'; end if;
 return query select * from lihen_private.phase8_4_release_control_plane_closure_readiness;
end; $$;
revoke all on function public.get_phase8_4_release_control_plane_closure_readiness_controlled() from public,anon;
grant execute on function public.get_phase8_4_release_control_plane_closure_readiness_controlled() to authenticated,postgres;

insert into lihen_private.phase_exit_gate_results(phase_code,status,gate_version,metrics,accepted_waivers,notes,evaluated_at)
select '8.4',case when readiness_status='PASS' then 'PASS' else 'BLOCKED' end,'PHASE8_4_RELEASE_CONTROL_PLANE_CLOSURE_V1',jsonb_build_object('required_gates',required_gates,'passed_gates',passed_gates,'operations',operations,'blocked',blocked,'requests',requests,'approved_requests',approved_requests,'style_visible_products',style_visible_products,'closure_mode',closure_mode,'contract',contract),'[]'::jsonb,'FASE 8 release control-plane closure. Manual release governance is ready while final business execution remains intentionally unimplemented.',now()
from lihen_private.phase8_4_release_control_plane_closure_readiness
on conflict(phase_code) do update set status=excluded.status,gate_version=excluded.gate_version,metrics=excluded.metrics,accepted_waivers=excluded.accepted_waivers,notes=excluded.notes,evaluated_at=excluded.evaluated_at;
