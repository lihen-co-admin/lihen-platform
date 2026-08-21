-- Applied in DEV. Private evidence proposal persistence only.
-- See docs/product-import/FASE_1_21_3_CONFLICT_REVIEW_EVIDENCE_RESOLUTION.md
create table if not exists lihen_private.product_review_evidence_runs (
  id uuid primary key default gen_random_uuid(),
  candidate_run_id uuid not null references lihen_private.product_import_candidate_runs(id) on delete restrict,
  strategy_version text not null,
  status text not null default 'DRAFT',
  identity_group_count integer not null default 0,
  candidate_proposal_count integer not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null
);
-- Full production migration is represented by the DEV migration history; tables are private and grants are revoked.
