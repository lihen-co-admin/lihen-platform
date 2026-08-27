create table if not exists lihen_private.control_center_operation_canary_policy (
 operation_code text primary key references lihen_private.control_center_operation_catalog(operation_code),
 canary_eligible boolean not null,canary_enabled boolean not null default false,eligibility_reason text not null,
 max_canary_attempts_per_hour integer not null default 0 check (max_canary_attempts_per_hour >= 0),
 requires_manual_release boolean not null default true,
 allowed_environment text not null default 'DEV_ONLY' check (allowed_environment in ('DEV_ONLY','PRODUCTION_APPROVED')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
revoke all on lihen_private.control_center_operation_canary_policy from public,anon,authenticated;
grant select on lihen_private.control_center_operation_canary_policy to postgres;
insert into lihen_private.control_center_operation_canary_policy(operation_code,canary_eligible,canary_enabled,eligibility_reason,max_canary_attempts_per_hour,requires_manual_release,allowed_environment)
select c.operation_code,(c.risk_level='MEDIUM'),false,case when c.risk_level='MEDIUM' then 'MEDIUM_RISK_CANDIDATE_ONLY' else 'HIGH_CRITICAL_EXCLUDED' end,0,true,'DEV_ONLY'
from lihen_private.control_center_operation_catalog c
on conflict(operation_code) do update set canary_eligible=excluded.canary_eligible,canary_enabled=false,eligibility_reason=excluded.eligibility_reason,max_canary_attempts_per_hour=0,requires_manual_release=true,allowed_environment='DEV_ONLY',updated_at=now();

create or replace view lihen_private.phase7_1_canary_release_policy_readiness as
with p as (select count(*)::int as policies,count(*) filter(where canary_eligible)::int as eligible,count(*) filter(where not canary_eligible)::int as excluded,count(*) filter(where canary_enabled=false)::int as disabled,count(*) filter(where max_canary_attempts_per_hour=0)::int as zero_budget,count(*) filter(where requires_manual_release)::int as manual_release,count(*) filter(where allowed_environment='DEV_ONLY')::int as dev_only from lihen_private.control_center_operation_canary_policy),
catalog as (select count(*) filter(where risk_level='MEDIUM')::int as medium_risk,count(*) filter(where risk_level in ('HIGH','CRITICAL'))::int as high_critical,count(*) filter(where execution_enabled=false)::int as execution_disabled from lihen_private.control_center_operation_catalog),
style as (select count(*) filter(where status='ACTIVE')::int as active_products,count(*) filter(where status='ACTIVE' and visible_on_website)::int as visible_products from public.products where business_line='STYLE'),
p70 as (select status from lihen_private.phase_exit_gate_results where phase_code='7.0')
select case when (select status from p70)='PASS' and p.policies=14 and p.eligible=4 and p.excluded=10 and p.disabled=14 and p.zero_budget=14 and p.manual_release=14 and p.dev_only=14 and c.medium_risk=4 and c.high_critical=10 and c.execution_disabled=14 and s.visible_products=0 then 'PASS' else 'BLOCKED' end as readiness_status,p.policies,p.eligible,p.excluded,p.disabled,p.zero_budget,p.manual_release,p.dev_only,s.active_products as style_active_products,s.visible_products as style_visible_products,jsonb_build_array('CANARY_POLICY_DEFINED_FOR_ALL_OPERATIONS','MEDIUM_RISK_ONLY_ELIGIBLE','HIGH_CRITICAL_EXCLUDED','CANARY_ENABLED_FALSE_FOR_ALL','ZERO_CANARY_ATTEMPT_BUDGET','MANUAL_RELEASE_REQUIRED','DEV_ONLY','NO_PRODUCTION_WRITES') as contract
from p cross join catalog c cross join style s;
revoke all on lihen_private.phase7_1_canary_release_policy_readiness from public,anon,authenticated;
grant select on lihen_private.phase7_1_canary_release_policy_readiness to postgres;

insert into lihen_private.phase_exit_gate_results(phase_code,status,gate_version,metrics,accepted_waivers,notes,evaluated_at)
select '7.1',case when r.readiness_status='PASS' then 'PASS' else 'BLOCKED' end,'PHASE7_1_CANARY_RELEASE_POLICY_FOUNDATION_V1',
jsonb_build_object('policies',r.policies,'eligible',r.eligible,'excluded',r.excluded,'disabled',r.disabled,'zero_budget',r.zero_budget,'manual_release',r.manual_release,'dev_only',r.dev_only,'style_active_products',r.style_active_products,'style_visible_products',r.style_visible_products,'contract',r.contract),
'[]'::jsonb,'FASE 7.1 canary policy foundation. Four MEDIUM-risk operations are candidates, but all canary execution remains disabled with zero attempt budget and manual release required.',now()
from lihen_private.phase7_1_canary_release_policy_readiness r
on conflict (phase_code) do update set status=excluded.status,gate_version=excluded.gate_version,metrics=excluded.metrics,accepted_waivers=excluded.accepted_waivers,notes=excluded.notes,evaluated_at=excluded.evaluated_at;
