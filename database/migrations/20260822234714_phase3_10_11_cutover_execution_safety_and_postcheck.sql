-- FASE 3.10–3.11 — Execution Safety Wrapper + Post-Cutover Verification
-- Repo-sync copy of migration already applied in DEV at version 20260822234714.
-- CRITICAL: this does NOT enable the real cutover executor.

create table if not exists lihen_private.cutover_execution_batches (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references lihen_private.cutover_runs(id) on delete restrict,
  source_sha256 text not null,
  status text not null default 'PREPARED'
    check (status in ('PREPARED','ARMED','RUNNING','COMPLETED','FAILED','ABORTED')),
  prepared_by uuid references auth.users(id),
  armed_by uuid references auth.users(id),
  prepared_at timestamptz not null default now(),
  armed_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  failure_reason text,
  metadata jsonb not null default '{}'::jsonb,
  unique (run_id)
);

create table if not exists lihen_private.cutover_execution_receipts (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references lihen_private.cutover_execution_batches(id) on delete cascade,
  run_id uuid not null references lihen_private.cutover_runs(id) on delete restrict,
  plan_id uuid not null references lihen_private.cutover_application_plan(id) on delete restrict,
  domain text not null,
  operation_type text not null,
  status text not null check (status in ('APPLIED','SKIPPED','FAILED')),
  canonical_entity_type text,
  canonical_entity_id uuid,
  before_state jsonb not null default '{}'::jsonb,
  after_state jsonb not null default '{}'::jsonb,
  error_detail jsonb not null default '{}'::jsonb,
  applied_at timestamptz not null default now(),
  unique (batch_id, plan_id)
);

create table if not exists lihen_private.cutover_post_verifications (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references lihen_private.cutover_execution_batches(id) on delete cascade,
  run_id uuid not null references lihen_private.cutover_runs(id) on delete restrict,
  check_code text not null,
  status text not null check (status in ('PASS','WARN','FAIL')),
  issue_count integer not null default 0 check (issue_count >= 0),
  details jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now(),
  unique (batch_id, check_code)
);

alter table lihen_private.cutover_execution_batches enable row level security;
alter table lihen_private.cutover_execution_receipts enable row level security;
alter table lihen_private.cutover_post_verifications enable row level security;

revoke all on lihen_private.cutover_execution_batches from anon, authenticated;
revoke all on lihen_private.cutover_execution_receipts from anon, authenticated;
revoke all on lihen_private.cutover_post_verifications from anon, authenticated;

create or replace view public.cutover_execution_readiness
with (security_invoker = true)
as
select
  r.id as run_id,
  r.source_system,
  r.source_name,
  r.source_sha256,
  r.snapshot_at,
  r.status as run_status,
  s.gate_status as dry_run_gate_status,
  coalesce(s.planned_operations,0) as planned_operations,
  coalesce(s.blocked_operations,0) as blocked_operations,
  coalesce(s.validation_failures,0) as validation_failures,
  case
    when r.status <> 'APPROVED' then 'BLOCKED'
    when r.approved_by is null or r.approved_at is null then 'BLOCKED'
    when s.gate_status <> 'READY_FOR_CUTOVER' then 'BLOCKED'
    when coalesce(s.blocked_operations,0)>0 then 'BLOCKED'
    when coalesce(s.validation_failures,0)>0 then 'BLOCKED'
    else 'READY_TO_ARM'
  end as execution_readiness
from lihen_private.cutover_runs r
left join public.cutover_dry_run_summary s on s.run_id=r.id;
