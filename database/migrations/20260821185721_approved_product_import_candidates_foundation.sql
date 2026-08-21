-- FASE 1.21.5 — Approved Product Import Candidates Foundation
-- DEV authority: HUMAN_APPROVED_IMPORT_SUBSET only. Does not insert public.products.

create or replace function lihen_private.product_slugify(p_value text)
returns text language sql immutable set search_path=''
as $$
  select trim(both '-' from regexp_replace(
    regexp_replace(lower(translate(coalesce(p_value,''),
      'ÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÑÇáàâãäåéèêëíìîïóòôõöúùûüñç',
      'AAAAAAEEEEIIIIOOOOOUUUUNCaaaaaaeeeeiiiiooooouuuunc')),
      '[^a-z0-9]+','-','g'),'-+','-','g'));
$$;

alter table public.products add column if not exists slug text;
update public.products set slug=concat('product-',substr(md5(id::text),1,12)) where slug is null;
alter table public.products alter column slug set not null;
alter table public.products drop constraint if exists products_slug_not_blank;
alter table public.products add constraint products_slug_not_blank check (btrim(slug)<>'');
create unique index if not exists products_slug_unique on public.products(slug);

create table if not exists lihen_private.approved_product_import_runs (
  id uuid primary key default gen_random_uuid(),
  candidate_run_id uuid not null references lihen_private.product_import_candidate_runs(id) on delete restrict,
  business_line text not null references public.business_lines(code) on delete restrict,
  scope text not null check (scope in ('HUMAN_APPROVED_IMPORT_SUBSET')),
  status text not null default 'DRAFT' check (status in ('DRAFT','COMPLETED','SUPERSEDED')),
  strategy_version text not null,
  approved_source_count integer not null default 0 check (approved_source_count>=0),
  rejected_excluded_count integer not null default 0 check (rejected_excluded_count>=0),
  deferred_excluded_count integer not null default 0 check (deferred_excluded_count>=0),
  ready_candidate_outside_scope_count integer not null default 0 check (ready_candidate_outside_scope_count>=0),
  started_at timestamptz not null default now(), completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  unique(candidate_run_id,scope,strategy_version)
);

create table if not exists lihen_private.approved_product_import_candidates (
  import_run_id uuid not null references lihen_private.approved_product_import_runs(id) on delete restrict,
  candidate_run_id uuid not null,
  source_reference_id text not null,
  proposed_product_id uuid not null,
  business_line text not null references public.business_lines(code) on delete restrict,
  product_name text not null check (btrim(product_name)<>''),
  brand_id uuid references public.brands(id) on delete restrict,
  category_id uuid,
  sale_price numeric not null check (sale_price>=0),
  image_sha256 text not null check (image_sha256 ~ '^[0-9a-f]{64}$'),
  proposed_sku text not null check (btrim(proposed_sku)<>''),
  proposed_catalog_code text not null check (btrim(proposed_catalog_code)<>''),
  proposed_slug text not null check (btrim(proposed_slug)<>''),
  sku_resolution_status text not null check (sku_resolution_status in ('RESERVED_IMPORT_RANGE')),
  catalog_code_resolution_status text not null check (catalog_code_resolution_status in ('GENERATED_CANONICAL_SOURCE_CODE')),
  slug_resolution_status text not null check (slug_resolution_status in ('DETERMINISTIC_CANONICAL')),
  legacy_match_status text not null check (legacy_match_status in ('NO_AUTHORITATIVE_MATCH','POSSIBLE_MATCH_REVIEW_REQUIRED','MATCHED_LEGACY_IDENTITY')),
  eligibility_status text not null check (eligibility_status in ('READY_CREATE','BLOCKED_LEGACY_MATCH','BLOCKED_CONFLICT','BLOCKED_DECISION_DRIFT')),
  reasons jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  primary key(import_run_id,source_reference_id),
  unique(import_run_id,proposed_product_id), unique(import_run_id,proposed_sku),
  unique(import_run_id,proposed_catalog_code), unique(import_run_id,proposed_slug),
  foreign key(candidate_run_id,source_reference_id) references lihen_private.product_import_candidates(run_id,source_reference_id) on delete restrict,
  foreign key(category_id,business_line) references public.categories(id,business_line) on delete restrict
);

create table if not exists lihen_private.approved_product_import_operations (
  operation_key text primary key check (btrim(operation_key)<>''),
  actor_id uuid not null references auth.users(id) on delete restrict,
  import_run_id uuid not null references lihen_private.approved_product_import_runs(id) on delete restrict,
  request_fingerprint text not null,
  status text not null check (status in ('COMPLETED')),
  result_snapshot jsonb not null,
  completed_at timestamptz not null default now()
);

create or replace function lihen_private.preview_approved_product_import(p_import_run_id uuid)
returns table(source_reference_id text,proposed_product_id uuid,proposed_sku text,proposed_catalog_code text,proposed_slug text,product_name text,business_line text,import_status text,reason text)
language sql security definer set search_path=''
as $$
with latest_decision as (
  select distinct on (r.run_id,r.source_reference_id) r.run_id,r.source_reference_id,r.decision
  from lihen_private.product_import_candidate_reviews r
  order by r.run_id,r.source_reference_id,r.decided_at desc
), base as (
  select a.*,d.decision,p_id.id existing_id,p_sku.id existing_sku_id,p_code.id existing_code_id,p_slug.id existing_slug_id,b.id existing_brand_id,cat.id existing_category_id
  from lihen_private.approved_product_import_candidates a
  left join latest_decision d on d.run_id=a.candidate_run_id and d.source_reference_id=a.source_reference_id
  left join public.products p_id on p_id.id=a.proposed_product_id
  left join public.products p_sku on p_sku.sku=a.proposed_sku
  left join public.products p_code on p_code.catalog_code=a.proposed_catalog_code
  left join public.products p_slug on p_slug.slug=a.proposed_slug
  left join public.brands b on b.id=a.brand_id
  left join public.categories cat on cat.id=a.category_id and cat.business_line=a.business_line
  where a.import_run_id=p_import_run_id
)
select source_reference_id,proposed_product_id,proposed_sku,proposed_catalog_code,proposed_slug,product_name,business_line,
 case when decision is distinct from 'APPROVE_CREATE' then 'BLOCKED_DECISION_DRIFT'
      when eligibility_status<>'READY_CREATE' then eligibility_status
      when brand_id is not null and existing_brand_id is null then 'BLOCKED_TAXONOMY'
      when category_id is not null and existing_category_id is null then 'BLOCKED_TAXONOMY'
      when existing_id is not null then 'CONFLICT_PRODUCT_ID'
      when existing_sku_id is not null then 'CONFLICT_SKU'
      when existing_code_id is not null then 'CONFLICT_CATALOG_CODE'
      when existing_slug_id is not null then 'CONFLICT_SLUG'
      else 'READY_CREATE' end,
 case when decision is distinct from 'APPROVE_CREATE' then 'LATEST_DECISION_IS_NOT_APPROVE_CREATE'
      when eligibility_status<>'READY_CREATE' then eligibility_status
      when brand_id is not null and existing_brand_id is null then 'BRAND_NOT_FOUND'
      when category_id is not null and existing_category_id is null then 'CATEGORY_BUSINESS_LINE_NOT_FOUND'
      when existing_id is not null then 'PRODUCT_ID_ALREADY_EXISTS'
      when existing_sku_id is not null then 'SKU_ALREADY_EXISTS'
      when existing_code_id is not null then 'CATALOG_CODE_ALREADY_EXISTS'
      when existing_slug_id is not null then 'SLUG_ALREADY_EXISTS'
      else 'NO_CONFLICT' end
from base;
$$;

revoke all on lihen_private.approved_product_import_runs from public,anon,authenticated;
revoke all on lihen_private.approved_product_import_candidates from public,anon,authenticated;
revoke all on lihen_private.approved_product_import_operations from public,anon,authenticated;
revoke all on function lihen_private.preview_approved_product_import(uuid) from public,anon,authenticated;
