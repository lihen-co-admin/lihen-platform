create or replace view lihen_private.control_center_operation_canary_execution_guard as
select c.operation_code,c.domain_code,c.risk_level,p.canary_eligible,p.canary_enabled,p.max_canary_attempts_per_hour,a.approval_required,a.approval_state,a.release_scope,d.dispatch_allowed,d.dispatch_status,false::boolean as execution_allowed,
case when c.risk_level in ('HIGH','CRITICAL') then 'BLOCKED_BY_RISK' when not p.canary_eligible then 'BLOCKED_NOT_ELIGIBLE' when p.canary_enabled then 'BLOCKED_CANARY_ENABLED_UNEXPECTEDLY' when p.max_canary_attempts_per_hour<>0 then 'BLOCKED_NONZERO_BUDGET' when a.approval_state<>'APPROVED' then 'BLOCKED_NO_APPROVAL' when d.dispatch_allowed then 'BLOCKED_DISPATCH_ALREADY_ALLOWED' else 'BLOCKED_RELEASE_NOT_ENABLED' end as guard_status
from lihen_private.control_center_operation_catalog c
join lihen_private.control_center_operation_canary_policy p using(operation_code)
join lihen_private.control_center_operation_canary_approval_policy a using(operation_code)
join lihen_private.control_center_operation_dispatch_contract d using(operation_code);
revoke all on lihen_private.control_center_operation_canary_execution_guard from public,anon,authenticated;
grant select on lihen_private.control_center_operation_canary_execution_guard to postgres;

create or replace function public.get_control_center_operation_canary_execution_guard_controlled()
returns table(operation_code text,domain_code text,risk_level text,canary_eligible boolean,canary_enabled boolean,max_canary_attempts_per_hour integer,approval_required boolean,approval_state text,release_scope text,dispatch_allowed boolean,dispatch_status text,execution_allowed boolean,guard_status text)
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();
begin
 if v_actor is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if;
 if not exists(select 1 from public.profiles p where p.id=v_actor and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN')) then raise exception using errcode='42501',message='LIHEN_CANARY_EXECUTION_GUARD_READ_FORBIDDEN'; end if;
 return query select g.operation_code,g.domain_code,g.risk_level,g.canary_eligible,g.canary_enabled,g.max_canary_attempts_per_hour,g.approval_required,g.approval_state,g.release_scope,g.dispatch_allowed,g.dispatch_status,g.execution_allowed,g.guard_status from lihen_private.control_center_operation_canary_execution_guard g order by g.domain_code,g.operation_code;
end; $$;
revoke all on function public.get_control_center_operation_canary_execution_guard_controlled() from public,anon;
grant execute on function public.get_control_center_operation_canary_execution_guard_controlled() to authenticated,postgres;

create or replace view lihen_private.phase7_4_canary_execution_guard_readiness as
with g as (select count(*)::int as operations,count(*) filter(where execution_allowed=false)::int as blocked,count(*) filter(where guard_status='BLOCKED_NO_APPROVAL')::int as blocked_no_approval,count(*) filter(where guard_status='BLOCKED_BY_RISK')::int as blocked_by_risk from lihen_private.control_center_operation_canary_execution_guard),
s as (select count(*) filter(where status='ACTIVE' and visible_on_website)::int as visible_products from public.products where business_line='STYLE'),
p73 as (select status from lihen_private.phase_exit_gate_results where phase_code='7.3')
select case when (select status from p73)='PASS' and g.operations=14 and g.blocked=14 and g.blocked_no_approval=4 and g.blocked_by_risk=10 and s.visible_products=0 then 'PASS' else 'BLOCKED' end as readiness_status,g.operations,g.blocked,g.blocked_no_approval,g.blocked_by_risk,s.visible_products as style_visible_products,jsonb_build_array('EXECUTION_GUARD_DEFINED_FOR_ALL_OPERATIONS','FOUR_CANARY_CANDIDATES_BLOCKED_WITHOUT_APPROVAL','TEN_HIGH_CRITICAL_BLOCKED_BY_RISK','ZERO_EXECUTION_ALLOWED','OWNER_ADMIN_READ_ONLY','STYLE_REMAINS_HIDDEN','NO_PRODUCTION_WRITES') as contract
from g cross join s;
revoke all on lihen_private.phase7_4_canary_execution_guard_readiness from public,anon,authenticated;
grant select on lihen_private.phase7_4_canary_execution_guard_readiness to postgres;
insert into lihen_private.phase_exit_gate_results(phase_code,status,gate_version,metrics,accepted_waivers,notes,evaluated_at)
select '7.4',case when readiness_status='PASS' then 'PASS' else 'BLOCKED' end,'PHASE7_4_CANARY_EXECUTION_GUARD_FOUNDATION_V1',jsonb_build_object('operations',operations,'blocked',blocked,'blocked_no_approval',blocked_no_approval,'blocked_by_risk',blocked_by_risk,'style_visible_products',style_visible_products,'contract',contract),'[]'::jsonb,'FASE 7.4 proves all 14 operations remain execution-blocked. Four MEDIUM candidates require approval; ten HIGH/CRITICAL are blocked by risk.',now()
from lihen_private.phase7_4_canary_execution_guard_readiness
on conflict(phase_code) do update set status=excluded.status,gate_version=excluded.gate_version,metrics=excluded.metrics,accepted_waivers=excluded.accepted_waivers,notes=excluded.notes,evaluated_at=excluded.evaluated_at;
