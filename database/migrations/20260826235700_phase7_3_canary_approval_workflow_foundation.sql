create table if not exists lihen_private.control_center_operation_canary_approval_policy (operation_code text primary key references lihen_private.control_center_operation_catalog(operation_code), approval_required boolean not null default true, minimum_approvers integer not null default 1 check (minimum_approvers>=1), approval_state text not null default 'NOT_REQUESTED' check (approval_state in ('NOT_REQUESTED','PENDING','APPROVED','REJECTED','EXPIRED')), release_scope text not null default 'DEV_CANARY_ONLY' check (release_scope in ('DEV_CANARY_ONLY','PRODUCTION_APPROVED')), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
revoke all on lihen_private.control_center_operation_canary_approval_policy from public,anon,authenticated;
grant select on lihen_private.control_center_operation_canary_approval_policy to postgres;
insert into lihen_private.control_center_operation_canary_approval_policy(operation_code,approval_required,minimum_approvers,approval_state,release_scope)
select operation_code,true,case when risk_level='MEDIUM' then 1 else 2 end,'NOT_REQUESTED','DEV_CANARY_ONLY'
from lihen_private.control_center_operation_catalog
on conflict(operation_code) do update set approval_required=true,minimum_approvers=excluded.minimum_approvers,approval_state='NOT_REQUESTED',release_scope='DEV_CANARY_ONLY',updated_at=now();

create or replace view lihen_private.phase7_3_canary_approval_workflow_readiness as
with p as (select count(*)::int as policies,count(*) filter(where approval_required)::int as approval_required,count(*) filter(where approval_state='NOT_REQUESTED')::int as not_requested,count(*) filter(where release_scope='DEV_CANARY_ONLY')::int as dev_only from lihen_private.control_center_operation_canary_approval_policy),
c as (select count(*) filter(where risk_level='MEDIUM')::int as medium_risk from lihen_private.control_center_operation_catalog),
s as (select count(*) filter(where status='ACTIVE' and visible_on_website)::int as visible_products from public.products where business_line='STYLE'),
g as (select status from lihen_private.phase_exit_gate_results where phase_code='7.2')
select case when (select status from g)='PASS' and p.policies=14 and p.approval_required=14 and p.not_requested=14 and p.dev_only=14 and c.medium_risk=4 and s.visible_products=0 then 'PASS' else 'BLOCKED' end as readiness_status,p.policies,p.approval_required,p.not_requested,p.dev_only,c.medium_risk as canary_candidates,s.visible_products as style_visible_products,jsonb_build_array('APPROVAL_POLICY_DEFINED_FOR_ALL_OPERATIONS','MANUAL_APPROVAL_REQUIRED','NO_APPROVAL_AUTO_GRANTED','DEV_CANARY_ONLY','FOUR_MEDIUM_RISK_CANDIDATES','HIGH_CRITICAL_REMAIN_EXCLUDED','STYLE_REMAINS_HIDDEN','NO_PRODUCTION_WRITES') as contract
from p cross join c cross join s;
revoke all on lihen_private.phase7_3_canary_approval_workflow_readiness from public,anon,authenticated;
grant select on lihen_private.phase7_3_canary_approval_workflow_readiness to postgres;
insert into lihen_private.phase_exit_gate_results(phase_code,status,gate_version,metrics,accepted_waivers,notes,evaluated_at)
select '7.3',case when readiness_status='PASS' then 'PASS' else 'BLOCKED' end,'PHASE7_3_CANARY_APPROVAL_WORKFLOW_FOUNDATION_V1',jsonb_build_object('policies',policies,'approval_required',approval_required,'not_requested',not_requested,'dev_only',dev_only,'canary_candidates',canary_candidates,'style_visible_products',style_visible_products,'contract',contract),'[]'::jsonb,'FASE 7.3 defines manual approval policy only. No approval is granted, no canary is enabled and no business execution occurs.',now()
from lihen_private.phase7_3_canary_approval_workflow_readiness
on conflict(phase_code) do update set status=excluded.status,gate_version=excluded.gate_version,metrics=excluded.metrics,accepted_waivers=excluded.accepted_waivers,notes=excluded.notes,evaluated_at=excluded.evaluated_at;
