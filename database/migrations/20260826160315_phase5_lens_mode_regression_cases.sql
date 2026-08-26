create table if not exists lihen_private.visual_intelligence_regression_cases (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku_snapshot text,
  product_name_snapshot text not null,
  case_group text not null,
  expected_identity_scope text not null,
  expected_brand text,
  expected_product_match_status text not null,
  expected_source_mapping_status text not null,
  expected_rights_status text not null,
  expected_gallery_readiness_status text not null,
  expected_should_block boolean not null default false,
  expected_block_reason text,
  regression_notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(product_id,case_group)
);
create index if not exists visual_intelligence_regression_cases_active_idx on lihen_private.visual_intelligence_regression_cases(is_active,case_group);

with seed(sku,case_group,identity_scope,brand,product_match,source_mapping,rights,gallery,should_block,block_reason) as (values
('BC-052','EXACT_BRAND_PLUS_SECONDARY_REFERENCE','EXACT','BIOAQUA','EXACT_PRODUCT_MATCH_USER_VISUAL_CORROBORATED','BRAND_ATTRIBUTION_CONFIRMED_OFFICIAL_SOURCE_PLUS_SECONDARY_EXACT_REFERENCE','INTERNAL_LIHEN_ASSET','INTERNAL_MEDIA_AVAILABLE_PENDING_INGESTION',false,null),
('BC-006','EXACT_OFFICIAL_PLUS_VISUAL','EXACT','USHAS','EXACT_PRODUCT_MATCH_USER_VISUAL_CORROBORATED','BRAND_ATTRIBUTION_CONFIRMED_OFFICIAL_SOURCE_PLUS_SECONDARY_EXACT_REFERENCE','INTERNAL_LIHEN_ASSET','INTERNAL_MEDIA_AVAILABLE_PENDING_INGESTION',false,null),
('BC-027','EXACT_OFFICIAL_PLUS_VISUAL','EXACT','USHAS','EXACT_PRODUCT_MATCH_USER_VISUAL_CORROBORATED','BRAND_ATTRIBUTION_CONFIRMED_OFFICIAL_SOURCE_PLUS_SECONDARY_PRODUCT_REFERENCE','INTERNAL_LIHEN_ASSET','INTERNAL_MEDIA_AVAILABLE_PENDING_INGESTION',false,null),
('BC-046','EXACT_OFFICIAL_PLUS_VISUAL','EXACT','USHAS','EXACT_PRODUCT_MATCH_USER_VISUAL_CORROBORATED','BRAND_ATTRIBUTION_CONFIRMED_OFFICIAL_SOURCE_PLUS_SECONDARY_PRODUCT_REFERENCE','INTERNAL_LIHEN_ASSET','INTERNAL_MEDIA_AVAILABLE_PENDING_INGESTION',false,null),
('BC-005','EXACT_USER_VISUAL_PLUS_SECONDARY','EXACT','Alis-sha Beauty','EXACT_PRODUCT_MATCH_USER_VISUAL_CORROBORATED','BRAND_ATTRIBUTION_CONFIRMED_USER_EVIDENCE_PLUS_SECONDARY_PRODUCT_REFERENCE','INTERNAL_LIHEN_ASSET','INTERNAL_MEDIA_AVAILABLE_PENDING_INGESTION',false,null),
('BC-039','EXACT_USER_VISUAL_PLUS_SECONDARY','EXACT','Girly','EXACT_PRODUCT_MATCH_USER_VISUAL_CORROBORATED','BRAND_ATTRIBUTION_CONFIRMED_USER_VISUAL_PLUS_SECONDARY_PRODUCT_REFERENCE','INTERNAL_LIHEN_ASSET','INTERNAL_MEDIA_AVAILABLE_PENDING_INGESTION',false,null),
('BC-051','FAMILY_MULTI_VARIANT','FAMILY','KOEC','FAMILY_MATCH_VARIANT_REQUIRED','BRAND_ATTRIBUTION_CONFIRMED_OFFICIAL_SOURCE_VARIANT_SET','INTERNAL_LIHEN_ASSET','INTERNAL_MEDIA_AVAILABLE_VARIANT_REVIEW_PENDING',true,'Multiple KOEC variants observed; block exact normalization until variant split.'),
('BC-453','FAMILY_VARIANT_PENDING','FAMILY','Bloomshell','FAMILY_MATCH_VARIANT_REQUIRED','BRAND_ATTRIBUTION_USER_VISUAL_PLUS_OFFICIAL_CATEGORY_REFERENCE','INTERNAL_LIHEN_ASSET','INTERNAL_MEDIA_AVAILABLE_VARIANT_REVIEW_PENDING',true,'Bloomshell family confirmed; exact set/model still pending.'),
('BC-008','GENERIC_OEM_NO_BRAND','GENERIC',null,'GENERIC_PRODUCT_IDENTITY_CONFIRMED_USER_VISUAL','MANUFACTURER_AND_RETAIL_SOURCE_UNCONFIRMED_AFTER_VISUAL_WEB_SEARCH','INTERNAL_LIHEN_ASSET','INTERNAL_MEDIA_AVAILABLE_SOURCE_UNRESOLVED',true,'Do not invent manufacturer/brand; generic identity is valid.'),
('BC-082','INTERNAL_USE_NOT_FOR_SALE','INTERNAL',null,'INTERNAL_PRODUCT_IDENTITY_CONFIRMED','USER_CONFIRMED_SUPPLIER_SOURCE','INTERNAL_LIHEN_ASSET','INTERNAL_USE_NOT_FOR_SALE',true,'Internal LIHEN operational product; never treat as customer-facing merchandise.'),
('BC-009','PACKAGING_BRAND_EXACT_MODEL','EXACT','MIXUEER','EXACT_PRODUCT_MATCH_USER_VISUAL_CORROBORATED','BRAND_ATTRIBUTION_CONFIRMED_FROM_PACKAGING_PLUS_SECONDARY_BRAND_REFERENCE','INTERNAL_LIHEN_ASSET','INTERNAL_MEDIA_AVAILABLE_PENDING_INGESTION',false,null),
('BC-010','PACKAGING_RETAIL_SOURCE_WEB_UNVERIFIED','EXACT','AKARE Cosmetics','EXACT_PRODUCT_MATCH_USER_VISUAL_CORROBORATED','RETAIL_SOURCE_CONFIRMED_FROM_PACKAGING_WEB_UNVERIFIED','INTERNAL_LIHEN_ASSET','INTERNAL_MEDIA_AVAILABLE_PENDING_INGESTION',true,'Packaging identifies commercial source but web source is not verified.'),
('BC-004','USER_DECLARED_SIBLING_IDENTITY_MEDIA_MISSING','EXACT','Alis-sha Beauty','EXACT_PRODUCT_MATCH_USER_DECLARED_PLUS_SECONDARY_PRODUCT_REFERENCE','BRAND_ATTRIBUTION_CONFIRMED_USER_EVIDENCE_PLUS_SECONDARY_PRODUCT_REFERENCE','PUBLIC_REFERENCE_ONLY','RIGHTS_OR_INTERNAL_ASSET_REQUIRED_NO_ACTIVE_MEDIA',true,'Identity inherited from human-confirmed sibling product; exact internal media still required.'),
('BC-037','USER_DECLARED_SIBLING_IDENTITY_MEDIA_MISSING','EXACT','Girly','EXACT_PRODUCT_MATCH_USER_DECLARED_PLUS_SECONDARY_PRODUCT_REFERENCE','BRAND_ATTRIBUTION_CONFIRMED_USER_DECLARATION_PLUS_SECONDARY_PRODUCT_REFERENCE','PUBLIC_REFERENCE_ONLY','RIGHTS_OR_INTERNAL_ASSET_REQUIRED_NO_ACTIVE_MEDIA',true,'Identity inherited from human-confirmed sibling product; exact internal media still required.')
)
insert into lihen_private.visual_intelligence_regression_cases(product_id,sku_snapshot,product_name_snapshot,case_group,expected_identity_scope,expected_brand,expected_product_match_status,expected_source_mapping_status,expected_rights_status,expected_gallery_readiness_status,expected_should_block,expected_block_reason,regression_notes)
select p.id,p.sku,p.name,s.case_group,s.identity_scope,s.brand,s.product_match,s.source_mapping,s.rights,s.gallery,s.should_block,s.block_reason,'Seeded from 2026-08-26 human-verified Lens Mode learning cases.'
from seed s join public.products p on p.sku=s.sku
on conflict(product_id,case_group) do update set expected_identity_scope=excluded.expected_identity_scope,expected_brand=excluded.expected_brand,expected_product_match_status=excluded.expected_product_match_status,expected_source_mapping_status=excluded.expected_source_mapping_status,expected_rights_status=excluded.expected_rights_status,expected_gallery_readiness_status=excluded.expected_gallery_readiness_status,expected_should_block=excluded.expected_should_block,expected_block_reason=excluded.expected_block_reason,updated_at=now();

create or replace view lihen_private.visual_intelligence_regression_case_status as
select r.id,r.product_id,r.sku_snapshot,r.product_name_snapshot,r.case_group,r.expected_identity_scope,r.expected_brand,r.expected_product_match_status,r.expected_source_mapping_status,r.expected_rights_status,r.expected_gallery_readiness_status,r.expected_should_block,r.expected_block_reason,
       b.brand current_brand,b.product_match_status current_product_match_status,b.source_mapping_status current_source_mapping_status,b.rights_status current_rights_status,b.gallery_readiness_status current_gallery_readiness_status,
       coalesce(b.brand,'')=coalesce(r.expected_brand,'') and b.product_match_status=r.expected_product_match_status and b.source_mapping_status=r.expected_source_mapping_status and b.rights_status=r.expected_rights_status and b.gallery_readiness_status=r.expected_gallery_readiness_status regression_pass
from lihen_private.visual_intelligence_regression_cases r
left join lateral (
  select bi.* from lihen_private.beauty_intelligence_batch_items bi where bi.product_id=r.product_id order by bi.updated_at desc limit 1
) b on true
where r.is_active=true;
