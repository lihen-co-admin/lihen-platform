create table if not exists lihen_private.control_center_operation_release_requests (
 release_request_id uuid primary key default gen_random_uuid(),
 operation_code text not null references lihen_private.control_center_operation_catalog(operation_code),
 requested_by uuid not null references public.profiles(id),
 requested_at timestamptz not null default now(),
 requested_environment text not null default 'DEV_ONLY' check(requested_environment in ('DEV_ONLY','PRODUCTION_APPROVED')),
 request_reason text not null,
 request_status text not null default 'PENDING' check(request_status in ('PENDING','APPROVED','REJECTED','CANCELLED','EXPIRED')),
 approved_by uuid references public.profiles(id),
 approved_at timestamptz,
 expires_at timestamptz not null default(now()+interval '30 minutes'),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
revoke all on lihen_private.control_center_operation_release_requests from public,anon,authenticated;
grant select on lihen_private.control_center_operation_release_requests to postgres;
create unique index if not exists control_center_operation_release_requests_one_pending on lihen_private.control_center_operation_release_requests(operation_code) where request_status='PENDING';

create or replace view lihen_private.phase8_1_manual_release_request_readiness as
with r as (select count(*)::int as total_requests,count(*) filter(where request_status='PENDING')::int as pending_requests,count(*) filter(where request_status='APPROVED')::int as approved_requests from lihen_private.control_center_operation_release_requests),
g as (select count(*) filter(where execution_allowed=false)::int as blocked from lihen_private.control_center_operation_canary_execution_guard),
p80 as (select status from lihen_private.phase_exit_gate_results where phase_code='8.0'),
s as (select count(*) filter(where status='ACTIVE' and visible_on_website)::int as visible_products from public.products where business_line='STYLE')
select case when (select status from p80)='PASS' and r.total_requests=0 and r.pending_requests=0 and r.approved_requests=0 and g.blocked=14 and s.visible_products=0 then 'PASS' else 'BLOCKED' end as readiness_status,r.total_requests,r.pending_requests,r.approved_requests,g.blocked,s.visible_products as style_visible_products,jsonb_build_array('RELEASE_REQUEST_LEDGER_CREATED','NO_RELEASE_REQUEST_AUTO_CREATED','NO_APPROVAL_AUTO_GRANTED','ONE_PENDING_REQUEST_MAX_PER_OPERATION','THIRTY_MINUTE_REQUEST_EXPIRY','DEV_ONLY_DEFAULT','ALL_EXECUTION_STILL_BLOCKED','NO_PRODUCTION_WRITES') as contract
from r cross join g cross join s;
revoke all on lihen_private.phase8_1_manual_release_request_readiness from public,anon,authenticated;
grant select on lihen_private.phase8_1_manual_release_request_readiness to postgres;
insert into lihen_private.phase_exit_gate_results(phase_code,status,gate_version,metrics,accepted_waivers,notes,evaluated_at)
select '8.1',case when readiness_status='PASS' then 'PASS' else 'BLOCKED' end,'PHASE8_1_MANUAL_RELEASE_REQUEST_FOUNDATION_V1',jsonb_build_object('total_requests',total_requests,'pending_requests',pending_requests,'approved_requests',approved_requests,'blocked',blocked,'style_visible_products',style_visible_products,'contract',contract),'[]'::jsonb,'FASE 8.1 creates the private release request ledger only. No request or approval is created automatically and all execution stays blocked.',now()
from lihen_private.phase8_1_manual_release_request_readiness
on conflict(phase_code) do update set status=excluded.status,gate_version=excluded.gate_version,metrics=excluded.metrics,accepted_waivers=excluded.accepted_waivers,notes=excluded.notes,evaluated_at=excluded.evaluated_at;
