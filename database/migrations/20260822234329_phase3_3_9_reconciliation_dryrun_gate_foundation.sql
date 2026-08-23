-- FASE 3.3–3.9 — Reconciliation / Application Plan / Dry-run Gate
-- Repo-sync copy of migration already applied in DEV at version 20260822234329.
-- No canonical business data is written by this migration.

create table if not exists lihen_private.cutover_application_plan (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references lihen_private.cutover_runs(id) on delete cascade,
  domain text not null check (domain in ('PRODUCT','INVENTORY','SUPPLIER','PURCHASE','ORDER','SALE','FINANCE')),
  source_row_key text not null,
  canonical_entity_type text,
  canonical_entity_id uuid,
  operation_type text not null
    check (operation_type in ('NOOP','CREATE','ADJUST','LINK','IMPORT_HISTORY','BLOCK')),
  current_state jsonb not null default '{}'::jsonb,
  proposed_state jsonb not null default '{}'::jsonb,
  delta jsonb not null default '{}'::jsonb,
  plan_status text not null default 'PENDING'
    check (plan_status in ('PENDING','READY','BLOCKED','APPLIED','SKIPPED','FAILED')),
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, domain, source_row_key)
);

create table if not exists lihen_private.cutover_validations (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references lihen_private.cutover_runs(id) on delete cascade,
  domain text not null check (domain in ('GLOBAL','PRODUCT','INVENTORY','SUPPLIER','PURCHASE','ORDER','SALE','FINANCE')),
  check_code text not null,
  status text not null check (status in ('PASS','WARN','FAIL')),
  issue_count integer not null default 0 check (issue_count >= 0),
  details jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now(),
  unique (run_id, domain, check_code)
);

alter table lihen_private.cutover_application_plan enable row level security;
alter table lihen_private.cutover_validations enable row level security;
revoke all on lihen_private.cutover_application_plan from anon, authenticated;
revoke all on lihen_private.cutover_validations from anon, authenticated;

create or replace view public.cutover_domain_readiness
with (security_invoker = true)
as
with domains(domain) as (
  values ('PRODUCT'),('INVENTORY'),('SUPPLIER'),('PURCHASE'),('ORDER'),('SALE'),('FINANCE')
),
item_counts as (
  select run_id, domain,
    count(*) total_items,
    count(*) filter (where match_status='MATCHED') matched_items,
    count(*) filter (where match_status='AMBIGUOUS') ambiguous_items,
    count(*) filter (where match_status='UNMATCHED') unmatched_items,
    count(*) filter (where match_status='BLOCKED') blocked_items,
    count(*) filter (where decision_status in ('POLICY_APPROVED','HUMAN_APPROVED')) approved_items,
    count(*) filter (where decision_status='PENDING') pending_items,
    count(*) filter (where decision_status='REJECTED') rejected_items
  from lihen_private.cutover_items
  group by run_id, domain
),
plan_counts as (
  select run_id, domain,
    count(*) total_plan_rows,
    count(*) filter (where plan_status='READY') ready_plan_rows,
    count(*) filter (where plan_status='BLOCKED') blocked_plan_rows
  from lihen_private.cutover_application_plan
  group by run_id, domain
),
validation_counts as (
  select run_id, domain,
    count(*) filter (where status='FAIL') failed_checks,
    count(*) filter (where status='WARN') warning_checks
  from lihen_private.cutover_validations
  where domain <> 'GLOBAL'
  group by run_id, domain
)
select
  r.id as run_id,
  d.domain,
  coalesce(i.total_items,0) total_items,
  coalesce(i.matched_items,0) matched_items,
  coalesce(i.ambiguous_items,0) ambiguous_items,
  coalesce(i.unmatched_items,0) unmatched_items,
  coalesce(i.blocked_items,0) blocked_items,
  coalesce(i.approved_items,0) approved_items,
  coalesce(i.pending_items,0) pending_items,
  coalesce(i.rejected_items,0) rejected_items,
  coalesce(p.total_plan_rows,0) total_plan_rows,
  coalesce(p.ready_plan_rows,0) ready_plan_rows,
  coalesce(p.blocked_plan_rows,0) blocked_plan_rows,
  coalesce(v.failed_checks,0) failed_checks,
  coalesce(v.warning_checks,0) warning_checks,
  case
    when coalesce(i.ambiguous_items,0)>0
      or coalesce(i.unmatched_items,0)>0
      or coalesce(i.blocked_items,0)>0
      or coalesce(i.pending_items,0)>0
      or coalesce(i.rejected_items,0)>0
      or coalesce(p.blocked_plan_rows,0)>0
      or coalesce(v.failed_checks,0)>0 then 'BLOCKED'
    when coalesce(i.total_items,0)=0 then 'EMPTY'
    when coalesce(i.approved_items,0)=coalesce(i.total_items,0)
      and coalesce(p.ready_plan_rows,0)=coalesce(p.total_plan_rows,0) then 'READY'
    else 'REVIEW'
  end as readiness
from lihen_private.cutover_runs r
cross join domains d
left join item_counts i on i.run_id=r.id and i.domain=d.domain
left join plan_counts p on p.run_id=r.id and p.domain=d.domain
left join validation_counts v on v.run_id=r.id and v.domain=d.domain;

create or replace view public.cutover_dry_run_summary
with (security_invoker = true)
as
select
  r.id as run_id,
  r.source_system,
  r.source_name,
  r.snapshot_at,
  r.status,
  count(p.*) as planned_operations,
  count(p.*) filter (where p.operation_type='CREATE') as creates,
  count(p.*) filter (where p.operation_type='ADJUST') as adjustments,
  count(p.*) filter (where p.operation_type='IMPORT_HISTORY') as history_imports,
  count(p.*) filter (where p.operation_type='LINK') as links,
  count(p.*) filter (where p.operation_type='NOOP') as noops,
  count(p.*) filter (where p.operation_type='BLOCK' or p.plan_status='BLOCKED') as blocked_operations,
  coalesce((
    select sum(v.issue_count)
    from lihen_private.cutover_validations v
    where v.run_id=r.id and v.status='FAIL'
  ),0) as validation_failures,
  case
    when exists (
      select 1 from public.cutover_domain_readiness d
      where d.run_id=r.id and d.readiness in ('BLOCKED','REVIEW')
    ) then 'BLOCKED'
    when not exists (
      select 1 from lihen_private.cutover_items i where i.run_id=r.id
    ) then 'WAITING_FOR_SNAPSHOT'
    else 'READY_FOR_CUTOVER'
  end as gate_status
from lihen_private.cutover_runs r
left join lihen_private.cutover_application_plan p on p.run_id=r.id
group by r.id;
