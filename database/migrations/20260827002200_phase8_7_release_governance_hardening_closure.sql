create or replace view lihen_private.phase8_7_release_governance_hardening_closure_readiness as
with gates as (select count(*) filter(where phase_code in ('8.0','8.1','8.2','8.3','8.4','8.5','8.6'))::int as required_gates,count(*) filter(where phase_code in ('8.0','8.1','8.2','8.3','8.4','8.5','8.6') and status='PASS')::int as passed_gates from lihen_private.phase_exit_gate_results),
catalog as (select count(*)::int as operations,count(*) filter(where execution_enabled=false)::int as execution_disabled from lihen_private.control_center_operation_catalog),
canary as (select count(*) filter(where canary_enabled=false)::int as canary_disabled,count(*) filter(where max_canary_attempts_per_hour=0)::int as zero_canary_budget from lihen_private.control_center_operation_canary_policy),
release_guard as (select count(*) filter(where release_authorized=false)::int as release_blocked from lihen_private.control_center_operation_release_authorization_guard),
requests as (select count(*)::int as release_requests,count(*) filter(where request_status='APPROVED')::int as approved_requests,count(*) filter(where request_status='PENDING')::int as pending_requests from lihen_private.control_center_operation_release_requests),
intents as (select count(*) filter(where status='PREVIEWED' and expires_at<=now())::int as stale_previewed from lihen_private.control_center_operation_intents),
style as (select count(*) filter(where status='ACTIVE' and visible_on_website)::int as visible_products from public.products where business_line='STYLE')
select case when g.required_gates=7 and g.passed_gates=7 and c.operations=14 and c.execution_disabled=14 and ca.canary_disabled=14 and ca.zero_canary_budget=14 and rg.release_blocked=14 and r.approved_requests=0 and r.pending_requests=0 and i.stale_previewed=0 and s.visible_products=0 then 'PASS' else 'BLOCKED' end as readiness_status,g.required_gates,g.passed_gates,c.operations,c.execution_disabled,ca.canary_disabled,ca.zero_canary_budget,rg.release_blocked,r.release_requests,r.pending_requests,r.approved_requests,i.stale_previewed,s.visible_products as style_visible_products,'RELEASE_GOVERNANCE_HARDENED_FINAL_EXECUTION_STILL_NOT_IMPLEMENTED'::text as closure_mode,jsonb_build_array('PHASE8_RELEASE_GOVERNANCE_HARDENED','ACTOR_BOUND_OPERATION_KEYS','EXPIRY_STATE_PERSISTS','GOVERNANCE_AUDIT_READY','ZERO_APPROVED_RELEASES','ZERO_PENDING_RELEASES','ZERO_STALE_PREVIEWS','FINAL_EXECUTION_NOT_IMPLEMENTED','STYLE_REMAINS_HIDDEN','NO_PRODUCTION_WRITES') as contract
from gates g cross join catalog c cross join canary ca cross join release_guard rg cross join requests r cross join intents i cross join style s;
revoke all on lihen_private.phase8_7_release_governance_hardening_closure_readiness from public,anon,authenticated;
grant select on lihen_private.phase8_7_release_governance_hardening_closure_readiness to postgres;

create or replace function public.get_phase8_7_release_governance_hardening_closure_readiness_controlled()
returns setof lihen_private.phase8_7_release_governance_hardening_closure_readiness language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();
begin
 if v_actor is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if;
 if not exists(select 1 from public.profiles p where p.id=v_actor and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN')) then raise exception using errcode='42501',message='LIHEN_PHASE8_7_READ_FORBIDDEN'; end if;
 return query select * from lihen_private.phase8_7_release_governance_hardening_closure_readiness;
end; $$;
revoke all on function public.get_phase8_7_release_governance_hardening_closure_readiness_controlled() from public,anon;
grant execute on function public.get_phase8_7_release_governance_hardening_closure_readiness_controlled() to authenticated,postgres;

insert into lihen_private.phase_exit_gate_results(phase_code,status,gate_version,metrics,accepted_waivers,notes,evaluated_at)
select '8.7',case when readiness_status='PASS' then 'PASS' else 'BLOCKED' end,'PHASE8_7_RELEASE_GOVERNANCE_HARDENING_CLOSURE_V1',jsonb_build_object('required_gates',required_gates,'passed_gates',passed_gates,'operations',operations,'execution_disabled',execution_disabled,'canary_disabled',canary_disabled,'zero_canary_budget',zero_canary_budget,'release_blocked',release_blocked,'release_requests',release_requests,'pending_requests',pending_requests,'approved_requests',approved_requests,'stale_previewed',stale_previewed,'style_visible_products',style_visible_products,'closure_mode',closure_mode,'contract',contract),'[]'::jsonb,'FASE 8.7 closes release governance hardening after actor-bound idempotency, persistent expiry state and governance auditability. Final execution remains intentionally unimplemented.',now()
from lihen_private.phase8_7_release_governance_hardening_closure_readiness
on conflict(phase_code) do update set status=excluded.status,gate_version=excluded.gate_version,metrics=excluded.metrics,accepted_waivers=excluded.accepted_waivers,notes=excluded.notes,evaluated_at=excluded.evaluated_at;
