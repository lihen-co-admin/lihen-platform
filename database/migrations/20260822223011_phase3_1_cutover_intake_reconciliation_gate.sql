-- FASE 3.1 — Cutover Intake + Reconciliation Gate
-- Repo-sync copy of the migration already applied in Supabase DEV.
-- IMPORTANT: do not execute this file manually against the existing DEV project.
-- The migration history already contains version 20260822223011.

create schema if not exists lihen_private;

create table if not exists lihen_private.cutover_runs (
  id uuid primary key default gen_random_uuid(),
  source_system text not null check (source_system = 'LIHEN_ADMIN_PRO'),
  source_name text not null,
  source_sha256 text not null,
  snapshot_at timestamptz not null,
  status text not null default 'INTAKE'
    check (status in ('INTAKE','RECONCILING','BLOCKED','READY_FOR_APPROVAL','APPROVED','APPLYING','APPLIED','ABORTED')),
  source_counts jsonb not null default '{}'::jsonb,
  reconciliation_counts jsonb not null default '{}'::jsonb,
  notes text,
  created_by uuid references auth.users(id),
  approved_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  applied_at timestamptz,
  unique (source_system, source_sha256)
);

create table if not exists lihen_private.cutover_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references lihen_private.cutover_runs(id) on delete cascade,
  domain text not null check (domain in ('PRODUCT','INVENTORY','SUPPLIER','PURCHASE','ORDER','SALE','FINANCE')),
  source_row_key text not null,
  source_fingerprint text not null,
  canonical_entity_type text,
  canonical_entity_id uuid,
  match_status text not null default 'UNMATCHED'
    check (match_status in ('MATCHED','AMBIGUOUS','UNMATCHED','BLOCKED','SKIPPED')),
  match_method text,
  confidence numeric,
  decision_status text not null default 'PENDING'
    check (decision_status in ('PENDING','POLICY_APPROVED','HUMAN_APPROVED','REJECTED')),
  source_snapshot jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (run_id, domain, source_row_key)
);

alter table lihen_private.cutover_runs enable row level security;
alter table lihen_private.cutover_items enable row level security;

revoke all on lihen_private.cutover_runs from anon, authenticated;
revoke all on lihen_private.cutover_items from anon, authenticated;

create or replace view public.cutover_readiness
with (security_invoker = true)
as
select
  r.id as run_id,
  r.source_system,
  r.source_name,
  r.snapshot_at,
  r.status as run_status,
  count(i.id) as total_items,
  count(i.id) filter (where i.match_status = 'MATCHED') as matched_items,
  count(i.id) filter (where i.match_status = 'AMBIGUOUS') as ambiguous_items,
  count(i.id) filter (where i.match_status = 'UNMATCHED') as unmatched_items,
  count(i.id) filter (where i.match_status = 'BLOCKED') as blocked_items,
  count(i.id) filter (where i.decision_status in ('POLICY_APPROVED','HUMAN_APPROVED')) as approved_items,
  case
    when r.status not in ('READY_FOR_APPROVAL','APPROVED','APPLYING','APPLIED') then 'BLOCKED'
    when count(i.id) filter (where i.match_status in ('AMBIGUOUS','UNMATCHED','BLOCKED')) > 0 then 'BLOCKED'
    when count(i.id) filter (
      where i.match_status = 'MATCHED'
      and i.decision_status not in ('POLICY_APPROVED','HUMAN_APPROVED')
    ) > 0 then 'BLOCKED'
    else 'PASS'
  end as readiness
from lihen_private.cutover_runs r
left join lihen_private.cutover_items i on i.run_id = r.id
group by r.id, r.source_system, r.source_name, r.snapshot_at, r.status;
