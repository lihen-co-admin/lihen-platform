-- FASE 1.21 — PRODUCT IMPORT CANDIDATES & REVIEW FOUNDATION
-- Staging/review only. This migration never inserts into public.products.

create table if not exists lihen_private.product_import_candidate_runs (
  id uuid primary key default gen_random_uuid(),
  source_key text not null,
  strategy_version text not null,
  status text not null default 'DRAFT',
  source_reference_count integer not null default 0,
  ready_candidate_count integer not null default 0,
  conflict_count integer not null default 0,
  review_required_count integer not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  constraint product_import_candidate_run_status_check check (status in ('DRAFT','COMPLETED','SUPERSEDED')),
  constraint product_import_candidate_run_counts_check check (
    source_reference_count >= 0 and ready_candidate_count >= 0 and conflict_count >= 0 and review_required_count >= 0
  )
);

create table if not exists lihen_private.product_import_candidates (
  run_id uuid not null references lihen_private.product_import_candidate_runs(id) on delete restrict,
  source_reference_id text not null,
  source_page integer not null,
  source_slot text not null,
  product_name text not null,
  normalized_name text not null,
  sku text,
  catalog_code text,
  brand_id uuid references public.brands(id) on delete restrict,
  category_id uuid references public.categories(id) on delete restrict,
  sale_price numeric not null,
  image_sha256 text,
  status text not null,
  proposed_action text not null,
  identity_group_size integer not null default 1,
  reasons jsonb not null default '[]'::jsonb,
  supplier_evidence jsonb not null default '[]'::jsonb,
  auto_insert_allowed boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (run_id, source_reference_id),
  constraint product_import_candidate_name_check check (length(btrim(product_name)) > 0),
  constraint product_import_candidate_price_check check (sale_price >= 0),
  constraint product_import_candidate_hash_check check (image_sha256 is null or image_sha256 ~ '^[0-9a-f]{64}$'),
  constraint product_import_candidate_taxonomy_anchor_check check (brand_id is not null or category_id is not null),
  constraint product_import_candidate_status_check check (status in ('READY_CANDIDATE','CONFLICT','REVIEW_REQUIRED')),
  constraint product_import_candidate_action_check check (proposed_action in ('CREATE_PRODUCT','HOLD_FOR_REVIEW')),
  constraint product_import_candidate_no_auto_insert_check check (auto_insert_allowed = false),
  constraint product_import_candidate_action_consistency_check check (
    (status = 'READY_CANDIDATE' and proposed_action = 'CREATE_PRODUCT') or
    (status in ('CONFLICT','REVIEW_REQUIRED') and proposed_action = 'HOLD_FOR_REVIEW')
  )
);

create index if not exists product_import_candidates_brand_idx
  on lihen_private.product_import_candidates(brand_id);
create index if not exists product_import_candidates_category_idx
  on lihen_private.product_import_candidates(category_id);
create index if not exists product_import_candidates_status_idx
  on lihen_private.product_import_candidates(run_id,status);
create index if not exists product_import_candidates_normalized_name_idx
  on lihen_private.product_import_candidates(normalized_name);

create table if not exists lihen_private.product_import_candidate_reviews (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  source_reference_id text not null,
  decision text not null,
  selected_product_id uuid references public.products(id) on delete restrict,
  reason text not null,
  decided_by uuid not null references auth.users(id) on delete restrict,
  decided_at timestamptz not null default now(),
  foreign key (run_id, source_reference_id)
    references lihen_private.product_import_candidates(run_id, source_reference_id) on delete restrict,
  constraint product_import_candidate_review_decision_check check (
    decision in ('APPROVE_CREATE','LINK_EXISTING_PRODUCT','REJECT','DEFER')
  ),
  constraint product_import_candidate_review_reason_check check (length(btrim(reason)) > 0),
  constraint product_import_candidate_review_selected_check check (
    (decision = 'LINK_EXISTING_PRODUCT' and selected_product_id is not null) or
    (decision <> 'LINK_EXISTING_PRODUCT' and selected_product_id is null)
  )
);

revoke all on table lihen_private.product_import_candidate_runs from public, anon, authenticated;
revoke all on table lihen_private.product_import_candidates from public, anon, authenticated;
revoke all on table lihen_private.product_import_candidate_reviews from public, anon, authenticated;
