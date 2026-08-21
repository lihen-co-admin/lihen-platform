begin;

create table if not exists lihen_private.canonical_product_image_linkage_runs (
  id uuid primary key default gen_random_uuid(),
  product_import_run_id uuid not null references lihen_private.full_canonical_product_import_runs(id) on delete restrict,
  source_key text not null,
  business_line text not null references public.business_lines(code) on delete restrict,
  strategy_version text not null,
  status text not null default 'DRAFT',
  approved_product_count integer not null default 0,
  linked_count integer not null default 0,
  excluded_reject_count integer not null default 0,
  excluded_defer_count integer not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz null,
  created_by uuid null references auth.users(id) on delete set null,
  constraint canonical_product_image_linkage_runs_status_check check (status in ('DRAFT','COMPLETED','SUPERSEDED')),
  constraint canonical_product_image_linkage_runs_counts_check check (approved_product_count>=0 and linked_count>=0 and excluded_reject_count>=0 and excluded_defer_count>=0),
  constraint canonical_product_image_linkage_runs_strategy_not_blank check (length(btrim(strategy_version))>0),
  unique(product_import_run_id, source_key, strategy_version)
);

create table if not exists lihen_private.canonical_product_image_linkage_candidates (
  run_id uuid not null references lihen_private.canonical_product_image_linkage_runs(id) on delete restrict,
  source_reference_id text not null,
  product_id uuid not null references public.products(id) on delete restrict,
  product_image_id uuid not null,
  approval_source text not null,
  evidence_sha256 text not null,
  evidence_path text not null,
  evidence_role text not null default 'CATALOG_EVIDENCE_CROP',
  mime_type text not null default 'image/jpeg',
  file_extension text not null default 'jpg',
  planned_web_bucket text not null default 'lihen-product-web',
  planned_web_path text not null,
  original_upload_status text not null default 'BLOCKED_EVIDENCE_IS_NOT_CANONICAL_ORIGINAL',
  linkage_status text not null default 'READY_LINKAGE',
  created_at timestamptz not null default now(),
  primary key(run_id, source_reference_id),
  unique(run_id, product_id),
  unique(run_id, product_image_id),
  unique(run_id, planned_web_path),
  constraint canonical_product_image_linkage_sha_check check (evidence_sha256 ~ '^[0-9a-f]{64}$'),
  constraint canonical_product_image_linkage_approval_check check (approval_source in ('HUMAN_APPROVED','POLICY_APPROVED')),
  constraint canonical_product_image_linkage_role_check check (evidence_role='CATALOG_EVIDENCE_CROP'),
  constraint canonical_product_image_linkage_mime_check check (mime_type='image/jpeg'),
  constraint canonical_product_image_linkage_ext_check check (file_extension='jpg'),
  constraint canonical_product_image_linkage_web_bucket_check check (planned_web_bucket='lihen-product-web'),
  constraint canonical_product_image_linkage_original_block_check check (original_upload_status='BLOCKED_EVIDENCE_IS_NOT_CANONICAL_ORIGINAL'),
  constraint canonical_product_image_linkage_status_check check (linkage_status in ('READY_LINKAGE','BLOCKED','SUPERSEDED')),
  constraint canonical_product_image_linkage_web_path_check check (planned_web_path like ('products/'||product_id::text||'/'||product_image_id::text||'/web/%'))
);

create table if not exists lihen_private.canonical_product_image_linkage_exclusions (
  run_id uuid not null references lihen_private.canonical_product_image_linkage_runs(id) on delete restrict,
  source_reference_id text not null,
  exclusion_reason text not null,
  evidence_sha256 text not null,
  evidence_path text not null,
  created_at timestamptz not null default now(),
  primary key(run_id, source_reference_id),
  constraint canonical_product_image_exclusion_reason_check check (exclusion_reason in ('REJECT','DEFER')),
  constraint canonical_product_image_exclusion_sha_check check (evidence_sha256 ~ '^[0-9a-f]{64}$')
);

revoke all on lihen_private.canonical_product_image_linkage_runs from public, anon, authenticated;
revoke all on lihen_private.canonical_product_image_linkage_candidates from public, anon, authenticated;
revoke all on lihen_private.canonical_product_image_linkage_exclusions from public, anon, authenticated;

create or replace function lihen_private.preview_canonical_product_image_linkage(p_run_id uuid)
returns table(source_reference_id text, product_id uuid, product_image_id uuid, linkage_status text, reason text)
language sql security definer set search_path=''
as $$
select c.source_reference_id,c.product_id,c.product_image_id,
 case
  when p.id is null then 'BLOCKED'
  when pi.id is not null then 'BLOCKED'
  when so.name is not null then 'BLOCKED'
  when c.linkage_status<>'READY_LINKAGE' then 'BLOCKED'
  else 'READY_LINKAGE'
 end,
 case
  when p.id is null then 'PRODUCT_NOT_FOUND'
  when pi.id is not null then 'PRODUCT_IMAGE_ID_ALREADY_EXISTS'
  when so.name is not null then 'WEB_OBJECT_PATH_ALREADY_EXISTS'
  when c.linkage_status<>'READY_LINKAGE' then c.linkage_status
  else 'NO_CONFLICT'
 end
from lihen_private.canonical_product_image_linkage_candidates c
left join public.products p on p.id=c.product_id
left join public.product_images pi on pi.id=c.product_image_id
left join storage.objects so on so.bucket_id=c.planned_web_bucket and so.name=c.planned_web_path
where c.run_id=p_run_id;
$$;
revoke execute on function lihen_private.preview_canonical_product_image_linkage(uuid) from public, anon, authenticated;

commit;
