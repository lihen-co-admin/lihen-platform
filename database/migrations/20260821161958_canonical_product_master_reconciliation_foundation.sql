-- FASE 1.19 — CANONICAL PRODUCT MASTER RECONCILIATION FOUNDATION
-- Private staging/reconciliation metadata only.
-- Does NOT insert/update products, brands, categories, product_images or Storage objects.

begin;

create table if not exists lihen_private.product_master_source_snapshots (
  source_key text primary key,
  source_type text not null,
  source_name text not null,
  source_sha256 text null,
  record_count integer not null default 0,
  identity_authority text not null,
  captured_at timestamptz not null default now(),
  notes text null,
  constraint product_master_source_type_check check (source_type in ('CANONICAL_CATALOG','LEGACY_ADMIN','SUPPLIER_INTELLIGENCE','OTHER')),
  constraint product_master_source_authority_check check (identity_authority in ('CANONICAL_REFERENCE','AUXILIARY_ONLY','LEGACY_REFERENCE')),
  constraint product_master_source_count_check check (record_count >= 0),
  constraint product_master_source_sha_check check (source_sha256 is null or source_sha256 ~ '^[0-9a-f]{64}$')
);

create table if not exists lihen_private.product_master_source_records (
  source_key text not null references lihen_private.product_master_source_snapshots(source_key) on delete restrict,
  source_record_key text not null,
  trusted_product_id uuid null references public.products(id) on delete restrict,
  sku text null,
  catalog_code text null,
  product_name text not null,
  brand_label text null,
  category_label text null,
  price_cop numeric(14,2) null,
  image_sha256 text null,
  source_review_required boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (source_key, source_record_key),
  constraint product_master_source_record_name_not_blank check (length(btrim(product_name)) > 0),
  constraint product_master_source_record_price_check check (price_cop is null or price_cop >= 0),
  constraint product_master_source_record_sha_check check (image_sha256 is null or image_sha256 ~ '^[0-9a-f]{64}$')
);

create index if not exists product_master_source_records_sku_idx
  on lihen_private.product_master_source_records(source_key, upper(btrim(sku))) where sku is not null;
create index if not exists product_master_source_records_catalog_code_idx
  on lihen_private.product_master_source_records(source_key, upper(btrim(catalog_code))) where catalog_code is not null;
create index if not exists product_master_source_records_name_idx
  on lihen_private.product_master_source_records(source_key, upper(btrim(product_name)), upper(btrim(coalesce(brand_label,''))));
create index if not exists product_master_source_records_image_sha_idx
  on lihen_private.product_master_source_records(image_sha256) where image_sha256 is not null;

create table if not exists lihen_private.product_master_reconciliation_runs (
  id uuid primary key default gen_random_uuid(),
  source_key text not null references lihen_private.product_master_source_snapshots(source_key) on delete restrict,
  strategy_version text not null,
  status text not null default 'DRAFT',
  product_master_count integer not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz null,
  created_by uuid null references auth.users(id) on delete set null,
  constraint product_master_reconciliation_run_status_check check (status in ('DRAFT','COMPLETED','SUPERSEDED')),
  constraint product_master_reconciliation_run_count_check check (product_master_count >= 0),
  constraint product_master_reconciliation_strategy_not_blank check (length(btrim(strategy_version)) > 0)
);

create table if not exists lihen_private.product_master_reconciliation_results (
  run_id uuid not null references lihen_private.product_master_reconciliation_runs(id) on delete restrict,
  source_record_key text not null,
  status text not null,
  match_method text not null,
  confidence smallint not null,
  selected_product_id uuid null references public.products(id) on delete restrict,
  candidate_product_ids uuid[] not null default '{}',
  auxiliary_evidence jsonb not null default '[]'::jsonb,
  reasons jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  primary key (run_id, source_record_key),
  constraint product_master_reconciliation_result_status_check check (status in ('MATCHED','NEW_PRODUCT','POSSIBLE_MATCH','CONFLICT','REVIEW_REQUIRED')),
  constraint product_master_reconciliation_match_method_check check (match_method in ('PRODUCT_ID','SKU','CATALOG_CODE','NORMALIZED_NAME_AND_BRAND','NORMALIZED_NAME_ONLY','NONE')),
  constraint product_master_reconciliation_confidence_check check (confidence between 0 and 100),
  constraint product_master_reconciliation_selected_check check ((status='MATCHED' and selected_product_id is not null) or (status<>'MATCHED' and selected_product_id is null))
);

create index if not exists product_master_reconciliation_results_status_idx
  on lihen_private.product_master_reconciliation_results(run_id, status);

create table if not exists lihen_private.product_master_reconciliation_decisions (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  source_record_key text not null,
  decision text not null,
  selected_product_id uuid null references public.products(id) on delete restrict,
  reason text not null,
  decided_by uuid not null references auth.users(id) on delete restrict,
  decided_at timestamptz not null default now(),
  foreign key (run_id, source_record_key)
    references lihen_private.product_master_reconciliation_results(run_id, source_record_key) on delete restrict,
  constraint product_master_reconciliation_decision_check check (decision in ('APPROVE_MATCH','APPROVE_NEW_PRODUCT','REJECT','DEFER')),
  constraint product_master_reconciliation_decision_reason_check check (length(btrim(reason)) > 0),
  constraint product_master_reconciliation_decision_product_check check ((decision='APPROVE_MATCH' and selected_product_id is not null) or decision<>'APPROVE_MATCH')
);

revoke all on table lihen_private.product_master_source_snapshots from public, anon, authenticated;
revoke all on table lihen_private.product_master_source_records from public, anon, authenticated;
revoke all on table lihen_private.product_master_reconciliation_runs from public, anon, authenticated;
revoke all on table lihen_private.product_master_reconciliation_results from public, anon, authenticated;
revoke all on table lihen_private.product_master_reconciliation_decisions from public, anon, authenticated;

comment on table lihen_private.product_master_source_records is
  'Private source records for controlled reconciliation. Supplier/intelligence rows are evidence only and never canonical product identity.';
comment on table lihen_private.product_master_reconciliation_results is
  'Recommendations only. MATCHED/NEW_PRODUCT/POSSIBLE_MATCH/CONFLICT/REVIEW_REQUIRED do not write Product Master.';
comment on table lihen_private.product_master_reconciliation_decisions is
  'Append-only human review decisions. APPROVE_NEW_PRODUCT still requires a later controlled import command.';

commit;
