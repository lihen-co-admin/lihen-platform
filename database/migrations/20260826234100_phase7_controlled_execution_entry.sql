create or replace view lihen_private.phase7_controlled_execution_entry_readiness as
with p66 as (select status,metrics from lihen_private.phase_exit_gate_results where phase_code='6.6'),
catalog as (select count(*)::int as operations,count(*) filter(where execution_enabled=false)::int as execution_disabled,count(*) filter(where risk_level='MEDIUM')::int as medium_risk,count(*) filter(where risk_level in ('HIGH','CRITICAL'))::int as high_critical from lihen_private.control_center_operation_catalog),
policy as (select count(*) filter(where release_status='HELD')::int as held,count(*) filter(where max_execution_attempts_per_hour=0)::int as zero_attempt_budget,count(*) filter(where allowed_environment='DEV_ONLY')::int as dev_only from lihen_private.control_center_operation_execution_policy),
style as (select count(*) filter(where status='ACTIVE')::int as active_products,count(*) filter(where status='ACTIVE' and visible_on_website)::int as visible_products from public.products where business_line='STYLE')
select case when (select status from p66)='PASS' and c.operations=14 and c.execution_disabled=14 and p.held=14 and p.zero_attempt_budget=14 and p.dev_only=14 and s.visible_products=0 then 'PASS' else 'BLOCKED' end as readiness_status,c.operations,c.execution_disabled,c.medium_risk as canary_candidate_operations,c.high_critical as non_canary_operations,p.held,p.zero_attempt_budget,p.dev_only,s.active_products as style_active_products,s.visible_products as style_visible_products,jsonb_build_array('PHASE6_CONTROL_PLANE_CLOSED','PHASE7_EXECUTION_RELEASE_ENTRY_ONLY','NO_BUSINESS_EXECUTION_ENABLED','MEDIUM_RISK_CANARY_CANDIDATES_IDENTIFIED','HIGH_CRITICAL_EXCLUDED_FROM_CANARY','ZERO_EXECUTION_ATTEMPT_BUDGET','STYLE_REMAINS_HIDDEN','NO_PRODUCTION_WRITES') as contract
from catalog c cross join policy p cross join style s;
revoke all on lihen_private.phase7_controlled_execution_entry_readiness from public,anon,authenticated;
grant select on lihen_private.phase7_controlled_execution_entry_readiness to postgres;

create or replace function public.get_phase7_controlled_execution_entry_readiness_controlled()
returns setof lihen_private.phase7_controlled_execution_entry_readiness language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();
begin
 if v_actor is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if;
 if not exists(select 1 from public.profiles p where p.id=v_actor and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN')) then raise exception using errcode='42501',message='LIHEN_PHASE7_ENTRY_READ_FORBIDDEN'; end if;
 return query select * from lihen_private.phase7_controlled_execution_entry_readiness;
end;$$;
revoke all on function public.get_phase7_controlled_execution_entry_readiness_controlled() from public,anon;
grant execute on function public.get_phase7_controlled_execution_entry_readiness_controlled() to authenticated,postgres;

insert into lihen_private.phase_exit_gate_results(phase_code,status,gate_version,metrics,accepted_waivers,notes,evaluated_at)
select '7.0',case when r.readiness_status='PASS' then 'PASS' else 'BLOCKED' end,'PHASE7_CONTROLLED_EXECUTION_ENTRY_V1',
jsonb_build_object('operations',r.operations,'execution_disabled',r.execution_disabled,'canary_candidate_operations',r.canary_candidate_operations,'non_canary_operations',r.non_canary_operations,'held',r.held,'zero_attempt_budget',r.zero_attempt_budget,'dev_only',r.dev_only,'style_active_products',r.style_active_products,'style_visible_products',r.style_visible_products,'contract',r.contract),
'[]'::jsonb,'FASE 7 entry only. Controlled execution release preparation begins with all execution still disabled, all release policies HELD, and zero attempt budget.',now()
from lihen_private.phase7_controlled_execution_entry_readiness r
on conflict (phase_code) do update set status=excluded.status,gate_version=excluded.gate_version,metrics=excluded.metrics,accepted_waivers=excluded.accepted_waivers,notes=excluded.notes,evaluated_at=excluded.evaluated_at;
