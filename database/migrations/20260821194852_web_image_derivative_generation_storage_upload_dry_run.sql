-- FASE 1.22.1 — WEB IMAGE DERIVATIVE GENERATION & STORAGE UPLOAD DRY-RUN
create table if not exists lihen_private.web_image_derivative_runs (
  id uuid primary key default gen_random_uuid(),
  linkage_run_id uuid not null references lihen_private.canonical_product_image_linkage_runs(id) on delete restrict,
  business_line text not null references public.business_lines(code) on delete restrict,
  transform_version text not null,
  status text not null default 'DRAFT' check (status in ('DRAFT','COMPLETED','SUPERSEDED')),
  source_count integer not null default 0 check (source_count >= 0),
  generated_count integer not null default 0 check (generated_count >= 0),
  ready_upload_count integer not null default 0 check (ready_upload_count >= 0),
  over_limit_count integer not null default 0 check (over_limit_count >= 0),
  duplicate_hash_group_count integer not null default 0 check (duplicate_hash_group_count >= 0),
  started_at timestamptz not null default now(), completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  unique(linkage_run_id, transform_version)
);
create table if not exists lihen_private.web_image_derivative_candidates (
  run_id uuid not null references lihen_private.web_image_derivative_runs(id) on delete restrict,
  linkage_run_id uuid not null,
  source_reference_id text not null,
  product_id uuid not null references public.products(id) on delete restrict,
  product_image_id uuid not null,
  approval_source text not null check (approval_source in ('HUMAN_APPROVED','POLICY_APPROVED')),
  source_evidence_sha256 text not null check (source_evidence_sha256 ~ '^[0-9a-f]{64}$'),
  source_width integer not null check (source_width > 0), source_height integer not null check (source_height > 0),
  derivative_width integer not null check (derivative_width > 0), derivative_height integer not null check (derivative_height > 0),
  derivative_format text not null check (derivative_format='webp'),
  derivative_mime_type text not null check (derivative_mime_type='image/webp'),
  quality smallint not null check (quality between 1 and 100), encoder_method smallint not null check (encoder_method between 0 and 6),
  metadata_stripped boolean not null check (metadata_stripped=true), upscaled boolean not null check (upscaled=false),
  derivative_sha256 text not null check (derivative_sha256 ~ '^[0-9a-f]{64}$'),
  derivative_size_bytes bigint not null check (derivative_size_bytes > 0),
  planned_bucket text not null check (planned_bucket='lihen-product-web'), planned_storage_path text not null,
  upload_status text not null default 'DRY_RUN_READY' check (upload_status in ('DRY_RUN_READY','BLOCKED')),
  created_at timestamptz not null default now(),
  primary key(run_id, source_reference_id), unique(run_id, product_image_id), unique(run_id, planned_storage_path),
  foreign key(linkage_run_id, source_reference_id)
    references lihen_private.canonical_product_image_linkage_candidates(run_id, source_reference_id) on delete restrict
);
-- The authoritative preview is installed in DEV and intentionally remains private.
revoke all on lihen_private.web_image_derivative_runs from public, anon, authenticated;
revoke all on lihen_private.web_image_derivative_candidates from public, anon, authenticated;
