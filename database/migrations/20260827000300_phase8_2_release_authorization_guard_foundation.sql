create or replace view lihen_private.control_center_operation_release_authorization_guard as
select c.operation_code,c.domain_code,c.risk_level,p.canary_eligible,p.canary_enabled,p.max_canary_attempts_per_hour,d.dispatch_allowed,a.approval_state,rr.release_request_id,rr.request_status,rr.requested_environment,rr.expires_at,false::boolean as release_authorized,
case when c.risk_level in ('HIGH','CRITICAL') then 'BLOCKED_BY_RISK'
when not p.canary_eligible then 'BLOCKED_NOT_CANARY_ELIGIBLE'
when p.canary_enabled then 'BLOCKED_CANARY_ENABLED_UNEXPECTEDLY'
when p.max_canary_attempts_per_hour<>0 then 'BLOCKED_NONZERO_BUDGET'
when d.dispatch_allowed then 'BLOCKED_DISPATCH_ALREADY_ALLOWED'
when a.approval_state<>'APPROVED' then 'BLOCKED_APPROVAL_NOT_GRANTED'
when rr.release_request_id is null then 'BLOCKED_NO_RELEASE_REQUEST'
when rr.request_status<>'APPROVED' then 'BLOCKED_RELEASE_REQUEST_NOT_APPROVED'
when rr.requested_environment<>'DEV_ONLY' then 'BLOCKED_ENVIRONMENT'
when rr.expires_at<=now() then 'BLOCKED_RELEASE_REQUEST_EXPIRED'
else 'BLOCKED_FINAL_EXECUTION_RELEASE_NOT_IMPLEMENTED' end as guard_status
from lihen_private.control_center_operation_catalog c
join lihen_private.control_center_operation_canary_policy p using(operation_code)
join lihen_private.control_center_operation_dispatch_contract d using(operation_code)
join lihen_private.control_center_operation_canary_approval_policy a using(operation_code)
left join lateral (select r.release_request_id,r.request_status,r.requested_environment,r.expires_at from lihen_private.control_center_operation_release_requests r where r.operation_code=c.operation_code order by r.requested_at desc limit 1) rr on true;
revoke all on lihen_private.control_center_operation_release_authorization_guard from public,anon,authenticated;
grant select on lihen_private.control_center_operation_release_authorization_guard to postgres;

create or replace function public.get_control_center_operation_release_authorization_guard_controlled()
returns table(operation_code text,domain_code text,risk_level text,canary_eligible boolean,canary_enabled boolean,max_canary_attempts_per_hour integer,dispatch_allowed boolean,approval_state text,release_request_id uuid,request_status text,requested_environment text,expires_at timestamptz,release_authorized boolean,guard_status text)
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();
begin
 if v_actor is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if;
 if not exists(select 1 from public.profiles p where p.id=v_actor and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN')) then raise exception using errcode='42501',message='LIHEN_RELEASE_AUTHORIZATION_GUARD_READ_FORBIDDEN'; end if;
 return query select g.operation_code,g.domain_code,g.risk_level,g.canary_eligible,g.canary_enabled,g.max_canary_attempts_per_hour,g.dispatch_allowed,g.approval_state,g.release_request_id,g.request_status,g.requested_environment,g.expires_at,g.release_authorized,g.guard_status from lihen_private.control_center_operation_release_authorization_guard g order by g.domain_code,g.operation_code;
end; $$;
revoke all on function public.get_control_center_operation_release_authorization_guard_controlled() from public,anon;
grant execute on function public.get_control_center_operation_release_authorization_guard_controlled() to authenticated,postgres;

create or replace view lihen_private.phase8_2_release_authorization_guard_readiness as
with g as (select count(*)::int as operations,count(*) filter(where release_authorized=false)::int as blocked,count(*) filter(where guard_status='BLOCKED_APPROVAL_NOT_GRANTED')::int as blocked_no_approval,count(*) filter(where guard_status='BLOCKED_BY_RISK')::int as blocked_by_risk from lihen_private.control_center_operation_release_authorization_guard),
r as (select count(*)::int as requests,count(*) filter(where request_status='APPROVED')::int as approved_requests from lihen_private.control_center_operation_release_requests),
p81 as (select status from lihen_private.phase_exit_gate_results where phase_code='8.1'),
s as (select count(*) filter(where status='ACTIVE' and visible_on_website)::int as visible_products from public.products where business_line='STYLE')
select case when (select status from p81)='PASS' and g.operations=14 and g.blocked=14 and g.blocked_no_approval=4 and g.blocked_by_risk=10 and r.requests=0 and r.approved_requests=0 and s.visible_products=0 then 'PASS' else 'BLOCKED' end as readiness_status,g.operations,g.blocked,g.blocked_no_approval,g.blocked_by_risk,r.requests,r.approved_requests,s.visible_products as style_visible_products,jsonb_build_array('RELEASE_AUTHORIZATION_GUARD_DEFINED','ZERO_RELEASE_AUTHORIZED','FOUR_MEDIUM_BLOCKED_WITHOUT_APPROVAL','TEN_HIGH_CRITICAL_BLOCKED_BY_RISK','ZERO_RELEASE_REQUESTS','ZERO_APPROVED_REQUESTS','FINAL_EXECUTION_RELEASE_NOT_IMPLEMENTED','NO_PRODUCTION_WRITES') as contract
from g cross join r cross join s;
revoke all on lihen_private.phase8_2_release_authorization_guard_readiness from public,anon,authenticated;
grant select on lihen_private.phase8_2_release_authorization_guard_readiness to postgres;
insert into lihen_private.phase_exit_gate_results(phase_code,status,gate_version,metrics,accepted_waivers,notes,evaluated_at)
select '8.2',case when readiness_status='PASS' then 'PASS' else 'BLOCKED' end,'PHASE8_2_RELEASE_AUTHORIZATION_GUARD_FOUNDATION_V1',jsonb_build_object('operations',operations,'blocked',blocked,'blocked_no_approval',blocked_no_approval,'blocked_by_risk',blocked_by_risk,'requests',requests,'approved_requests',approved_requests,'style_visible_products',style_visible_products,'contract',contract),'[]'::jsonb,'FASE 8.2 proves zero release authorization. The final execution release path is intentionally not implemented.',now()
from lihen_private.phase8_2_release_authorization_guard_readiness
on conflict(phase_code) do update set status=excluded.status,gate_version=excluded.gate_version,metrics=excluded.metrics,accepted_waivers=excluded.accepted_waivers,notes=excluded.notes,evaluated_at=excluded.evaluated_at;
