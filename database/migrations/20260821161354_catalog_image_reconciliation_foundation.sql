-- FASE 1.18 — CATALOG IMAGE RECONCILIATION & ORCHESTRATION FOUNDATION
-- Creates private reconciliation structures only.
-- Does NOT import catalog evidence, create product_images, upload Storage objects,
-- or assign any product_id automatically.

begin;

create table if not exists lihen_private.catalog_image_evidence_sources (
  source_key text primary key,
  source_file_name text not null,
  source_sha256 text not null,
  source_page_count integer not null,
  evidence_count integer not null,
  is_canonical boolean not null default false,
  created_at timestamptz not null default now(),
  constraint catalog_image_evidence_source_key_not_blank check (length(btrim(source_key)) > 0),
  constraint catalog_image_evidence_source_sha256_check check (source_sha256 ~ '^[0-9a-f]{64}$'),
  constraint catalog_image_evidence_source_page_count_check check (source_page_count > 0),
  constraint catalog_image_evidence_source_count_check check (evidence_count >= 0)
);

create table if not exists lihen_private.catalog_image_evidence (
  evidence_id text primary key,
  source_key text not null references lihen_private.catalog_image_evidence_sources(source_key) on delete restrict,
  source_page integer not null,
  slot text not null,
  brand_label text null,
  brand_confidence text null,
  section_label text null,
  product_name_visible text not null,
  price_cop numeric(14,2) null,
  evidence_sha256 text not null,
  evidence_path text not null,
  audit_review_status text not null,
  audit_review_reasons text null,
  created_at timestamptz not null default now(),
  constraint catalog_image_evidence_page_check check (source_page > 0),
  constraint catalog_image_evidence_slot_not_blank check (length(btrim(slot)) > 0),
  constraint catalog_image_evidence_name_not_blank check (length(btrim(product_name_visible)) > 0),
  constraint catalog_image_evidence_price_check check (price_cop is null or price_cop >= 0),
  constraint catalog_image_evidence_sha256_check check (evidence_sha256 ~ '^[0-9a-f]{64}$'),
  constraint catalog_image_evidence_review_status_check check (audit_review_status in ('OK','REVIEW')),
  constraint catalog_image_evidence_source_slot_unique unique (source_key, source_page, slot)
);

create index if not exists catalog_image_evidence_identity_idx
  on lihen_private.catalog_image_evidence(source_key, product_name_visible, brand_label);

create index if not exists catalog_image_evidence_sha256_idx
  on lihen_private.catalog_image_evidence(evidence_sha256);

create table if not exists lihen_private.catalog_image_reconciliation_runs (
  id uuid primary key default gen_random_uuid(),
  source_key text not null references lihen_private.catalog_image_evidence_sources(source_key) on delete restrict,
  strategy_version text not null,
  status text not null default 'DRAFT',
  product_master_count integer not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz null,
  created_by uuid null references auth.users(id) on delete set null,
  constraint catalog_image_reconciliation_strategy_not_blank check (length(btrim(strategy_version)) > 0),
  constraint catalog_image_reconciliation_run_status_check check (status in ('DRAFT','COMPLETED','SUPERSEDED')),
  constraint catalog_image_reconciliation_product_count_check check (product_master_count >= 0)
);

create table if not exists lihen_private.catalog_image_reconciliation_results (
  run_id uuid not null references lihen_private.catalog_image_reconciliation_runs(id) on delete restrict,
  evidence_id text not null references lihen_private.catalog_image_evidence(evidence_id) on delete restrict,
  status text not null,
  match_method text not null,
  confidence smallint not null,
  selected_product_id uuid null references public.products(id) on delete restrict,
  candidate_product_ids uuid[] not null default '{}',
  reasons jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  primary key (run_id, evidence_id),
  constraint catalog_image_reconciliation_result_status_check
    check (status in ('UNRESOLVED_PRODUCT','MATCHED_EXACT','AMBIGUOUS_MATCH','REVIEW_REQUIRED')),
  constraint catalog_image_reconciliation_match_method_check
    check (match_method in ('NORMALIZED_NAME_AND_BRAND','NORMALIZED_NAME_ONLY','NONE')),
  constraint catalog_image_reconciliation_confidence_check check (confidence between 0 and 100),
  constraint catalog_image_reconciliation_selected_consistency_check check (
    (status = 'MATCHED_EXACT' and selected_product_id is not null)
    or (status <> 'MATCHED_EXACT' and selected_product_id is null)
  )
);

create index if not exists catalog_image_reconciliation_results_status_idx
  on lihen_private.catalog_image_reconciliation_results(run_id, status);

create table if not exists lihen_private.catalog_image_reconciliation_decisions (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  evidence_id text not null,
  decision text not null,
  selected_product_id uuid null references public.products(id) on delete restrict,
  reason text not null,
  decided_by uuid not null references auth.users(id) on delete restrict,
  decided_at timestamptz not null default now(),
  foreign key (run_id, evidence_id)
    references lihen_private.catalog_image_reconciliation_results(run_id, evidence_id)
    on delete restrict,
  constraint catalog_image_reconciliation_decision_check
    check (decision in ('APPROVE_MATCH','REJECT_MATCH','DEFER')),
  constraint catalog_image_reconciliation_decision_reason_not_blank
    check (length(btrim(reason)) > 0),
  constraint catalog_image_reconciliation_approval_product_check
    check ((decision = 'APPROVE_MATCH' and selected_product_id is not null) or decision <> 'APPROVE_MATCH')
);

revoke all on table lihen_private.catalog_image_evidence_sources from public, anon, authenticated;
revoke all on table lihen_private.catalog_image_evidence from public, anon, authenticated;
revoke all on table lihen_private.catalog_image_reconciliation_runs from public, anon, authenticated;
revoke all on table lihen_private.catalog_image_reconciliation_results from public, anon, authenticated;
revoke all on table lihen_private.catalog_image_reconciliation_decisions from public, anon, authenticated;

comment on table lihen_private.catalog_image_evidence is
  'Metadata-only catalog evidence. Evidence crops are not canonical originals and are not uploaded by FASE 1.18.';
comment on table lihen_private.catalog_image_reconciliation_results is
  'Deterministic reconciliation output. Fuzzy matching cannot auto-assign product_id.';
comment on table lihen_private.catalog_image_reconciliation_decisions is
  'Append-only human decisions for catalog evidence to product_id reconciliation.';

commit;
