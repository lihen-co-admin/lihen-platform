-- FASE 1.20 — BRAND & CATEGORY RECONCILIATION FOUNDATION
-- Private taxonomy evidence/reconciliation metadata only.
-- Does NOT insert/update public.brands, public.categories or public.products.

begin;

create table if not exists lihen_private.taxonomy_source_snapshots (
  source_key text primary key,
  source_name text not null,
  source_sha256 text null,
  brand_reference_count integer not null default 0,
  category_reference_count integer not null default 0,
  captured_at timestamptz not null default now(),
  notes text null,
  constraint taxonomy_source_brand_count_check check (brand_reference_count >= 0),
  constraint taxonomy_source_category_count_check check (category_reference_count >= 0),
  constraint taxonomy_source_sha_check check (source_sha256 is null or source_sha256 ~ '^[0-9a-f]{64}$')
);

create table if not exists lihen_private.taxonomy_source_records (
  source_key text not null references lihen_private.taxonomy_source_snapshots(source_key) on delete restrict,
  source_record_key text not null,
  entity_type text not null,
  trusted_entity_id uuid null,
  display_name text not null,
  source_page integer null,
  source_confidence text not null,
  parent_label text null,
  business_line text null,
  source_review_required boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (source_key, source_record_key),
  constraint taxonomy_source_record_type_check check (entity_type in ('BRAND','CATEGORY')),
  constraint taxonomy_source_record_name_check check (length(btrim(display_name)) > 0),
  constraint taxonomy_source_record_page_check check (source_page is null or source_page > 0),
  constraint taxonomy_source_record_confidence_check check (source_confidence in ('HIGH','MEDIUM','LOW'))
);

create index if not exists taxonomy_source_records_identity_idx
  on lihen_private.taxonomy_source_records(entity_type, upper(btrim(display_name)));

create table if not exists lihen_private.taxonomy_reconciliation_runs (
  id uuid primary key default gen_random_uuid(),
  source_key text not null references lihen_private.taxonomy_source_snapshots(source_key) on delete restrict,
  strategy_version text not null,
  status text not null default 'DRAFT',
  brand_master_count integer not null default 0,
  category_master_count integer not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz null,
  created_by uuid null references auth.users(id) on delete set null,
  constraint taxonomy_run_status_check check (status in ('DRAFT','COMPLETED','SUPERSEDED')),
  constraint taxonomy_run_counts_check check (brand_master_count >= 0 and category_master_count >= 0),
  constraint taxonomy_run_strategy_check check (length(btrim(strategy_version)) > 0)
);

create table if not exists lihen_private.taxonomy_reconciliation_results (
  run_id uuid not null references lihen_private.taxonomy_reconciliation_runs(id) on delete restrict,
  source_record_key text not null,
  entity_type text not null,
  status text not null,
  match_method text not null,
  confidence smallint not null,
  selected_brand_id uuid null references public.brands(id) on delete restrict,
  selected_category_id uuid null references public.categories(id) on delete restrict,
  candidate_brand_ids uuid[] not null default '{}',
  candidate_category_ids uuid[] not null default '{}',
  reasons jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  primary key (run_id, source_record_key),
  constraint taxonomy_result_type_check check (entity_type in ('BRAND','CATEGORY')),
  constraint taxonomy_result_status_check check (status in ('MATCHED','NEW_ENTITY','POSSIBLE_MATCH','CONFLICT','REVIEW_REQUIRED')),
  constraint taxonomy_result_method_check check (match_method in ('TRUSTED_ID','NORMALIZED_NAME','NONE')),
  constraint taxonomy_result_confidence_check check (confidence between 0 and 100),
  constraint taxonomy_result_selected_type_check check (
    (entity_type='BRAND' and selected_category_id is null)
    or (entity_type='CATEGORY' and selected_brand_id is null)
  ),
  constraint taxonomy_result_match_selected_check check (
    (status='MATCHED' and ((entity_type='BRAND' and selected_brand_id is not null) or (entity_type='CATEGORY' and selected_category_id is not null)))
    or (status<>'MATCHED' and selected_brand_id is null and selected_category_id is null)
  )
);

create index if not exists taxonomy_reconciliation_results_status_idx
  on lihen_private.taxonomy_reconciliation_results(run_id, entity_type, status);

create table if not exists lihen_private.taxonomy_reconciliation_decisions (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  source_record_key text not null,
  entity_type text not null,
  decision text not null,
  selected_brand_id uuid null references public.brands(id) on delete restrict,
  selected_category_id uuid null references public.categories(id) on delete restrict,
  canonical_name text null,
  reason text not null,
  decided_by uuid not null references auth.users(id) on delete restrict,
  decided_at timestamptz not null default now(),
  foreign key (run_id, source_record_key)
    references lihen_private.taxonomy_reconciliation_results(run_id, source_record_key) on delete restrict,
  constraint taxonomy_decision_type_check check (entity_type in ('BRAND','CATEGORY')),
  constraint taxonomy_decision_check check (decision in ('APPROVE_MATCH','APPROVE_NEW_ENTITY','REJECT','DEFER')),
  constraint taxonomy_decision_reason_check check (length(btrim(reason)) > 0),
  constraint taxonomy_decision_name_check check (canonical_name is null or length(btrim(canonical_name)) > 0),
  constraint taxonomy_decision_selected_type_check check (
    (entity_type='BRAND' and selected_category_id is null)
    or (entity_type='CATEGORY' and selected_brand_id is null)
  )
);

revoke all on table lihen_private.taxonomy_source_snapshots from public, anon, authenticated;
revoke all on table lihen_private.taxonomy_source_records from public, anon, authenticated;
revoke all on table lihen_private.taxonomy_reconciliation_runs from public, anon, authenticated;
revoke all on table lihen_private.taxonomy_reconciliation_results from public, anon, authenticated;
revoke all on table lihen_private.taxonomy_reconciliation_decisions from public, anon, authenticated;

comment on table lihen_private.taxonomy_source_records is
  'Private brand/category evidence. Source labels are not canonical IDs until reconciliation and human approval.';
comment on table lihen_private.taxonomy_reconciliation_results is
  'Taxonomy recommendations only; results never insert/update brands or categories.';
comment on table lihen_private.taxonomy_reconciliation_decisions is
  'Append-only human taxonomy decisions. APPROVE_NEW_ENTITY still requires a later controlled taxonomy import.';

commit;
