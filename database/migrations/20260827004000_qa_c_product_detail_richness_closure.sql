create or replace view lihen_private.qa_c_product_detail_richness_closure as
with base as (select * from lihen_private.phase5_qac_product_detail_media_closure_status),
media_sources as (
  select count(*) filter(where publication_eligibility='ELIGIBLE_PRIMARY')::int eligible_primary_sources,
         count(distinct product_id) filter(where publication_eligibility='ELIGIBLE_PRIMARY')::int products_with_eligible_primary_source,
         count(*) filter(where publication_eligibility='FALLBACK_ONLY')::int fallback_sources
  from lihen_private.product_image_sources
),
multi_source as (
  select count(*)::int products_with_two_or_more_eligible_sources
  from (select product_id from lihen_private.product_image_sources where publication_eligibility='ELIGIBLE_PRIMARY' group by product_id having count(*)>=2) s
),
enrichment as (
  select count(*)::int approved_evidence,count(distinct product_id)::int products_with_approved_evidence
  from lihen_private.product_enrichment_evidence where verification_status='VERIFIED' and publication_status='APPROVED'
),
functions as (
  select count(*) filter(where p.proname='get_storefront_products_media_v2_controlled')::int media_rpc_present,
         count(*) filter(where p.proname='get_storefront_product_enrichment_controlled')::int enrichment_rpc_present
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in ('get_storefront_products_media_v2_controlled','get_storefront_product_enrichment_controlled')
)
select case when b.technical_status='PASS' and b.visible_active_products=952 and b.media_v2_publishable_products=952 and f.media_rpc_present=1 and f.enrichment_rpc_present=1 then 'PASS' else 'BLOCKED' end closure_status,
 'SOURCE_BACKED_PROGRESSIVE_NO_FABRICATION'::text closure_mode,
 b.visible_active_products,b.media_v2_publishable_products,b.no_media_products,b.single_image_products,b.multi_image_products,b.web_detail_products,b.gallery_ready_products,
 ms.eligible_primary_sources,ms.products_with_eligible_primary_source,mu.products_with_two_or_more_eligible_sources,ms.fallback_sources,e.approved_evidence,e.products_with_approved_evidence,f.media_rpc_present,f.enrichment_rpc_present,
 jsonb_build_array('PRODUCT_DETAIL_PREMIUM_UI_COMPLETE','BEAUTY_GALLERY_CAP_5','STYLE_GALLERY_CAP_10','SOURCE_BACKED_GALLERY_ONLY','VERIFIED_ENRICHMENT_ONLY','CANONICAL_CARD_FALLBACK_ALLOWED','NO_DUPLICATE_OR_FABRICATED_MEDIA','CONTENT_ENRICHMENT_PROGRESSIVE_NONBLOCKING') contract
from base b cross join media_sources ms cross join multi_source mu cross join enrichment e cross join functions f;
revoke all on lihen_private.qa_c_product_detail_richness_closure from public,anon,authenticated;
grant select on lihen_private.qa_c_product_detail_richness_closure to postgres;
insert into lihen_private.phase_exit_gate_results(phase_code,status,gate_version,metrics,accepted_waivers,notes,evaluated_at)
select 'QA-C',case when closure_status='PASS' then 'PASS' else 'BLOCKED' end,'QA_C_PRODUCT_DETAIL_RICHNESS_CLOSURE_V1',
 jsonb_build_object('closure_mode',closure_mode,'visible_active_products',visible_active_products,'media_v2_publishable_products',media_v2_publishable_products,'no_media_products',no_media_products,'single_image_products',single_image_products,'multi_image_products',multi_image_products,'web_detail_products',web_detail_products,'gallery_ready_products',gallery_ready_products,'eligible_primary_sources',eligible_primary_sources,'products_with_eligible_primary_source',products_with_eligible_primary_source,'products_with_two_or_more_eligible_sources',products_with_two_or_more_eligible_sources,'fallback_sources',fallback_sources,'approved_evidence',approved_evidence,'products_with_approved_evidence',products_with_approved_evidence,'contract',contract),
 jsonb_build_array('CONTENT_COVERAGE_REMAINS_PROGRESSIVE_BY_VERIFIED_SOURCE'),
 'QA-C closes Product Detail capability and safety. Richness coverage remains progressive by verified source; canonical card fallback is allowed and content/media must never be fabricated.',now()
from lihen_private.qa_c_product_detail_richness_closure
on conflict(phase_code) do update set status=excluded.status,gate_version=excluded.gate_version,metrics=excluded.metrics,accepted_waivers=excluded.accepted_waivers,notes=excluded.notes,evaluated_at=excluded.evaluated_at;
