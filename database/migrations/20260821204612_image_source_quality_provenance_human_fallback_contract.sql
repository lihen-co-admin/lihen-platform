create table if not exists lihen_private.product_image_sources (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  source_type text not null,
  source_reference_id text,
  source_document_key text,
  source_page integer,
  source_url text,
  supplier_reference text,
  brand_id uuid references public.brands(id) on delete set null,
  captured_at timestamptz not null default now(),
  sha256 text not null,
  mime_type text not null,
  width_px integer,
  height_px integer,
  byte_size bigint,
  quality_score numeric(5,2),
  confidence_score numeric(5,2),
  is_exact_product_match boolean not null default false,
  requires_review boolean not null default true,
  review_status text not null default 'PENDING',
  publication_eligibility text not null default 'NOT_ELIGIBLE',
  source_availability_status text not null default 'UNKNOWN',
  last_source_check_at timestamptz,
  source_change_detected boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_image_sources_source_type_check check (source_type in ('ORIGINAL','OFFICIAL_WEB','SUPPLIER_PDF','CATALOG_EVIDENCE_CROP','VERIFIED_EXTERNAL','HUMAN_PROVIDED')),
  constraint product_image_sources_sha256_check check (sha256 ~ '^[0-9a-f]{64}$'),
  constraint product_image_sources_mime_check check (mime_type in ('image/jpeg','image/png','image/webp')),
  constraint product_image_sources_source_page_check check (source_page is null or source_page > 0),
  constraint product_image_sources_width_check check (width_px is null or width_px > 0),
  constraint product_image_sources_height_check check (height_px is null or height_px > 0),
  constraint product_image_sources_byte_size_check check (byte_size is null or byte_size > 0),
  constraint product_image_sources_quality_score_check check (quality_score is null or (quality_score >= 0 and quality_score <= 100)),
  constraint product_image_sources_confidence_score_check check (confidence_score is null or (confidence_score >= 0 and confidence_score <= 100)),
  constraint product_image_sources_review_status_check check (review_status in ('PENDING','EVIDENCE_ACCEPTED','HUMAN_APPROVED','REJECTED')),
  constraint product_image_sources_publication_eligibility_check check (publication_eligibility in ('NOT_ELIGIBLE','FALLBACK_ONLY','ELIGIBLE_PRIMARY')),
  constraint product_image_sources_availability_check check (source_availability_status in ('UNKNOWN','AVAILABLE','MISSING','CHANGED')),
  constraint product_image_sources_human_approval_check check (review_status <> 'HUMAN_APPROVED' or (is_exact_product_match = true and requires_review = false))
);
comment on table lihen_private.product_image_sources is 'Canonical provenance/evidence candidates for product imagery. Source provenance is separate from published/derived assets. HUMAN_APPROVED is a review state, not a source type.';
comment on column lihen_private.product_image_sources.source_type is 'Origin taxonomy: ORIGINAL, OFFICIAL_WEB, SUPPLIER_PDF, CATALOG_EVIDENCE_CROP, VERIFIED_EXTERNAL, HUMAN_PROVIDED.';
comment on column lihen_private.product_image_sources.publication_eligibility is 'Whether a source may be used as NOT_ELIGIBLE, FALLBACK_ONLY, or ELIGIBLE_PRIMARY. Selection/publication still requires a separate asset record.';
comment on column lihen_private.product_image_sources.is_exact_product_match is 'Must represent the exact commercial product/variant/presentation; optimization may not reinterpret product identity.';
create unique index if not exists product_image_sources_product_origin_hash_uidx on lihen_private.product_image_sources (product_id,source_type,sha256,coalesce(source_reference_id, ''));
create index if not exists product_image_sources_product_idx on lihen_private.product_image_sources(product_id);
create index if not exists product_image_sources_brand_idx on lihen_private.product_image_sources(brand_id) where brand_id is not null;
create index if not exists product_image_sources_review_idx on lihen_private.product_image_sources(review_status, requires_review);
create index if not exists product_image_sources_publication_idx on lihen_private.product_image_sources(publication_eligibility, is_exact_product_match);
revoke all on table lihen_private.product_image_sources from public, anon, authenticated;
grant select, insert, update, delete on table lihen_private.product_image_sources to service_role;
insert into lihen_private.product_image_sources (product_id,source_type,source_reference_id,source_document_key,source_page,captured_at,sha256,mime_type,is_exact_product_match,requires_review,review_status,publication_eligibility,source_availability_status)
select c.product_id,'CATALOG_EVIDENCE_CROP',c.source_reference_id,e.source_key,e.source_page,least(c.created_at,e.created_at),c.evidence_sha256,c.mime_type,true,false,'EVIDENCE_ACCEPTED','FALLBACK_ONLY','UNKNOWN'
from lihen_private.canonical_product_image_linkage_candidates c join lihen_private.catalog_image_evidence e on e.evidence_id=c.source_reference_id where c.linkage_status='READY_LINKAGE' on conflict do nothing;
alter table public.product_images add column if not exists source_id uuid references lihen_private.product_image_sources(id) on delete restrict, add column if not exists asset_role text not null default 'DERIVATIVE', add column if not exists derivative_profile text;
alter table public.product_images drop constraint if exists product_images_source_type_check;
alter table public.product_images add constraint product_images_source_type_check check (source_type in ('MANUAL','LEGACY_MAIN_IMAGE_URL','STORAGE','ORIGINAL','OFFICIAL_WEB','SUPPLIER_PDF','CATALOG_EVIDENCE_CROP','VERIFIED_EXTERNAL','HUMAN_PROVIDED'));
alter table public.product_images drop constraint if exists product_images_asset_role_check;
alter table public.product_images add constraint product_images_asset_role_check check (asset_role in ('MASTER_COPY','PUBLISHED_PRIMARY','DERIVATIVE'));
alter table public.product_images drop constraint if exists product_images_derivative_profile_check;
alter table public.product_images add constraint product_images_derivative_profile_check check (derivative_profile is null or derivative_profile in ('WEB_CARD','WEB_DETAIL','CATALOG_PDF'));
comment on column public.product_images.source_id is 'Optional provenance source link. Required by new canonical image flows; nullable for legacy compatibility.';
comment on column public.product_images.asset_role is 'Asset semantics are separate from source provenance: MASTER_COPY, PUBLISHED_PRIMARY, DERIVATIVE.';
comment on column public.product_images.derivative_profile is 'Rendition profile for generated derivatives: WEB_CARD, WEB_DETAIL, CATALOG_PDF.';
create index if not exists product_images_source_id_idx on public.product_images(source_id) where source_id is not null;
alter table lihen_private.product_image_storage_assets add column if not exists rendition_profile text;
alter table lihen_private.product_image_storage_assets drop constraint if exists product_image_storage_rendition_profile_check;
alter table lihen_private.product_image_storage_assets add constraint product_image_storage_rendition_profile_check check (rendition_profile is null or rendition_profile in ('ORIGINAL_MASTER','WEB_CARD','WEB_DETAIL','CATALOG_PDF'));
alter table lihen_private.product_image_storage_assets drop constraint if exists product_image_storage_variant_profile_alignment_check;
alter table lihen_private.product_image_storage_assets add constraint product_image_storage_variant_profile_alignment_check check (rendition_profile is null or (variant='ORIGINAL' and rendition_profile='ORIGINAL_MASTER') or (variant='WEB' and rendition_profile in ('WEB_CARD','WEB_DETAIL','CATALOG_PDF')));
comment on column lihen_private.product_image_storage_assets.rendition_profile is 'Profile within a bucket class. Current 1.22.1 derivatives are WEB_CARD; future WEB_DETAIL/CATALOG_PDF do not require a new bucket contract.';
